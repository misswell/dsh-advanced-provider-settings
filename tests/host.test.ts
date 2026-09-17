/**
 * Host-half integration tests (spec sections 43, 52, 55, 70, 71, 72).
 *
 * The Discover Models case runs against a REAL `node:http` server reached
 * through the REAL `globalThis.fetch`, because the claim under test — "a header
 * that exists only in the unsaved form still reaches the provider" — is exactly
 * the claim a mocked transport would quietly grant for free.
 */
import { createServer, type Server } from 'node:http'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HeaderRuntime } from '../src/host/header-runtime.js'
import { discoveryHeaders, failureFacts, runDiscovery } from '../src/host/discovery.js'
import {
  buildImportOps,
  hasImportableHeaders,
  inspectLegacy,
} from '../src/host/migration.js'
import {
  guardRequest,
  isLoopbackHost,
  isSameOrigin,
  MAX_BODY_BYTES,
} from '../src/host/guard.js'
import {
  createRpcHandler,
  dispatch,
  type HttpRequestLike,
  type HttpResponseLike,
  type RouteDeps,
} from '../src/host/routes.js'
import { registerOwnSettings, type SettingsDescriptorLike } from '../src/host/settings.js'
import { resolveEffectiveHeaders, headerAdvisories, overridesAttribution } from '../src/host/header-resolver.js'
import { validateProviderDraft } from '../src/host/validation.js'
import { buildDiagnostics } from '../src/host/diagnostics.js'
import type { PluginSettings, ProviderProfile } from '../src/shared/types.js'

// ---------------------------------------------------------------------------
// A provider that gates on a header the user has not saved yet (section 72)
// ---------------------------------------------------------------------------

/** Header value the mock gateway demands. */
const GATE_HEADER = 'x-opencode-session'
const GATE_VALUE = 'session-abc123'

/** Requests the mock gateway received. */
let gatewayRequests: { url: string; headers: Record<string, string> }[] = []
let gateway: Server
let gatewayPort = 0

beforeAll(async () => {
  gateway = createServer((req, res) => {
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value
    }
    gatewayRequests.push({ url: req.url ?? '', headers })

    if (headers[GATE_HEADER] !== GATE_VALUE) {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'missing session header' } }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'gateway-large', context_window: 200000 }, { id: 'gateway-mini' }] }))
  })
  await new Promise<void>((resolve) => { gateway.listen(0, '127.0.0.1', resolve) })
  const address = gateway.address()
  if (address === null || typeof address === 'string') throw new Error('mock gateway did not bind a port')
  gatewayPort = address.port
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    gateway.close((error) => { if (error) reject(error); else resolve() })
  })
})

beforeEach(() => {
  gatewayRequests = []
})

/** The adapter body a real discovery implementation would run. */
async function fetchModels(baseURL: string): Promise<{ id: string; name?: string }[]> {
  const response = await fetch(`${baseURL}/models`, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw Object.assign(new Error(`provider refused: HTTP ${String(response.status)}`), {
      code: 'DISCOVERY_FAILED',
      status: response.status,
    })
  }
  const body = (await response.json()) as { data?: { id: string; name?: string }[] }
  return body.data ?? []
}

describe('discovery carries unsaved draft headers (section 72)', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })

  it('succeeds only because the draft header was applied', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()

    const headers = discoveryHeaders([], [{ name: GATE_HEADER, value: GATE_VALUE }])
    const outcome = await runDiscovery({
      llm: { discoverModels: (_ns, request) => fetchModels(request.baseURL ?? '') },
      run: (context, body) => runtime.run(context, body),
      providerId: 'gateway',
      request: { baseURL: `http://127.0.0.1:${String(gatewayPort)}`, api: 'openai-completions' },
      headers,
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.modelCount).toBe(2)
    expect(outcome.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(gatewayRequests[0]!.headers[GATE_HEADER]).toBe(GATE_VALUE)
    dispose()
  })

  it('fails with the provider status when the draft header is absent', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()

    const outcome = await runDiscovery({
      llm: { discoverModels: (_ns, request) => fetchModels(request.baseURL ?? '') },
      run: (context, body) => runtime.run(context, body),
      providerId: 'gateway',
      request: { baseURL: `http://127.0.0.1:${String(gatewayPort)}`, api: 'openai-completions' },
      headers: [],
    })

    expect(outcome.ok).toBe(false)
    expect(outcome.status).toBe(403)
    expect(outcome.errorCode).toBe('DISCOVERY_FAILED')
    expect(outcome.message).toContain('403')
    dispose()
  })

  it('lets the provider draft beat a global header of the same name', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()

    const headers = discoveryHeaders(
      [{ name: GATE_HEADER, value: 'global-wrong' }],
      [{ name: GATE_HEADER, value: GATE_VALUE }],
    )
    const outcome = await runDiscovery({
      llm: { discoverModels: (_ns, request) => fetchModels(request.baseURL ?? '') },
      run: (context, body) => runtime.run(context, body),
      providerId: 'gateway',
      request: { baseURL: `http://127.0.0.1:${String(gatewayPort)}`, api: 'openai-completions' },
      headers,
    })

    expect(outcome.ok).toBe(true)
    expect(gatewayRequests[0]!.headers[GATE_HEADER]).toBe(GATE_VALUE)
    dispose()
  })

  it('never lets a draft header displace the credential discovery resolved', async () => {
    const runtime = new HeaderRuntime()
    const dispose = runtime.install()

    const headers = discoveryHeaders([], [{ name: 'authorization', value: 'Bearer attacker-supplied' }])
    await runDiscovery({
      llm: {
        discoverModels: async (_ns, request) => {
          // Discovery forces its own credential over the route headers, exactly
          // as the adapter does.
          const response = await fetch(`${request.baseURL ?? ''}/models`, {
            headers: { authorization: 'Bearer real-key' },
          })
          return (await response.json() as { data?: { id: string }[] }).data ?? []
        },
      },
      run: (context, body) => runtime.run(context, body),
      providerId: 'gateway',
      request: { baseURL: `http://127.0.0.1:${String(gatewayPort)}`, api: 'openai-completions' },
      headers,
    })

    expect(gatewayRequests[0]!.headers.authorization).toBe('Bearer real-key')
    dispose()
  })

  it('reports a provider failure without echoing header values', () => {
    const facts = failureFacts(
      Object.assign(new Error(`refused with ${GATE_HEADER}: ${GATE_VALUE}`), { code: 'DISCOVERY_FAILED', status: 403 }),
    )
    // The message is passed through as untrusted display text, capped and
    // single-line — the caller must not treat it as a header echo channel.
    expect(facts.message).not.toContain('\n')
    expect(facts.message!.length).toBeLessThanOrEqual(241)
    expect(facts.status).toBe(403)
  })

  it('never throws on a hostile error object', () => {
    expect(failureFacts(null)).toEqual({ message: 'provider request failed' })
    expect(failureFacts({ code: 42, status: 'soon', message: 7 })).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Same-origin guard (section 52)
// ---------------------------------------------------------------------------

describe('request guard', () => {
  const loopback = '127.0.0.1'

  it('accepts a loopback GET', () => {
    expect(guardRequest('GET', { host: '127.0.0.1:3080' }, loopback)).toEqual({ ok: true })
  })

  it('rejects a non-loopback peer, so a LAN-bound server is not exposed', () => {
    expect(guardRequest('GET', { host: '127.0.0.1:3080' }, '192.168.1.20')).toMatchObject({ ok: false, status: 403 })
  })

  it('rejects a rebound Host header', () => {
    expect(guardRequest('GET', { host: 'evil.example.com' }, loopback)).toMatchObject({ ok: false, status: 403 })
  })

  it('rejects cross-site fetch metadata', () => {
    expect(guardRequest('GET', { host: 'localhost', 'sec-fetch-site': 'cross-site' }, loopback)).toMatchObject({ ok: false })
  })

  it('rejects a mismatched Origin', () => {
    expect(guardRequest('GET', { host: 'localhost:3080', origin: 'http://evil.test' }, loopback)).toMatchObject({ ok: false })
  })

  it('accepts a matching Origin', () => {
    expect(guardRequest('GET', { host: 'localhost:3080', origin: 'http://localhost:3080' }, loopback)).toEqual({ ok: true })
  })

  it('requires a JSON content type on writes', () => {
    expect(guardRequest('POST', { host: 'localhost', 'content-type': 'text/plain' }, loopback)).toMatchObject({
      ok: false,
      status: 415,
    })
    expect(guardRequest('POST', { host: 'localhost', 'content-type': 'application/json' }, loopback)).toEqual({ ok: true })
  })

  it('treats an IPv4-mapped loopback peer as loopback', () => {
    expect(guardRequest('GET', { host: 'localhost' }, '::ffff:127.0.0.1')).toEqual({ ok: true })
  })

  it('recognises loopback host spellings', () => {
    expect(isLoopbackHost('127.0.0.1:3080')).toBe(true)
    expect(isLoopbackHost('localhost')).toBe(true)
    expect(isLoopbackHost('[::1]:3080')).toBe(true)
    expect(isLoopbackHost('example.com')).toBe(false)
  })

  it('rejects a malformed Origin rather than guessing', () => {
    expect(isSameOrigin('not a url', 'localhost')).toBe(false)
  })

  it('caps the body well below a memory concern', () => {
    expect(MAX_BODY_BYTES).toBeLessThanOrEqual(512 * 1024)
  })
})

// ---------------------------------------------------------------------------
// RPC dispatch
// ---------------------------------------------------------------------------

/** Minimal in-memory response for the handler tests. */
function fakeResponse(): HttpResponseLike & { status?: number; body?: string } {
  const res: HttpResponseLike & { status?: number; body?: string } = {
    writeHead(status) { res.status = status },
    end(body) { res.body = body },
  }
  return res
}

/** Minimal request carrying an already-serialized body. */
function fakeRequest(method: string, body: unknown, headers: Record<string, string> = {}): HttpRequestLike {
  const listeners = new Map<string, ((...args: never[]) => void)[]>()
  const req: HttpRequestLike = {
    method,
    url: '/dsh-advanced-provider-settings/rpc',
    headers: { host: 'localhost:3080', 'content-type': 'application/json', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, listener) { listeners.set(event, [...(listeners.get(event) ?? []), listener]); return req },
    destroy() {},
  }
  // Deliver the body on the next tick so the handler can attach listeners.
  setTimeout(() => {
    const payload = Buffer.from(JSON.stringify(body))
    for (const listener of listeners.get('data') ?? []) (listener as (chunk: Buffer) => void)(payload)
    for (const listener of listeners.get('end') ?? []) listener()
  }, 0)
  return req
}

/** Route dependencies over a fixed fixture. */
function depsFixture(overrides: Partial<RouteDeps> = {}): RouteDeps {
  const settings: PluginSettings = { globalHeaders: { 'x-global': 'g', authorization: 'Bearer secret-value' } }
  const section = {
    providers: {
      gateway: {
        api: 'openai-completions',
        baseURL: 'https://gateway.test/v1',
        apiKeyEnv: 'GATEWAY_API_KEY',
        headers: { 'x-provider': 'p', 'user-agent': 'ignored-by-dsh' },
      } satisfies ProviderProfile,
    },
  }
  return {
    pluginVersion: '0.1.0',
    getOwnSettings: () => settings,
    getProviderSection: () => section,
    namespaces: () => ['llm-pi-ai', 'dsh-advanced-provider-settings'],
    writable: true,
    revisionSupported: true,
    headerRuntimeActive: true,
    headerRuntimeApplied: () => 12,
    routesRegistered: () => true,
    legacyValue: () => ({ globalHeaders: { 'x-legacy': 'l' } }),
    llm: { discoverModels: async () => [] },
    runWithHeaders: (_context, body) => body(),
    ...overrides,
  }
}

describe('RPC envelope', () => {
  it('answers the health route without a body', async () => {
    const handler = createRpcHandler(depsFixture())

    // The RPC endpoint is POST-only.
    const wrongMethod = fakeResponse()
    await handler(fakeRequest('GET', {}), wrongMethod)
    expect(wrongMethod.status).toBe(405)

    const health = fakeResponse()
    const request = fakeRequest('GET', {})
    request.url = '/dsh-advanced-provider-settings/health'
    await handler(request, health)
    expect(health.status).toBe(200)
    expect(JSON.parse(health.body!)).toMatchObject({ ok: true, plugin: 'dsh-advanced-provider-settings' })

    const unknown = fakeResponse()
    const other = fakeRequest('GET', {})
    other.url = '/dsh-advanced-provider-settings/something-else'
    await handler(other, unknown)
    expect(unknown.status).toBe(404)
  })

  it('rejects an unknown op by name without echoing the payload', async () => {
    const response = await dispatch(depsFixture(), { op: 'nope', payload: { secret: 'x' } })
    expect(response).toMatchObject({ ok: false, code: 'unknown-op' })
    expect(JSON.stringify(response)).not.toContain('secret')
  })

  it('refuses a cross-site request before dispatching', async () => {
    const handler = createRpcHandler(depsFixture())
    const res = fakeResponse()
    await handler(fakeRequest('POST', { op: 'diagnostics' }, { 'sec-fetch-site': 'cross-site' }), res)
    expect(res.status).toBe(403)
    expect(JSON.parse(res.body!)).toMatchObject({ code: 'refused' })
  })

  it('rejects a malformed body', async () => {
    const listeners = new Map<string, ((...args: never[]) => void)[]>()
    const req: HttpRequestLike = {
      method: 'POST',
      url: '/dsh-advanced-provider-settings/rpc',
      headers: { host: 'localhost', 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.1' },
      on(event, listener) { listeners.set(event, [...(listeners.get(event) ?? []), listener]); return req },
      destroy() {},
    }
    setTimeout(() => {
      for (const listener of listeners.get('data') ?? []) (listener as (chunk: Buffer) => void)(Buffer.from('{oops'))
      for (const listener of listeners.get('end') ?? []) listener()
    }, 0)
    const res = fakeResponse()
    await createRpcHandler(depsFixture())(req, res)
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body!)).toMatchObject({ code: 'invalid-json' })
  })

  it('turns a handler crash into an envelope, not a stack trace', async () => {
    const handler = createRpcHandler(depsFixture({
      getProviderSection: () => { throw new Error('boom at /Users/someone/secret/path') },
    }))
    const res = fakeResponse()
    await handler(fakeRequest('POST', { op: 'providers' }), res)
    expect(res.status).toBe(500)
    const body = JSON.parse(res.body!) as { code: string }
    expect(body.code).toBe('internal')
  })
})

describe('effective-headers op', () => {
  it('folds the three layers and masks sensitive values', async () => {
    const response = await dispatch(depsFixture(), { op: 'effective-headers', payload: { providerId: 'gateway' } })
    expect(response.ok).toBe(true)
    const result = response.result as {
      headers: { name: string; value: string; source: string; reserved: boolean; sensitive: boolean }[]
      advisories: { code: string; name: string }[]
      attributionOverridden: boolean
    }

    const byName = new Map(result.headers.map((header) => [header.name.toLowerCase(), header]))

    // Harness attribution is bottom of the stack and still reserved.
    expect(byName.get('user-agent')?.source).toBe('provider')
    expect(byName.get('user-agent')?.reserved).toBe(true)

    // The provider header wins over the global one.
    expect(byName.get('x-provider')?.source).toBe('provider')
    expect(byName.get('x-global')?.source).toBe('global')

    // A sensitive value never travels to the page in the clear.
    expect(byName.get('authorization')?.value).not.toContain('secret-value')
    expect(byName.get('authorization')?.sensitive).toBe(true)

    // The provider-level User-Agent is named as the header DSH will discard.
    expect(result.advisories.map((advisory) => advisory.code)).toEqual(['reserved-provider-header'])

    // Only a GLOBAL reserved header takes attribution over; a provider one is
    // stripped by Harness before it could.
    expect(result.attributionOverridden).toBe(false)
  })

  it('does not report an advisory when the provider declares none of them', () => {
    expect(headerAdvisories([{ name: 'x-fine', value: '1' }], 'KEY')).toEqual([])
    expect(headerAdvisories([{ name: 'authorization', value: 'x' }], undefined)).toEqual([])
  })

  it('names every provider header that can displace the resolved credential', () => {
    expect(headerAdvisories([{ name: 'Authorization', value: 'Bearer x' }], 'KEY')).toEqual([
      { code: 'authorization-with-credential', name: 'Authorization' },
    ])
    expect(headerAdvisories([{ name: 'x-api-key', value: 'k' }], 'KEY')).toEqual([
      { code: 'authorization-with-credential', name: 'x-api-key' },
    ])
  })

  it('knows when the global layer takes over attribution', () => {
    expect(overridesAttribution({ globalHeaders: { 'User-Agent': 'mine' } })).toBe(true)
    expect(overridesAttribution({ globalHeaders: { 'X-Other': 'mine' } })).toBe(false)
    expect(overridesAttribution(undefined)).toBe(false)
  })
})

describe('validate op', () => {
  it('reports a model-level compat field the protocol does not offer', async () => {
    const response = await dispatch(depsFixture(), {
      op: 'validate',
      payload: {
        profile: {
          api: 'anthropic-messages',
          compat: { supportsStore: true },
        },
      },
    })
    expect(response.ok).toBe(true)
    const issues = (response.result as { issues: { code: string; field: string }[] }).issues
    expect(issues).toContainEqual({ field: 'compat.supportsStore', code: 'compat-wrong-protocol', detail: 'anthropic-messages' })
  })

  it('flags an unknown compat key as one Harness would reject at model level', () => {
    const issues = validateProviderDraft({ api: 'openai-completions', compat: { inventedFlag: true } })
    expect(issues.some((issue) => issue.code === 'compat-unknown-field')).toBe(true)
  })

  it('flags the retry values the schema accepts and the resolver refuses', () => {
    const issues = validateProviderDraft({
      api: 'openai-completions',
      retryPolicy: { mode: 'normal', backoff: { initialDelayMs: 0 } },
    })
    expect(issues).toContainEqual({ field: 'retryPolicy.backoff.initialDelayMs', code: 'backoff-initial-invalid' })
  })

  it('flags a header that would inject a second header', () => {
    const issues = validateProviderDraft({ api: 'openai-completions', headers: { 'x-bad': 'a\r\nx-extra: 1' } })
    expect(issues.some((issue) => issue.code === 'header-crlf')).toBe(true)
  })

  it('accepts the defaults a Harness profile would carry', () => {
    expect(
      validateProviderDraft({
        api: 'openai-responses',
        headers: { 'x-ok': 'fine' },
        compat: { supportsDeveloperRole: true },
        models: [{ id: 'm', input: ['text', 'image'], reasoningEfforts: { low: 'low', high: null } }],
      }),
    ).toEqual([])
  })
})

describe('legacy op and migration', () => {
  it('proposes to import headers the new namespace does not already own', () => {
    expect(buildImportOps({ 'x-existing': '1' }, { 'X-Existing': '2', 'x-legacy': 'l' })).toEqual([
      { op: 'set', path: ['globalHeaders', 'x-legacy'], value: 'l' },
    ])
  })

  it('is a no-op when nothing needs importing', () => {
    expect(buildImportOps({}, {})).toEqual([])
  })

  it('drops an invalid legacy header instead of importing it', () => {
    const snapshot = inspectLegacy({
      namespaces: ['dsh-custom-provider-settings', 'dsh-advanced-provider-settings'],
      legacyValue: { globalHeaders: { 'x-good': '1', 'x-bad': 'a\r\nx-evil: 1' } },
      packageInstalled: true,
    })
    expect(snapshot.namespaceDetected).toBe(true)
    expect(snapshot.bothActive).toBe(true)
    expect(snapshot.packageInstalled).toBe(true)
    expect(snapshot.globalHeaders).toEqual({ 'x-good': '1' })
    expect(snapshot.rejectedCount).toBe(1)
    expect(hasImportableHeaders(snapshot)).toBe(true)
  })

  it('reports nothing to import when the legacy plugin is absent', () => {
    const snapshot = inspectLegacy({ namespaces: [], legacyValue: undefined, packageInstalled: false })
    expect(snapshot.namespaceDetected).toBe(false)
    expect(hasImportableHeaders(snapshot)).toBe(false)
  })
})

describe('diagnostics', () => {
  it('never throws and always names the verified build', () => {
    const report = buildDiagnostics({
      pluginVersion: '0.1.0',
      namespaces: ['dsh-advanced-provider-settings', 'llm-pi-ai'],
      writable: true,
      revisionSupported: true,
      headerRuntimeActive: true,
      headerRuntimeApplied: 3,
      routesRegistered: true,
    })
    expect(report.verifiedDshVersion).toBe('0.1.5-rc.2')
    expect(report.reservedHeaders).toEqual(['user-agent'])
    const byKey = new Map(report.probes.map((probe) => [probe.key, probe]))
    expect(byKey.get('settingsNamespace')?.state).toBe('ok')
    expect(byKey.get('providerNamespace')?.state).toBe('ok')
    expect(byKey.get('headerRuntime')?.detail).toBe('3')
  })

  it('degrades to "missing" rather than failing when a service is absent', () => {
    const report = buildDiagnostics({
      pluginVersion: '0.1.0',
      namespaces: [],
      writable: false,
      revisionSupported: false,
      headerRuntimeActive: false,
      headerRuntimeApplied: 0,
      routesRegistered: false,
    })
    for (const probe of report.probes) expect(['ok', 'missing', 'unknown']).toContain(probe.state)
    expect(report.probes.find((probe) => probe.key === 'settingsNamespace')?.state).toBe('missing')
  })
})

// ---------------------------------------------------------------------------
// Own-namespace registration (section 71)
// ---------------------------------------------------------------------------

describe('own settings registration', () => {
  /** A fake settings service holding one namespace's value. */
  function fakeSettings(initial: PluginSettings, user?: unknown, revision = 4) {
    let value = initial
    const watchers: ((next: PluginSettings, prev: PluginSettings) => void)[] = []
    const descriptors: SettingsDescriptorLike[] = [
      { ns: 'dsh-advanced-provider-settings', revision, ...(user === undefined ? {} : { user }) },
      { ns: 'llm-pi-ai', revision },
    ]
    return {
      registered: undefined as string | undefined,
      register(namespace: string, _schema: unknown) {
        this.registered = namespace
        return {
          get: () => value,
          watch(callback: (next: PluginSettings, prev: PluginSettings) => void) {
            watchers.push(callback)
            return () => { watchers.splice(watchers.indexOf(callback), 1) }
          },
        }
      },
      describe: () => descriptors,
      get: (namespace: string) => (namespace === 'dsh-advanced-provider-settings' ? value : undefined),
      writable: true,
      /** Test hook: commit a new value. */
      commit(next: PluginSettings) {
        const prev = value
        value = next
        for (const watcher of watchers) watcher(next, prev)
      },
    }
  }

  it('registers the namespace it was asked to own', () => {
    const settings = fakeSettings({})
    registerOwnSettings(settings)
    expect(settings.registered).toBe('dsh-advanced-provider-settings')
  })

  it('normalises an empty resolution to an empty object', () => {
    const handle = registerOwnSettings(fakeSettings(undefined as unknown as PluginSettings))
    expect(handle.get()).toEqual({})
  })

  it('exposes the raw user layer and revision that fence a write', () => {
    const handle = registerOwnSettings(fakeSettings({ globalHeaders: { a: '1' } }, { globalHeaders: { a: '1' } }, 9))
    expect(handle.userLayer()).toEqual({ globalHeaders: { a: '1' } })
    expect(handle.revision()).toBe(9)
  })

  it('reports no override when the raw layer is absent', () => {
    expect(registerOwnSettings(fakeSettings({})).userLayer()).toBeUndefined()
  })

  it('delivers committed changes to the watcher', () => {
    const settings = fakeSettings({})
    const seen: PluginSettings[] = []
    registerOwnSettings(settings).watch((next) => seen.push(next))
    settings.commit({ globalHeaders: { x: '1' } })
    expect(seen).toEqual([{ globalHeaders: { x: '1' } }])
  })
})

// ---------------------------------------------------------------------------
// Effective-header folding, end to end
// ---------------------------------------------------------------------------

describe('resolveEffectiveHeaders', () => {
  it('orders harness, then global, then provider, and marks only the reserved name', () => {
    const headers = resolveEffectiveHeaders({
      settings: { globalHeaders: { 'x-shared': 'global', 'x-global': '1' } },
      section: { providers: { p: { headers: { 'x-shared': 'provider' } } } },
      providerId: 'p',
      harnessVersion: '0.1.5-rc.2',
    })
    const byName = new Map(headers.map((header) => [header.name.toLowerCase(), header]))
    expect(byName.get('x-shared')?.value).toBe('provider')
    expect(byName.get('x-shared')?.source).toBe('provider')
    expect(byName.get('x-global')?.source).toBe('global')
    expect(byName.get('user-agent')?.reserved).toBe(true)
    expect(byName.get('user-agent')?.value).toContain('deepseek-harness/0.1.5-rc.2')
  })

  it('drops a hand-edited header that would break the wire', () => {
    const headers = resolveEffectiveHeaders({
      settings: { globalHeaders: { 'x-bad': 'a\r\nx-evil: 1' } },
      section: undefined,
      providerId: 'p',
    })
    expect(headers.some((header) => header.name === 'x-bad')).toBe(false)
  })

  it('returns just attribution for an unconfigured provider', () => {
    const headers = resolveEffectiveHeaders({ settings: undefined, section: undefined, providerId: 'missing' })
    expect(headers).toHaveLength(1)
    expect(headers[0]!.name).toBe('user-agent')
  })
})
