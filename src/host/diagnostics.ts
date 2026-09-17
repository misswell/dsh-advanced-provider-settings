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
  PLUGIN_NAMESPACE,
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

/** Candidate packages whose version identifies the running DSH build. */
const VERSION_PROBE_PACKAGES = [
  '@deepseek-ai/dsh/package.json',
  '@deepseek-ai/dsh-llm-pi-ai/package.json',
  '@deepseek-ai/dsh-settings/package.json',
]

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
  try {
    const require = createRequire(import.meta.url)
    for (const specifier of VERSION_PROBE_PACKAGES) {
      try {
        const manifest = require(specifier) as { version?: unknown }
        if (typeof manifest.version === 'string' && manifest.version.length > 0) return manifest.version
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
 * Whether a package is installed and resolvable from the plugin.
 * @param specifier - a `package.json` specifier to resolve.
 * @returns whether resolution succeeded.
 */
export function isPackageInstalled(specifier: string): boolean {
  try {
    createRequire(import.meta.url)(specifier)
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
  const probes: DiagnosticProbe[] = [
    {
      key: 'dshVersion',
      state: detected === undefined ? 'unknown' : 'ok',
      detail: detected ?? 'unresolved',
    },
    {
      key: 'settingsNamespace',
      state: input.namespaces.includes(PLUGIN_NAMESPACE) ? 'ok' : 'missing',
      detail: PLUGIN_NAMESPACE,
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
      key: 'modelsExtensionPackage',
      state: isPackageInstalled('@deepseek-ai/dsh-client-ui-settings-models/package.json') ? 'ok' : 'missing',
      detail: '@deepseek-ai/dsh-client-ui-settings-models',
    },
    {
      key: 'legacyNamespace',
      state: input.namespaces.includes(LEGACY_NAMESPACE) ? 'ok' : 'missing',
      detail: LEGACY_NAMESPACE,
    },
    {
      key: 'legacyPlugin',
      state: isPackageInstalled('dsh-custom-provider-settings/package.json') ? 'ok' : 'missing',
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
