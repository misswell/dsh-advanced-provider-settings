/**
 * Request-scoped header bridge (spec sections 14, 15, 66).
 *
 * The concurrency case is the release gate: 100 overlapping requests on
 * different providers must each see their own headers and nobody else's. The
 * failure mode this guards against — a module-level `currentHeaders` — is the
 * single most common way a plugin like this breaks a multi-agent run.
 *
 * Every test installs a fake `globalThis.fetch` BEFORE the bridge, so the
 * bridge's own wrapping and restoration are exercised rather than mocked away.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HeaderRuntime, withHeaders, type RequestHeaderContext } from '../src/host/header-runtime.js'
import type { HeaderEntry } from '../src/shared/headers.js'

/** One captured fetch call. */
interface CapturedCall {
  url: string
  headers: Record<string, string>
}

/** The original fetch, restored after every test. */
const realFetch = globalThis.fetch

/** Calls the fake fetch recorded, in arrival order. */
let calls: CapturedCall[] = []

/** Install a recording fetch and return it. */
function installRecordingFetch(): void {
  calls = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers: Record<string, string> = {}
    if (init?.headers !== undefined) {
      new Headers(init.headers as HeadersInit).forEach((value, key) => { headers[key] = value })
    }
    calls.push({ url, headers })
    return new Response('{}', { status: 200 })
  }) as typeof globalThis.fetch
}

/** Build a context for one provider. */
function contextFor(provider: string, headers: HeaderEntry[]): RequestHeaderContext {
  return { provider, model: `${provider}-model`, headers }
}

/** Sleep, to force interleaving. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

beforeEach(() => {
  installRecordingFetch()
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('withHeaders', () => {
  it('adds a header that is absent', () => {
    const result = withHeaders('https://api.test/v1', { method: 'POST' }, [{ name: 'x-global', value: 'g' }])
    const headers = new Headers(result.init?.headers)
    expect(headers.get('x-global')).toBe('g')
  })

  it('lets an existing provider header win, which is how Provider > Global works', () => {
    const result = withHeaders(
      'https://api.test/v1',
      { headers: { 'x-shared': 'provider' } },
      [{ name: 'x-shared', value: 'global' }],
    )
    expect(new Headers(result.init?.headers).get('x-shared')).toBe('provider')
  })

  it('overrides the reserved user-agent, the only name Harness would otherwise pin', () => {
    const result = withHeaders(
      'https://api.test/v1',
      { headers: { 'user-agent': 'deepseek-harness/0.1.5-rc.2' } },
      [{ name: 'user-agent', value: 'my-gateway-client/1.0' }],
    )
    expect(new Headers(result.init?.headers).get('user-agent')).toBe('my-gateway-client/1.0')
  })

  it('matches the reserved name case-insensitively', () => {
    const result = withHeaders(
      'https://api.test/v1',
      { headers: { 'user-agent': 'harness' } },
      [{ name: 'User-Agent', value: 'mine' }],
    )
    expect(new Headers(result.init?.headers).get('user-agent')).toBe('mine')
  })

  it('does not mutate the caller-supplied headers object', () => {
    const original = new Headers({ 'x-keep': '1' })
    withHeaders('https://api.test/v1', { headers: original }, [{ name: 'x-new', value: '2' }])
    expect(original.has('x-new')).toBe(false)
  })

  it('reads headers off a Request when no init is given', () => {
    const request = new Request('https://api.test/v1', { headers: { 'x-shared': 'provider' } })
    const result = withHeaders(request, undefined, [
      { name: 'x-shared', value: 'global' },
      { name: 'x-added', value: 'yes' },
    ])
    const headers = new Headers(result.init?.headers)
    expect(headers.get('x-shared')).toBe('provider')
    expect(headers.get('x-added')).toBe('yes')
  })

  it('drops a header that would break the wire', () => {
    const result = withHeaders('https://api.test/v1', undefined, [
      { name: 'x-evil', value: 'a\r\nx-injected: 1' },
    ])
    expect(new Headers(result.init?.headers).has('x-evil')).toBe(false)
  })
})

describe('bridge lifecycle', () => {
  it('leaves fetch untouched while no request is in scope', async () => {
    const untouched = globalThis.fetch
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()
    // The wrapper is installed, but a call outside any scope must reach the
    // recording fetch with the original arguments.
    await fetch('https://unrelated.test/thing', { headers: { 'x-mine': '1' } })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.headers['x-global']).toBeUndefined()
    expect(calls[0]!.headers['x-mine']).toBe('1')
    // The wrapper is a different function, but it adds nothing on this path.
    expect(globalThis.fetch).not.toBe(untouched)
    dispose()
    expect(globalThis.fetch).toBe(untouched)
  })

  it('applies global headers inside a scope', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()
    await runtime.run(contextFor('p1', [{ name: 'x-global', value: 'g' }]), () =>
      fetch('https://api.test/v1', { headers: { 'x-provider': 'p' } }),
    )
    expect(calls[0]!.headers['x-global']).toBe('g')
    expect(calls[0]!.headers['x-provider']).toBe('p')
    dispose()
  })

  it('restores fetch only when the last holder disposes', () => {
    const before = globalThis.fetch
    const first = new HeaderRuntime()
    const second = new HeaderRuntime()
    const disposeFirst = first.install()
    const disposeSecond = second.install()

    disposeFirst()
    expect(globalThis.fetch).not.toBe(before)
    disposeSecond()
    expect(globalThis.fetch).toBe(before)
  })

  it('does not clobber a foreign wrapper installed after it', () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()
    const foreign = (async () => new Response('')) as typeof globalThis.fetch
    globalThis.fetch = foreign
    dispose()
    expect(globalThis.fetch).toBe(foreign)
  })

  it('is idempotent per disposer', () => {
    const before = globalThis.fetch
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()
    dispose()
    dispose()
    expect(globalThis.fetch).toBe(before)
  })

  it('reports no scope outside a run', () => {
    const runtime = new HeaderRuntime()
    expect(runtime.peek()).toBeUndefined()
    runtime.run(contextFor('p', [{ name: 'x', value: '1' }]), () => {
      expect(runtime.peek()?.provider).toBe('p')
    })
    expect(runtime.peek()).toBeUndefined()
  })
})

describe('release gate: 100 concurrent requests (section 66)', () => {
  it('never lets one provider see another provider headers', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()

    const total = 100
    const results = await Promise.all(
      Array.from({ length: total }, async (_unused, index) => {
        const provider = `provider-${String(index)}`
        const header: HeaderEntry = { name: `x-${provider}`, value: `value-${String(index)}` }
        // Stagger the starts so the scopes genuinely overlap and the scheduler
        // is forced to interleave the continuations.
        await sleep(index % 7)
        const response = await runtime.run(contextFor(provider, [header]), async () => {
          await sleep((total - index) % 5)
          return fetch(`https://api.test/${provider}`, { headers: { 'x-provider': provider } })
        })
        return { index, provider, response }
      }),
    )

    expect(results).toHaveLength(total)
    expect(calls).toHaveLength(total)

    for (const call of calls) {
      const provider = call.url.slice('https://api.test/'.length)
      const index = Number(provider.slice('provider-'.length))

      // Exactly its own global header, under its own name and value.
      expect(call.headers[`x-${provider}`]).toBe(`value-${String(index)}`)
      expect(call.headers['x-provider']).toBe(provider)

      // And NOT any other provider's header.
      for (let other = 0; other < total; other += 1) {
        if (other === index) continue
        expect(call.headers[`x-provider-${String(other)}`]).toBeUndefined()
      }
    }

    dispose()
  })

  it('keeps scopes separate across an awaited boundary inside the scope', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()

    const run = async (tag: string): Promise<string | null> => {
      return await runtime.run(contextFor(tag, [{ name: 'x-tag', value: tag }]), async () => {
        await sleep(3)
        await fetch(`https://api.test/${tag}`)
        return calls.find((call) => call.url.endsWith(`/${tag}`))?.headers['x-tag'] ?? null
      })
    }

    const [a, b, c] = await Promise.all([run('alpha'), run('beta'), run('gamma')])
    expect([a, b, c]).toEqual(['alpha', 'beta', 'gamma'])
    dispose()
  })
})

describe('scopedStream', () => {
  it('keeps the scope active across every pull, not just the first', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()

    const observed: (string | undefined)[] = []
    async function* source(): AsyncGenerator<string> {
      for (const chunk of ['a', 'b', 'c']) {
        // The adapter's request is opened lazily on a later pull, so the scope
        // has to be re-entered around each one.
        await sleep(1)
        observed.push(runtime.peek()?.provider)
        await fetch('https://api.test/stream')
        yield chunk
      }
    }

    const seen: string[] = []
    const stream = runtime.scopedStream(contextFor('streamer', [{ name: 'x-s', value: '1' }]), source())
    for await (const chunk of stream) seen.push(chunk)

    expect(seen).toEqual(['a', 'b', 'c'])
    expect(observed).toEqual(['streamer', 'streamer', 'streamer'])
    for (const call of calls) expect(call.headers['x-s']).toBe('1')
    dispose()
  })

  it('returns the source untouched when there are no headers to add', () => {
    const runtime = new HeaderRuntime()
    const source = (async function* () { yield 1 })()
    expect(runtime.scopedStream(contextFor('p', []), source)).toBe(source)
  })

  it('propagates the scope through a delegated return()', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()
    let returnScope: string | undefined

    const source: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: false, value: 'x' }),
          return: async () => {
            returnScope = runtime.peek()?.provider
            return { done: true, value: undefined }
          },
        }
      },
    }

    const iterator = runtime.scopedStream(contextFor('early-exit', [{ name: 'x', value: '1' }]), source)[Symbol.asyncIterator]()
    await iterator.next()
    await iterator.return?.()
    expect(returnScope).toBe('early-exit')
    dispose()
  })
})
