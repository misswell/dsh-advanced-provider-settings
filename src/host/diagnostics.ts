/**
 * Compatibility diagnostics (spec section 55).
 *
 * The panel exists so a bug report can state facts instead of symptoms. Every
 * probe here is read-only and none of them throws: a diagnostic that fails must
 * report "unsupported", never take the settings page down with it
 * (spec section 54).
 */
import { createRequire } from 'node:module'
import {
  PLUGIN_SETTINGS_NS,
  LEGACY_NAMESPACE,
  PROVIDER_NAMESPACE,
  RESERVED_HEADER_NAMES,
  VERIFIED_DSH_VERSION,
} from '../shared/capabilities.js'

/** One probe's outcome. */
export interface DiagnosticProbe {
  /** Stable key the client resolves through its locale files. */
  key: string
  /** `ok`, `missing` or `unknown`. */
  state: 'ok' | 'missing' | 'unknown'
  /** Small, safe detail string — never a path from the user's home directory. */
  detail?: string
}

/** Everything the host half can report about compatibility. */
export interface DiagnosticsReport {
  pluginVersion: string
  verifiedDshVersion: string
  detectedDshVersion?: string
  probes: DiagnosticProbe[]
  reservedHeaders: readonly string[]
}

/**
 * Candidate packages whose version identifies the running DSH build, each
 * resolved through a literal specifier. The probe list is compile-time
 * knowledge, so the resolution is written as one literal require per candidate
 * rather than a loop over a variable — an injection-shaped call no reviewer or
 * scanner should have to re-justify.
 */
const VERSION_PROBE_PACKAGES: readonly { specifier: string; manifest: () => unknown }[] = (() => {
  const req = createRequire(import.meta.url)
  return [
    { specifier: '@deepseek-ai/dsh/package.json', manifest: () => req('@deepseek-ai/dsh/package.json') },
    { specifier: '@deepseek-ai/dsh-llm-pi-ai/package.json', manifest: () => req('@deepseek-ai/dsh-llm-pi-ai/package.json') },
    { specifier: '@deepseek-ai/dsh-settings/package.json', manifest: () => req('@deepseek-ai/dsh-settings/package.json') },
  ]
})()

/**
 * The runtime-directory layout the Desk app launches the harness from:
 * `.../runtime/dsh/<version>/...`. An argv entry naming that directory is the
 * most truthful version signal available, because it names the RUNNING build.
 */
const RUNTIME_PATH_VERSION = /[\\/]runtime[\\/]dsh[\\/]([^/\\()\s]+)[\\/]/

/**
 * Read the running build's version out of the process command line.
 *
 * The module-resolution probes below answer "which @deepseek-ai copy does THIS
 * module see" — and that can differ from the running build, because a profile
 * is linked into a hoisted `node_modules` whose `@deepseek-ai` entries are
 * symlinks to whichever runtime was current when it was installed (observed:
 * 0.1.5-rc.2 links while 0.2.0-rc.2 runs). The harness process itself is
 * launched from the runtime directory, so its command line names the true
 * version.
 *
 * @returns the version segment, or undefined when no argv entry matches.
 */
/**
 * Pull the version segment out of launch-path entries.
 *
 * Exported as a pure function so tests can feed argv shapes without touching
 * the runner's own process state.
 *
 * @param entries - candidate path strings (execPath + argv), any values.
 * @returns the version segment, or undefined when no entry matches.
 */
export function versionFromLaunchPath(entries: readonly unknown[]): string | undefined {
  for (const entry of entries) {
    if (typeof entry !== 'string' || entry.length === 0) continue
    const version = entry.match(RUNTIME_PATH_VERSION)?.[1]
    if (version !== undefined) return version
  }
  return undefined
}

/** The process's own launch paths, most specific first. */
function launchPathEntries(): unknown[] {
  return [process.execPath, ...process.argv]
}

function versionFromArgv(): string | undefined {
  return versionFromLaunchPath(launchPathEntries())
}

/**
 * Best-effort read of the running DSH version.
 *
 * The value is advisory: it feeds a diagnostic line and the compatibility
 * matrix, and nothing branches on it. A failure returns undefined rather than
 * throwing, because a plugin that cannot report a version is still useful.
 *
 * @returns the version string, or undefined when it cannot be read.
 */
export function detectDshVersion(): string | undefined {
  const fromArgv = versionFromArgv()
  if (fromArgv !== undefined) return fromArgv
  try {
    for (const { manifest } of VERSION_PROBE_PACKAGES) {
      try {
        const read = manifest() as { version?: unknown }
        if (typeof read.version === 'string' && read.version.length > 0) return read.version
      } catch {
        // Try the next candidate; a missing peer is not a diagnostic failure.
        continue
      }
    }
  } catch {
    return undefined
  }
  return undefined
}

/**
 * Whether the models-page extension package is installed. Resolved through a
 * literal specifier: the candidate is compile-time knowledge, and a variable
 * require is an injection-shaped call.
 */
export function isModelsExtensionInstalled(): boolean {
  try {
    createRequire(import.meta.url)('@deepseek-ai/dsh-client-ui-settings-models/package.json')
    return true
  } catch {
    return false
  }
}

/**
 * Whether the retired community plugin is still installed beside this one.
 * Resolved through a literal specifier for the same reason.
 */
export function isLegacyPluginInstalled(): boolean {
  try {
    createRequire(import.meta.url)('dsh-custom-provider-settings/package.json')
    return true
  } catch {
    return false
  }
}

/**
 * Whether the 0.2.0 retry executor is installed.
 *
 * Since DSH 0.2.0 the `retryPolicy` each provider route declares is EXECUTED by
 * the optional `dsh-llm-retry` plugin on the agent loop's request-recovery
 * extension point; the adapter only resolves the policy. Standard
 * compositions (`dsh-sdk-minimal`) include it, but a minimal composition
 * without it leaves every configured policy inert — which looks exactly like a
 * plugin bug, so the diagnostics name the executor rather than stay silent.
 * Resolved through a literal specifier, like every probe here.
 */
export function isRetryExecutorInstalled(): boolean {
  try {
    createRequire(import.meta.url)('@deepseek-ai/dsh-llm-retry/package.json')
    return true
  } catch {
    return false
  }
}

/** Inputs the host half can observe cheaply. */
export interface DiagnosticsInput {
  pluginVersion: string
  /** Namespaces the settings service currently serves. */
  namespaces: readonly string[]
  /** Whether the settings document accepts writes. */
  writable: boolean
  /** Whether any descriptor carried a revision number. */
  revisionSupported: boolean
  /** Whether the request-scoped header bridge installed its fetch wrapper. */
  headerRuntimeActive: boolean
  /** Requests the bridge has applied headers to. */
  headerRuntimeApplied: number
  /** Whether the web-server route table accepted our routes. */
  routesRegistered: boolean
}

/**
 * Assemble the diagnostics report.
 * @param input - the observed host facts.
 * @returns the report the settings panel renders.
 */
export function buildDiagnostics(input: DiagnosticsInput): DiagnosticsReport {
  const detected = detectDshVersion()
  const versionVerified = detected !== undefined && detected === VERIFIED_DSH_VERSION
  const probes: DiagnosticProbe[] = [
    {
      key: 'dshVersion',
      state: detected === undefined ? 'unknown' : 'ok',
      detail: detected ?? 'unresolved',
    },
    {
      key: 'versionMatch',
      // `ok` means the constants in capabilities.ts were verified against
      // exactly this build. Anything else is a drift signal for bug reports,
      // not an error: an unverified combination may still work.
      state: versionVerified ? 'ok' : 'unknown',
      ...(detected === undefined || versionVerified
        ? {}
        : { detail: `${detected} vs ${VERIFIED_DSH_VERSION}` }),
    },
    {
      key: 'settingsNamespace',
      // The settings directory is keyed by profile ENTRY id, which this bundle's
      // patch layer sets to `advanced-provider-settings` — not to the package
      // name. Probing the package name reads "missing" on a healthy install.
      state: input.namespaces.includes(PLUGIN_SETTINGS_NS) ? 'ok' : 'missing',
      detail: PLUGIN_SETTINGS_NS,
    },
    {
      key: 'providerNamespace',
      state: input.namespaces.includes(PROVIDER_NAMESPACE) ? 'ok' : 'missing',
      detail: PROVIDER_NAMESPACE,
    },
    { key: 'settingsRevision', state: input.revisionSupported ? 'ok' : 'unknown' },
    { key: 'settingsWritable', state: input.writable ? 'ok' : 'missing' },
    { key: 'headerRuntime', state: input.headerRuntimeActive ? 'ok' : 'missing', detail: String(input.headerRuntimeApplied) },
    { key: 'settingsRoutes', state: input.routesRegistered ? 'ok' : 'missing' },
    {
      key: 'retryExecutor',
      state: isRetryExecutorInstalled() ? 'ok' : 'missing',
      detail: '@deepseek-ai/dsh-llm-retry',
    },
    {
      key: 'modelsExtensionPackage',
      state: isModelsExtensionInstalled() ? 'ok' : 'missing',
      detail: '@deepseek-ai/dsh-client-ui-settings-models',
    },
    {
      key: 'legacyNamespace',
      state: input.namespaces.includes(LEGACY_NAMESPACE) ? 'ok' : 'missing',
      detail: LEGACY_NAMESPACE,
    },
    {
      key: 'legacyPlugin',
      state: isLegacyPluginInstalled() ? 'ok' : 'missing',
      detail: 'dsh-custom-provider-settings',
    },
  ]

  return {
    pluginVersion: input.pluginVersion,
    verifiedDshVersion: VERIFIED_DSH_VERSION,
    ...(detected === undefined ? {} : { detectedDshVersion: detected }),
    probes,
    reservedHeaders: [...RESERVED_HEADER_NAMES],
  }
}
