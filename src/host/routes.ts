/**
 * Same-origin RPC routes for the browser half.
 *
 * A single `POST /dsh-advanced-provider-settings/rpc` endpoint dispatching on an
 * `op` field, rather than one route per action: the guard, the body cap and the
 * error envelope are then written once and cannot diverge between operations
 * (spec section 52).
 *
 * Every handler is read-only or a user-initiated probe. Nothing here writes
 * settings — the browser half owns writes so that they carry the client's
 * revision fence.
 */
import {
  PLUGIN_NAMESPACE,
  PROVIDER_NAMESPACE,
} from '../shared/capabilities.js'
import { maskHeaderValue, isSensitiveHeader, type HeaderEntry } from '../shared/headers.js'
import { buildDiagnostics, isPackageInstalled, type DiagnosticsReport } from './diagnostics.js'
import { discoveryHeaders, runDiscovery, type DiscoveryOutcome, type LlmDiscoveryService } from './discovery.js'
import { guardRequest, MAX_BODY_BYTES, type GuardResult } from './guard.js'
import { headerAdvisories, resolveEffectiveHeaders, type HeaderAdvisory } from './header-resolver.js'
import type { RequestHeaderContext } from './header-runtime.js'
import { hasImportableHeaders, inspectLegacy, type LegacySnapshot } from './migration.js'
import { listHostProviders } from './provider-config.js'
import type { readProviderSection } from './provider-config.js'
import { validateProviderDraft, type DraftIssue } from './validation.js'
import type { PluginSettings, ProviderProfile } from '../shared/types.js'

/** Route prefix owned by this plugin. */
export const ROUTE_PREFIX = '/dsh-advanced-provider-settings'

/** Everything the route layer reads from the host, injected for testability. */
export interface RouteDeps {
  pluginVersion: string
  getOwnSettings: () => PluginSettings | undefined
  getProviderSection: () => ReturnType<typeof readProviderSection>
  namespaces: () => readonly string[]
  writable: boolean
  revisionSupported: boolean
  headerRuntimeActive: boolean
  headerRuntimeApplied: () => number
  routesRegistered: () => boolean
  legacyValue: () => unknown
  llm: LlmDiscoveryService
  runWithHeaders: <T>(context: RequestHeaderContext, body: () => T) => T
}

/** The RPC envelope the browser half sends. */
interface RpcRequest {
  op?: unknown
  payload?: unknown
}

/** The RPC envelope returned. */
interface RpcResponse {
  ok: boolean
  error?: string
  code?: string
  result?: unknown
}

/**
 * Build the request handler for one plugin installation.
 * @param deps - host facts and services the handlers need.
 * @returns an async Node request handler.
 */
export function createRpcHandler(deps: RouteDeps): (req: HttpRequestLike, res: HttpResponseLike) => Promise<void> {
  return async (req, res) => {
    const path = pathOf(req.url)
    if (path === `${ROUTE_PREFIX}/health`) {
      sendJson(res, 200, { ok: true, plugin: PLUGIN_NAMESPACE, version: deps.pluginVersion })
      return
    }
    if (path !== `${ROUTE_PREFIX}/rpc`) {
      sendJson(res, 404, { ok: false, code: 'not-found' })
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, code: 'method-not-allowed' })
      return
    }

    const guard: GuardResult = guardRequest(req.method, req.headers, req.socket?.remoteAddress)
    if (!guard.ok) {
      sendJson(res, guard.status, { ok: false, code: 'refused', error: guard.reason })
      return
    }

    const raw = await readBody(req)
    if (raw === null) {
      sendJson(res, 413, { ok: false, code: 'body-too-large' })
      return
    }

    let parsed: RpcRequest
    try {
      parsed = JSON.parse(raw) as RpcRequest
    } catch {
      sendJson(res, 400, { ok: false, code: 'invalid-json' })
      return
    }

    try {
      const response = await dispatch(deps, parsed)
      sendJson(res, response.ok ? 200 : 400, response)
    } catch (error) {
      // A route crash must not leak a stack trace or a header value to the page.
      sendJson(res, 500, { ok: false, code: 'internal', error: shortError(error) })
    }
  }
}

/**
 * Dispatch one RPC operation.
 * @param deps - host facts and services.
 * @param request - the parsed envelope.
 * @returns the envelope to send.
 */
export async function dispatch(deps: RouteDeps, request: RpcRequest): Promise<RpcResponse> {
  const op = typeof request.op === 'string' ? request.op : ''
  const payload = isRecord(request.payload) ? request.payload : {}

  switch (op) {
    case 'diagnostics':
      return { ok: true, result: diagnosticsOf(deps) }

    case 'providers':
      return { ok: true, result: providersOf(deps) }

    case 'effective-headers':
      return { ok: true, result: effectiveHeadersOf(deps, payload) }

    case 'validate':
      return { ok: true, result: validateOf(payload) }

    case 'legacy':
      return { ok: true, result: legacyOf(deps) }

    case 'discover':
      return { ok: true, result: await discoverOf(deps, payload) }

    default:
      return { ok: false, code: 'unknown-op', error: `unknown op: ${op.slice(0, 32)}` }
  }
}

/** Host diagnostics plus a note about whether migration has anything to offer. */
function diagnosticsOf(deps: RouteDeps): DiagnosticsReport & { migrationAvailable: boolean } {
  return {
    ...buildDiagnostics({
      pluginVersion: deps.pluginVersion,
      namespaces: deps.namespaces(),
      writable: deps.writable,
      revisionSupported: deps.revisionSupported,
      headerRuntimeActive: deps.headerRuntimeActive,
      headerRuntimeApplied: deps.headerRuntimeApplied(),
      routesRegistered: deps.routesRegistered(),
    }),
    migrationAvailable: hasImportableHeaders(legacyOf(deps)),
  }
}

/** The configured provider routes, as a fallback for a client that cannot read the directory. */
function providersOf(deps: RouteDeps): { providerId: string; displayName: string }[] {
  return listHostProviders(deps.getProviderSection()).map((record) => ({
    providerId: record.providerId,
    displayName: record.displayName,
  }))
}

/** Effective headers for one provider, with sensitive values masked. */
function effectiveHeadersOf(
  deps: RouteDeps,
  payload: Record<string, unknown>,
): {
  headers: { name: string; value: string; source: string; reserved: boolean; sensitive: boolean }[]
  advisories: HeaderAdvisory[]
  attributionOverridden: boolean
} {
  const providerId = typeof payload.providerId === 'string' ? payload.providerId : ''
  const section = deps.getProviderSection()
  const effective = resolveEffectiveHeaders({
    settings: deps.getOwnSettings(),
    section,
    providerId,
  })

  const advisories = headerAdvisories(
    effective.filter((header) => header.source === 'provider').map((header) => ({ name: header.name, value: header.value })),
    section?.providers?.[providerId]?.apiKeyEnv,
  )

  return {
    // Values are masked here rather than in the browser: a sensitive header's
    // value has no reason to travel to the page for a read-only preview
    // (spec sections 17, 52).
    headers: effective.map((header) => ({
      name: header.name,
      value: isSensitiveHeader(header.name) ? maskHeaderValue(header.value) : header.value,
      source: header.source,
      reserved: header.reserved,
      sensitive: isSensitiveHeader(header.name),
    })),
    advisories,
    attributionOverridden: effective.some((header) => header.source === 'global' && header.reserved),
  }
}

/** Validate a provider draft submitted from the browser. */
function validateOf(payload: Record<string, unknown>): { issues: DraftIssue[] } {
  const profile = isRecord(payload.profile) ? (payload.profile as ProviderProfile) : {}
  return { issues: validateProviderDraft(profile) }
}

/** What the host knows about the retired community plugin. */
function legacyOf(deps: RouteDeps): LegacySnapshot {
  return inspectLegacy({
    namespaces: deps.namespaces(),
    legacyValue: deps.legacyValue(),
    packageInstalled: isPackageInstalled('dsh-custom-provider-settings/package.json'),
  })
}

/** Interrogate a provider endpoint using the headers currently in the form. */
async function discoverOf(deps: RouteDeps, payload: Record<string, unknown>): Promise<DiscoveryOutcome> {
  const providerId = typeof payload.providerId === 'string' ? payload.providerId : ''
  const draftHeaders = headerEntriesOfPayload(payload.headers)
  const request: { provider?: string; baseURL?: string; api?: string; apiKey?: string } = {}
  if (providerId.length > 0) request.provider = providerId
  if (typeof payload.baseURL === 'string' && payload.baseURL.length > 0) request.baseURL = payload.baseURL
  if (typeof payload.api === 'string' && payload.api.length > 0) request.api = payload.api

  const headers = discoveryHeaders(
    effectiveGlobalHeaders(deps),
    draftHeaders,
  )

  const timeoutMs = typeof payload.timeoutMs === 'number' && Number.isFinite(payload.timeoutMs)
    ? Math.min(Math.max(payload.timeoutMs, 1000), 120_000)
    : undefined

  return runDiscovery({
    llm: deps.llm,
    run: deps.runWithHeaders,
    providerId,
    request,
    headers,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  })
}

/** The stored global headers, validated. */
function effectiveGlobalHeaders(deps: RouteDeps): HeaderEntry[] {
  const settings = deps.getOwnSettings()
  const record = settings?.globalHeaders
  if (record === undefined || record === null) return []
  return Object.entries(record)
    .filter(([name, value]) => typeof name === 'string' && typeof value === 'string')
    .map(([name, value]) => ({ name, value }))
}

/** Read a `{name: value}` header record out of an RPC payload. */
function headerEntriesOfPayload(value: unknown): HeaderEntry[] {
  if (!isRecord(value)) return []
  const entries: HeaderEntry[] = []
  for (const [name, headerValue] of Object.entries(value)) {
    if (typeof headerValue === 'string') entries.push({ name, value: headerValue })
  }
  return entries
}

/** Whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Pathname of a request URL, tolerating a malformed one. */
function pathOf(url: string | undefined): string {
  try {
    return new URL(url ?? '/', 'http://localhost').pathname
  } catch {
    return ''
  }
}

/** Minimal Node request shape, so tests need no socket. */
export interface HttpRequestLike {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
  on: (event: string, listener: (...args: never[]) => void) => void
  destroy: () => void
}

/** Minimal Node response shape. */
export interface HttpResponseLike {
  writeHead: (status: number, headers: Record<string, string>) => void
  end: (body?: string) => void
}

/** Send one JSON envelope. */
function sendJson(res: HttpResponseLike, status: number, body: unknown): void {
  try {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    res.end(JSON.stringify(body))
  } catch {
    // The peer hung up mid-response; there is nothing useful left to do and
    // logging here would only add noise.
  }
}

/** Read a request body with a hard cap. */
function readBody(req: HttpRequestLike): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', ((chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        req.destroy()
        resolve(null)
        return
      }
      chunks.push(chunk)
    }) as never)
    req.on('end', (() => { resolve(Buffer.concat(chunks).toString('utf8')) }) as never)
    req.on('error', (() => { resolve(null) }) as never)
  })
}

/** Shorten a thrown value for the error envelope. */
function shortError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200)
  return 'unexpected failure'
}

/** The web-server registration surface this plugin uses. */
export interface WebServerLike {
  register: (options: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: HttpRequestLike, res: HttpResponseLike) => void | Promise<void>
  }) => () => void
}

/**
 * Register the routes and return a disposer.
 * @param webServer - the host web-server registry.
 * @param deps - handler dependencies.
 * @param onRegistered - called with whether registration succeeded, for diagnostics.
 * @returns a disposer that unregisters the routes.
 */
export function registerRoutes(
  webServer: WebServerLike,
  deps: RouteDeps,
  onRegistered: (registered: boolean) => void,
): () => void {
  const handler = createRpcHandler(deps)
  const dispose = webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler })
  onRegistered(true)
  return () => {
    onRegistered(false)
    dispose()
  }
}

/** Namespace this plugin reads provider configuration from. */
export const READ_NAMESPACE = PROVIDER_NAMESPACE
