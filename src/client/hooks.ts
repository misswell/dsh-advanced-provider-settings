/**
 * Client hooks: settings snapshots, RPC, and a draft-state primitive.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { PLUGIN_NAMESPACE, PROVIDER_NAMESPACE } from '../shared/capabilities.js'
import type { ClientContext, SettingsScopeLike, SettingsSnapshotLike, Translate } from './contract.js'
import type { JsonValue, PluginSettings, ProviderNamespaceSection } from '../shared/types.js'

/** Route prefix the host half registers. */
export const RPC_PATH = '/dsh-advanced-provider-settings/rpc'

/**
 * The translate function for this plugin's copy, re-derived on locale change.
 *
 * The framework can synthesize a `t` prop for a registration that declares
 * `locale:`, but that mechanism resolves the namespace through the compile-time
 * `LocaleNamespaceMap` table and fails loud at render when the locale face is
 * not installed. Binding the namespace against the locale service gives the
 * same function with neither coupling, and subscribing to the service's
 * revision is what makes a language switch repaint this subtree.
 *
 * @param ctx - client context carrying the locale service.
 * @returns a stable-identity translate function for the plugin namespace.
 */
export function useTranslate(ctx: ClientContext): Translate {
  const locale = ctx.locale
  useSyncExternalStore(
    useCallback((listener: () => void) => locale.subscribe(listener), [locale]),
    useCallback(() => locale.getLocale().revision, [locale]),
    useCallback(() => 0, []),
  )
  // `bind` returns one function per namespace, so identity is stable across
  // renders and memoized children are not invalidated by a repaint.
  return useMemo(() => locale.bind(PLUGIN_NAMESPACE), [locale])
}

/**
 * Subscribe to a bound settings namespace.
 *
 * `getSnapshot` returns a stable reference until a real change, which is what
 * `useSyncExternalStore` requires; calling `bind` per render would break that,
 * so callers bind once (see {@link useProviderScope}).
 *
 * @param scope - the bound scope, or undefined while the service is unavailable.
 * @returns the current snapshot.
 */
export function useSettingsSnapshot<T>(
  scope: SettingsScopeLike<T> | undefined,
): SettingsSnapshotLike<T> {
  const subscribe = useCallback(
    (listener: () => void) => (scope === undefined ? () => {} : scope.subscribe(listener)),
    [scope],
  )
  const getSnapshot = useCallback(
    () => (scope === undefined ? UNAVAILABLE : scope.getSnapshot()),
    [scope],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Snapshot returned before a scope exists. A module constant for stable identity. */
const UNAVAILABLE: SettingsSnapshotLike<never> = {
  status: 'unavailable',
  value: undefined,
  base: undefined,
  user: undefined,
  revision: undefined,
  writable: false,
  mode: 'memory',
}

/**
 * Bind the `llm-pi-ai` namespace once per component lifetime.
 * @param ctx - the client context.
 * @returns the bound scope, or undefined when the service is absent.
 */
export function useProviderScope(ctx: ClientContext | undefined): SettingsScopeLike<ProviderNamespaceSection> | undefined {
  return useMemo(() => {
    if (ctx === undefined) return undefined
    return ctx.settingsScope.bind<ProviderNamespaceSection>({ namespace: PROVIDER_NAMESPACE })
  }, [ctx])
}

/**
 * Bind this plugin's own namespace once per component lifetime.
 * @param ctx - the client context.
 * @returns the bound scope, or undefined when the service is absent.
 */
export function useOwnScope(ctx: ClientContext | undefined): SettingsScopeLike<PluginSettings> | undefined {
  return useMemo(() => {
    if (ctx === undefined) return undefined
    return ctx.settingsScope.bind<PluginSettings>({ namespace: PLUGIN_NAMESPACE })
  }, [ctx])
}

/** One RPC call's state. */
export interface RpcState<T> {
  data: T | undefined
  loading: boolean
  error: string | undefined
}

/**
 * Same-origin RPC caller.
 *
 * Posts to this plugin's host route with a JSON body. The host side repeats the
 * origin and content-type checks the browser already enforces, so a refusal
 * here is a real answer rather than a transport accident.
 *
 * @returns a stable call function.
 */
export function useRpc(): <T>(op: string, payload?: Record<string, JsonValue>) => Promise<T | undefined> {
  return useCallback(async <T,>(op: string, payload: Record<string, JsonValue> = {}): Promise<T | undefined> => {
    if (typeof fetch !== 'function') return undefined
    try {
      const response = await fetch(RPC_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, payload }),
      })
      const body = (await response.json()) as { ok?: boolean; result?: T; error?: string }
      if (body.ok !== true) return undefined
      return body.result
    } catch {
      // A host route that is missing or unreachable degrades to "no data"; the
      // panel then renders from what the client already knows.
      return undefined
    }
  }, [])
}

/**
 * Run an RPC once when a dependency key changes.
 * @param op - operation name.
 * @param payload - request payload.
 * @param enabled - whether to run at all.
 * @returns the call state.
 */
export function useRpcQuery<T>(
  op: string,
  payload: Record<string, JsonValue>,
  enabled = true,
): RpcState<T> & { reload: () => void } {
  const rpc = useRpc()
  const [state, setState] = useState<RpcState<T>>({ data: undefined, loading: enabled, error: undefined })
  const [nonce, setNonce] = useState(0)
  const key = JSON.stringify(payload)

  useEffect(() => {
    if (!enabled) {
      setState({ data: undefined, loading: false, error: undefined })
      return
    }
    let cancelled = false
    setState((previous) => ({ ...previous, loading: true }))
    void rpc<T>(op, payload).then((data) => {
      if (cancelled) return
      setState({ data, loading: false, error: data === undefined ? 'unavailable' : undefined })
    })
    return () => { cancelled = true }
    // `key` stands in for `payload`: a caller building a fresh object each
    // render must not retrigger the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc, op, key, enabled, nonce])

  const reload = useCallback(() => { setNonce((value) => value + 1) }, [])
  return { ...state, reload }
}

/**
 * Controlled text state that tolerates an intermittent external value.
 *
 * A settings snapshot can be replaced underneath the editor (another client, or
 * the write we just made). The draft keeps the user's text until they commit,
 * and adopts the incoming value only when it changes and nothing is dirty.
 *
 * @param external - the committed value.
 * @param serialize - how to render the committed value as text.
 * @returns the text, a setter, and a dirty flag.
 */
export function useTextDraft(
  external: string,
  serialize: (text: string) => string = (text) => text,
): [string, (next: string) => void, boolean] {
  const [text, setText] = useState(external)
  const dirty = useRef(false)
  const lastExternal = useRef(external)

  useEffect(() => {
    if (lastExternal.current === external) return
    lastExternal.current = external
    if (!dirty.current) setText(external)
    // `serialize` is intentionally not a dependency: it only shapes the dirty
    // comparison, and re-running on a new closure would clobber the draft.
  }, [external])

  const update = useCallback((next: string) => {
    dirty.current = serialize(next) !== external
    setText(next)
  }, [external, serialize])

  return [text, update, dirty.current]
}

/**
 * Whether a settings field is explicitly overridden in the user layer.
 *
 * Presence, not value, is the signal: an override equal to the composition
 * default is still an override, and comparing values could not see it.
 *
 * @param rawUser - the snapshot's `user` layer.
 * @param path - path inside the namespace.
 * @returns whether the field is overridden.
 */
export function isOverridden(rawUser: unknown, path: readonly string[]): boolean {
  let node: unknown = rawUser
  for (const segment of path) {
    if (node === null || typeof node !== 'object') return false
    if (Array.isArray(node)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= node.length) return false
      node = node[index]
      continue
    }
    const record = node as Record<string, unknown>
    if (!Object.hasOwn(record, segment)) return false
    node = record[segment]
  }
  return node !== undefined
}

/** Read a value at a path out of a resolved namespace section. */
export function valueAt(section: unknown, path: readonly string[]): JsonValue | undefined {
  let node: unknown = section
  for (const segment of path) {
    if (node === null || node === undefined || typeof node !== 'object') return undefined
    if (Array.isArray(node)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= node.length) return undefined
      node = node[index]
      continue
    }
    node = (node as Record<string, unknown>)[segment]
  }
  return node as JsonValue | undefined
}

/** Number of entries in a record-shaped value. */
export function recordSize(value: unknown): number {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 0
  return Object.keys(value as Record<string, unknown>).length
}

/** Cast a value to a plain record, or an empty one. */
export function asRecord(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return Object.fromEntries(entries)
}
