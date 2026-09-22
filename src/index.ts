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
 *  1. The entry `Config` schema, which IS this plugin's settings namespace: the
 *     settings service derives the namespace both halves read from the
 *     `.volatile()` fields declared here, keyed by this entry's id.
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
import { LEGACY_NAMESPACE, PLUGIN_NAMESPACE, PLUGIN_SETTINGS_NS, PLUGIN_VERSION, PROVIDER_NAMESPACE } from './shared/capabilities.js'
import { globalHeaderEntries } from './host/header-resolver.js'
import { HeaderRuntime, type RequestHeaderContext } from './host/header-runtime.js'
import { readProviderSection } from './host/provider-config.js'
import { registerRoutes, type RouteDeps, type WebServerLike } from './host/routes.js'
import {
  namespaceValue,
  ownSettingsOf,
  servedNamespaces,
  PluginSettingsConfig,
  type OwnConfig,
  type SettingsServiceLike,
} from './host/settings.js'
import type { ProviderNamespaceSection } from './shared/types.js'

/** Cordis plugin name; must equal the package name the bundle is registered under. */
export const name = PLUGIN_NAMESPACE

/**
 * This plugin's settings, as its profile entry config.
 *
 * Every field the browser edits carries `.volatile()`; an entry with none gets
 * no namespace at all, and the browser half would find nothing to bind to.
 */
export const Config = PluginSettingsConfig


/**
 * Services required before `apply` runs.
 *
 * `webServer` is deliberately absent: a headless composition has no web server,
 * and the header bridge is useful there on its own. The web routes are attached
 * through a child fiber instead — see `apply`.
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
  /** This plugin's own fiber, which owns the settings page policy. */
  fiber: unknown
  /** Present only once the composition has provided the web server. */
  webServer?: WebServerLike
  /** Resolve an optional service; undefined when the composition omits it. */
  get: (service: string) => unknown
  /**
   * Open a child fiber that waits for services this plugin does not require.
   *
   * The child sees them as resolved properties; it is disposed with this fiber.
   */
  inject: (deps: readonly string[], callback: (child: HostContext) => void) => unknown
  /** Register a teardown for the calling fiber. */
  effect: (body: () => void | (() => void), label?: string) => void
  /** Subscribe to a waterfall event; returns a disposer. */
  on: (event: string, handler: (...args: never[]) => unknown) => unknown
}

/** One profile row as the config editor reports it. */
interface ProfileRowLike {
  entry?: { options?: { id?: string } }
  /** The raw user layer written into the active profile patch. */
  override?: Record<string, unknown>
}

/** The settings-free view of the profile editor, used for legacy detection. */
interface ConfigEditorLike {
  configuration: () => readonly ProfileRowLike[]
}

/**
 * Mount the host half.
 *
 * @param rawContext - the plugin's host context. Everything registered here is
 *   torn down with the fiber, including the `fetch` wrapper when this plugin is
 *   the last holder.
 * @param rawConfig - this entry's resolved config, every field a live reader.
 */
export function apply(rawContext: unknown, rawConfig: unknown): void {
  const ctx = rawContext as HostContext
  const config = rawConfig as OwnConfig
  const settings = ctx.settings
  const llm = ctx.llm

  const runtime = new HeaderRuntime()

  ctx.on('llm/stream', ((options: StreamOptions, next: () => AsyncIterable<unknown>) => {
    const headers = globalHeaderEntries(ownSettingsOf(config))
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

  // Subscribed before installed, so a stream begun between the two still passes
  // through the bridge rather than finding the wrapper not yet in place.

  // Refcounted and restoring: unloading this plugin leaves the process's fetch
  // exactly as it was found (section 14).
  ctx.effect(() => runtime.install(), 'advanced-provider-settings: request-scoped header bridge')

  // This plugin ships its own settings page, so the generated one is turned off
  // for this entry. Calling it twice for one instance throws, hence the effect:
  // unloading the plugin removes the policy along with everything else.
  ctx.effect(
    () => settings.configure({ auto: false }, ctx.fiber),
    'advanced-provider-settings: own settings page',
  )

  // The retired plugin is written against the old settings API, so it may hold
  // headers in its profile config while exposing no settings namespace. Read the
  // profile rows too, or the duplicate-header hazard goes quiet.
  const editor = ctx.get('configEditor') as ConfigEditorLike | undefined
  const profileRows = (): readonly ProfileRowLike[] => editor?.configuration() ?? []
  const profileEntryIds = (): string[] => profileRows()
    .map((row) => row.entry?.options?.id)
    .filter((id): id is string => typeof id === 'string')
  const profileEntryConfig = (id: string): Record<string, unknown> | undefined =>
    profileRows().find((row) => row.entry?.options?.id === id)?.override

  let routesRegistered = false
  const deps: RouteDeps = {
    pluginVersion: PLUGIN_VERSION,
    getOwnSettings: () => ownSettingsOf(config),
    getProviderSection: (): ProviderNamespaceSection | undefined => readProviderSection(settings),
    namespaces: () => [...new Set([...servedNamespaces(settings), ...profileEntryIds()])],
    writable: settings.writable === true,
    revisionSupported: settings
      .describe()
      .every((descriptor) => typeof descriptor.revision === 'number'),
    headerRuntimeActive: runtime.isInstalled,
    headerRuntimeApplied: () => runtime.appliedCount,
    routesRegistered: () => routesRegistered,
    legacyValue: () => namespaceValue(settings, LEGACY_NAMESPACE) ?? profileEntryConfig(LEGACY_NAMESPACE),
    llm,
    runWithHeaders: (context, body) => runtime.run(context, body),
  }

  // Duplicate header sources are the one configuration this plugin cannot
  // reconcile: both plugins write the same wire headers and neither can see the
  // other's intent. Say so once rather than silently sending both (section 51).
  // Checked after the bridge is installed, so the duplicate really is on the wire
  // by the time this warns — which is what makes the message true.
  if (profileEntryIds().includes(LEGACY_NAMESPACE) || namespaceValue(settings, LEGACY_NAMESPACE) !== undefined) {
    ctx.logger.warn(
      '%s and dsh-custom-provider-settings are both installed; both inject request headers. Uninstall one to avoid duplicate headers.',
      PLUGIN_NAMESPACE,
    )
  }

  // The routes must not be reached through `ctx.get('webServer')` at this point:
  // this entry is independent of the web server, so it activates BEFORE that
  // service exists and the read comes back undefined — which leaves every
  // server-backed feature (discovery, the legacy probe, diagnostics) dead with
  // nothing logged. `ctx.inject` opens a child fiber that waits for the service
  // instead, so a composition that never has one still mounts the header bridge.
  ctx.inject(['webServer'], (scoped: HostContext) => {
    const webServer = scoped.webServer
    if (webServer === undefined) return
    scoped.effect(
      () => registerRoutes(webServer, deps, (registered) => { routesRegistered = registered }),
      'advanced-provider-settings: settings RPC routes',
    )
  })
}

/** Namespaces this plugin touches, for tests and documentation. */
export const namespaces = { own: PLUGIN_SETTINGS_NS, providers: PROVIDER_NAMESPACE } as const

