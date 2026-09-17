/**
 * Request-scoped header bridge for GLOBAL headers.
 *
 * Provider-level headers do not need this: Harness already puts them on the
 * request itself. Global headers have no provider to hang off, and DSH 0.1.5
 * exposes no per-request header seam — `GenerateOptions` carries no `headers`
 * field, the `llm/stream` waterfall receives a deep-frozen request it may not
 * rewrite, and the pi-ai adapter rebuilds its header set from the profile on
 * every call. The only layer that can still add a header is the transport.
 *
 * So this module does two things, and nothing else:
 *
 *  1. `ctx.on('llm/stream', …)` wraps the adapter's async iterator so EVERY
 *     `next()` runs inside an `AsyncLocalStorage` scope holding this request's
 *     global headers. Because the store rides the async context rather than a
 *     variable, two concurrent requests on different providers cannot see each
 *     other's headers (spec sections 14, 15) — there is deliberately no
 *     `let currentHeaders` anywhere in this file.
 *
 *  2. `globalThis.fetch` is replaced ONCE, and the replacement is completely
 *     inert unless an `AsyncLocalStorage` scope is active: outside an LLM
 *     request it forwards straight to the original fetch. Requests made by the
 *     rest of the host are never touched, so this is not the
 *     "wrap fetch and pollute everything" antipattern the spec forbids
 *     (section 14).
 *
 * PRECEDENCE, and why `user-agent` is special:
 *
 *   - For an ordinary name the wrapper only SETS a header that is not already
 *     present, so a provider header always beats a global one. That is the
 *     `Provider > Global` half of the spec's ordering, implemented by simply
 *     not fighting the layer that already ran.
 *
 *   - `user-agent` is the one name Harness reserves (`attributionHeaders()`),
 *     and `requestHeaders()` in dsh-llm-pi-ai STRIPS a provider-level
 *     `user-agent` before merging attribution on top. A global User-Agent is
 *     therefore the only way to influence the wire UA at all, so this wrapper
 *     overwrites the reserved name explicitly. The UI warns about this; the
 *     alternative would be to ship a User-Agent control that silently does
 *     nothing.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { isReservedHeader } from '../shared/capabilities.js'
import { validateHeader, type HeaderEntry } from '../shared/headers.js'

/** What one in-flight LLM request needs the transport to know. */
export interface RequestHeaderContext {
  /** Provider route the request belongs to. Diagnostics only — never a header. */
  provider: string
  /** Model id. Diagnostics only. */
  model: string
  /** Headers to merge, already validated. */
  headers: readonly HeaderEntry[]
}

/** Symbol under which the singleton bridge marks the installed wrapper. */
const BRIDGE_MARK = Symbol.for('dsh-advanced-provider-settings.header-bridge/v1')

/** The process-wide bridge shared by every installer of this plugin. */
interface HeaderBridge {
  /** The fetch that was current when the bridge was created. */
  base: typeof globalThis.fetch
  /** The wrapper currently installed. */
  wrapper: typeof globalThis.fetch
  /** Runtimes consulted, in install order, when a request is in flight. */
  runtimes: Set<HeaderRuntime>
  /** Live installer count; the bridge is dismantled at zero. */
  refs: number
}

/** A fetch function carrying the bridge marker. */
type MarkedFetch = typeof globalThis.fetch & { [BRIDGE_MARK]?: HeaderBridge }

/**
 * Owns this plugin instance's `AsyncLocalStorage` and the installed wrapper's
 * lifetime.
 */
export class HeaderRuntime {
  private readonly storage = new AsyncLocalStorage<RequestHeaderContext>()
  /** Header applications observed, for diagnostics only. Never values. */
  private applied = 0
  /** Whether the wrapper is currently installed by this runtime. */
  private installed = false

  /**
   * Install the fetch wrapper, refcounted across plugin instances.
   * @returns a disposer that removes this installer's reference.
   */
  install(): () => void {
    const globalObject = globalThis as { fetch?: MarkedFetch }
    const current = globalObject.fetch
    if (typeof current !== 'function') {
      // No fetch to wrap (a composition with no HTTP client). Global headers
      // simply have no transport to ride; everything else keeps working.
      return () => {}
    }

    const existing = current[BRIDGE_MARK]
    const bridge: HeaderBridge =
      existing ?? {
        base: current,
        wrapper: current,
        runtimes: new Set<HeaderRuntime>(),
        refs: 0,
      }

    if (existing === undefined) {
      bridge.wrapper = createWrapper(bridge)
      Object.defineProperty(bridge.wrapper, BRIDGE_MARK, {
        value: bridge,
        enumerable: false,
        // Deletable so the last disposer can leave no trace on the function it
        // replaced; a non-configurable marker would outlive the plugin.
        configurable: true,
      })
      globalObject.fetch = bridge.wrapper
      bridge.refs = 0
    }

    bridge.runtimes.add(this)
    bridge.refs += 1
    this.installed = true

    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      this.installed = false
      bridge.runtimes.delete(this)
      bridge.refs -= 1
      // Restore only our own wrapper, and only once nobody else holds it: a
      // later foreign wrapper stays installed rather than being clobbered.
      if (bridge.refs <= 0 && globalObject.fetch === bridge.wrapper) {
        globalObject.fetch = bridge.base
        if (bridge.wrapper !== undefined) {
          delete (bridge.wrapper as MarkedFetch)[BRIDGE_MARK]
        }
      }
    }
  }

  /**
   * Run one LLM request with its global headers in scope.
   *
   * @param context - provider/model identity and the validated headers.
   * @param body - the operation whose async continuations must see them.
   * @returns whatever `body` returns.
   */
  run<T>(context: RequestHeaderContext, body: () => T): T {
    if (context.headers.length === 0) return body()
    return this.storage.run(context, body)
  }

  /**
   * Wrap one adapter stream so every iteration step runs inside this runtime's
   * scope.
   *
   * Re-entering the scope around each `next()` is what makes the scope survive:
   * the adapter opens its HTTP request lazily on the first pull, and a plain
   * `storage.run(…, () => iterator)` would leave the later pulls outside the
   * context.
   *
   * @param context - the request's header context.
   * @param source - the adapter's async iterable.
   * @returns an equivalent iterable whose pulls are scoped.
   */
  scopedStream<T>(context: RequestHeaderContext, source: AsyncIterable<T>): AsyncIterable<T> {
    if (context.headers.length === 0) return source
    const storage = this.storage
    return {
      [Symbol.asyncIterator](): AsyncIterator<T> {
        const inner = source[Symbol.asyncIterator]()
        return {
          next: (): Promise<IteratorResult<T>> => storage.run(context, () => inner.next()),
          return: (value?: unknown): Promise<IteratorResult<T>> =>
            typeof inner.return === 'function'
              ? storage.run(context, () => inner.return!(value as T))
              : Promise.resolve({ done: true, value: value as T }),
          throw: (error?: unknown): Promise<IteratorResult<T>> =>
            typeof inner.throw === 'function'
              ? storage.run(context, () => inner.throw!(error))
              : Promise.reject(error),
        }
      },
    }
  }

  /** Current scope, for the wrapper and for tests. */
  peek(): RequestHeaderContext | undefined {
    return this.storage.getStore()
  }

  /** Whether the wrapper is installed by this runtime. */
  get isInstalled(): boolean {
    return this.installed
  }

  /** How many requests had headers applied, for diagnostics. */
  get appliedCount(): number {
    return this.applied
  }

  /** Record one applied request. Called by the wrapper. */
  noteApplied(): void {
    this.applied += 1
  }
}

/**
 * Build the fetch replacement around a bridge.
 *
 * The wrapper reads the innermost active scope and, when there is none, calls
 * the original fetch with the arguments untouched — the zero-overhead and
 * zero-blast-radius path that keeps this from being a global header injection
 * for the whole process.
 * @param bridge - the shared bridge whose runtimes are consulted.
 * @returns the wrapper.
 */
function createWrapper(bridge: HeaderBridge): typeof globalThis.fetch {
  const wrapper = function fetchWithGlobalHeaders(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let context: RequestHeaderContext | undefined
    let owner: HeaderRuntime | undefined
    for (const runtime of bridge.runtimes) {
      const candidate = runtime.peek()
      if (candidate === undefined) continue
      context = candidate
      owner = runtime
      break
    }
    if (context === undefined || owner === undefined || context.headers.length === 0) {
      return bridge.base(input, init)
    }

    let scoped: { input: RequestInfo | URL; init?: RequestInit }
    try {
      scoped = withHeaders(input, init, context.headers)
    } catch {
      // A header the transport refused must never break the user's request;
      // fall back to the unmodified call.
      return bridge.base(input, init)
    }
    owner.noteApplied()
    return bridge.base(scoped.input, scoped.init)
  }
  return wrapper as typeof globalThis.fetch
}

/**
 * Merge headers into a fetch call without clobbering what an earlier layer set.
 *
 * Reserved names overwrite (see the module doc: `user-agent` is otherwise
 * unreachable); every other name is only added when absent, which is what
 * yields `Provider > Global`.
 *
 * @param input - the first fetch argument.
 * @param init - the optional second fetch argument.
 * @param headers - validated headers to merge.
 * @returns arguments for the underlying fetch.
 */
export function withHeaders(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  headers: readonly HeaderEntry[],
): { input: RequestInfo | URL; init?: RequestInit } {
  const target = new Headers(requestHeadersOf(input, init))
  for (const header of headers) {
    // Belt and braces: the caller validated these, but this is the last gate
    // before the wire and a CRLF here would be a header-injection vector.
    if (!validateHeader(header.name, header.value).ok) continue
    if (isReservedHeader(header.name) || !target.has(header.name)) {
      target.set(header.name, header.value)
    }
  }
  // Always hand fetch an explicit init with a Headers instance: mutating the
  // caller's own Headers object would leak into their request.
  return { input, init: { ...init, headers: target } }
}

/** Read the headers a fetch call already carries, from either argument form. */
function requestHeadersOf(input: RequestInfo | URL, init: RequestInit | undefined): Headers {
  if (init?.headers !== undefined) return new Headers(init.headers as HeadersInit)
  if (typeof Request !== 'undefined' && input instanceof Request) return new Headers(input.headers)
  return new Headers()
}
