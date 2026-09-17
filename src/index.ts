/**
 * Host half of Advanced Provider Settings for DeepSeek Harness.
 *
 * The host half is deliberately small, because the settings document already
 * has a writer: the browser half edits `llm-pi-ai` through the framework's own
 * revision-fenced settings transport. Duplicating that here would mean two
 * writers racing on `expectedRevision`.
 *
 * So the host owns exactly the four things a browser cannot:
 *
 *  1. Registration of this plugin's OWN namespace. A client can only bind to a
 *     namespace some host plugin registered, so this has to happen here.
 *  2. The request-scoped global-header bridge, which needs `node:async_hooks`
 *     and the process-wide `fetch` seam.
 *  3. Read-only diagnostics, which need the process and the module graph.
 *  4. The Discover Models probe, which needs the `llm` service and a transport
 *     the browser cannot reach (an endpoint that rejects CORS preflights is
 *     precisely the case this feature exists for).
 *
 * Nothing here writes settings, and nothing here reads a credential.
 *
 * The cordis context is described structurally below rather than imported, so
 * this module states exactly which services it needs and no more.
 */
import { PLUGIN_NAMESPACE, PLUGIN_VERSION, PROVIDER_NAMESPACE } from './shared/capabilities.js'
import { globalHeaderEntries } from './host/header-resolver.js'
import { HeaderRuntime, type RequestHeaderContext } from './host/header-runtime.js'
import { readOwnSettings, readProviderSection } from './host/provider-config.js'
import { registerRoutes, type RouteDeps, type WebServerLike } from './host/routes.js'
import { registerOwnSettings, type SettingsServiceLike } from './host/settings.js'
import type { ProviderNamespaceSection } from './shared/types.js'

/** Cordis plugin name; must equal the package name the bundle is registered under. */
export const name = PLUGIN_NAMESPACE

/**
 * Services required before `apply` runs.
 *
 * `webServer` is deliberately absent: a headless composition has no web server,
 * and the header bridge is useful there on its own. The web routes are attached
 * opportunistically instead.
 */
export const inject = ['settings', 'llm']

/** One discovered model, as the adapter reports it. */
export interface DiscoveredModelLike {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
}

/** The slice of the LLM service the discovery probe needs. */
export interface LlmServiceLike {
  discoverModels: (
    settingsNs: string,
    request: { provider?: string; baseURL?: string; api?: string; apiKey?: string },
    signal?: AbortSignal,
  ) => Promise<DiscoveredModelLike[]>
}

/** Request options the `llm/stream` waterfall hands each listener. */
interface StreamOptions {
  provider?: string
  model?: string
}

/** The subset of the cordis context this plugin uses. */
export interface HostContext {
  settings: SettingsServiceLike
  llm: LlmServiceLike
  logger: { warn: (message: string, ...args: unknown[]) => void }
  /** Resolve an optional service; undefined when the composition omits it. */
  get: (service: string) => unknown
  /** Register a teardown for the calling fiber. */
  effect: (body: () => void | (() => void), label?: string) => void
  /** Subscribe to a waterfall event; returns a disposer. */
  on: (event: string, handler: (...args: never[]) => unknown) => unknown
}

/**
 * Mount the host half.
 *
 * @param rawContext - the plugin's host context. Everything registered here is
 *   torn down with the fiber, including the `fetch` wrapper when this plugin is
 *   the last holder.
 */
export function apply(rawContext: unknown): void {
  const ctx = rawContext as HostContext
  const settings = ctx.settings
  const llm = ctx.llm

  const own = registerOwnSettings(settings)
  const runtime = new HeaderRuntime()

  // Refcounted and restoring: unloading this plugin leaves the process's fetch
  // exactly as it was found (section 14).
  ctx.effect(() => runtime.install(), 'advanced-provider-settings: request-scoped header bridge')

  ctx.on('llm/stream', ((options: StreamOptions, next: () => AsyncIterable<unknown>) => {
    const headers = globalHeaderEntries(own.get())
    if (headers.length === 0) return next()

    const context: RequestHeaderContext = {
      provider: typeof options?.provider === 'string' ? options.provider : '',
      model: typeof options?.model === 'string' ? options.model : '',
      headers,
    }

    // `next()` runs inside the scope so an adapter that starts its request
    // eagerly is covered too; `scopedStream` re-enters the scope for every
    // later pull, which is where the request is usually begun.
    return runtime.run(context, () => runtime.scopedStream(context, next()))
  }) as never)

  // Duplicate header sources are the one configuration this plugin cannot
  // reconcile: both plugins write the same wire headers and neither can see the
  // other's intent. Say so once rather than silently sending both (section 51).
  if (settings.describe().some((descriptor) => descriptor.ns === 'dsh-custom-provider-settings')) {
    ctx.logger.warn(
      '%s and dsh-custom-provider-settings are both installed; both inject request headers. Uninstall one to avoid duplicate headers.',
      PLUGIN_NAMESPACE,
    )
  }

  let routesRegistered = false
  const webServer = ctx.get('webServer') as WebServerLike | undefined
  if (webServer !== undefined && typeof webServer.register === 'function') {
    const deps: RouteDeps = {
      pluginVersion: PLUGIN_VERSION,
      getOwnSettings: () => readOwnSettings(settings),
      getProviderSection: (): ProviderNamespaceSection | undefined => readProviderSection(settings),
      namespaces: () => settings.describe().map((descriptor) => descriptor.ns),
      writable: settings.writable === true,
      revisionSupported: settings
        .describe()
        .every((descriptor) => typeof descriptor.revision === 'number'),
      headerRuntimeActive: runtime.isInstalled,
      headerRuntimeApplied: () => runtime.appliedCount,
      routesRegistered: () => routesRegistered,
      legacyValue: () => settings.get('dsh-custom-provider-settings'),
      llm,
      runWithHeaders: (context, body) => runtime.run(context, body),
    }
    ctx.effect(
      () => registerRoutes(webServer, deps, (registered) => { routesRegistered = registered }),
      'advanced-provider-settings: settings RPC routes',
    )
  }
}

/** Namespaces this plugin touches, for tests and documentation. */
export const namespaces = { own: PLUGIN_NAMESPACE, providers: PROVIDER_NAMESPACE } as const
