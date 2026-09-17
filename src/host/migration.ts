/**
 * Migration from the retired community plugin `dsh-custom-provider-settings`
 * (spec sections 50, 51).
 *
 * The old plugin stored exactly one thing of its own: a `globalHeaders` mapping
 * under its own namespace. Everything else it wrote already lives in Harness's
 * `llm-pi-ai` namespace (`providers.<id>.headers`, `.reasoning`, `.compat`,
 * `models[].input`, `models[].reasoningEfforts`), so reading that section is
 * literally the migration — there is nothing to copy (spec section 50).
 *
 * This module therefore only ever proposes to move the header mapping, and it
 * never writes: the client performs the write with its revision fence like any
 * other edit.
 */
import { LEGACY_NAMESPACE, PLUGIN_NAMESPACE } from '../shared/capabilities.js'
import { headerEntriesOf, validateHeader } from '../shared/headers.js'

/** What the host observed about the legacy plugin. */
export interface LegacySnapshot {
  /** Whether the legacy namespace is served by the settings document. */
  namespaceDetected: boolean
  /** Whether the legacy plugin package is installed. */
  packageInstalled: boolean
  /** Whether both plugins are active at once — the duplicate-header hazard. */
  bothActive: boolean
  /** The legacy header mapping, already validated, ready to import. */
  globalHeaders: Record<string, string>
  /** How many legacy headers were discarded as invalid. */
  rejectedCount: number
}

/**
 * Read the legacy namespace out of the settings document.
 * @param options - resolved namespaces and the legacy value.
 * @returns the snapshot the migration prompt renders from.
 */
export function inspectLegacy(options: {
  namespaces: readonly string[]
  legacyValue: unknown
  packageInstalled: boolean
}): LegacySnapshot {
  const namespaceDetected = options.namespaces.includes(LEGACY_NAMESPACE)
  const raw = extractGlobalHeaders(options.legacyValue)
  const globalHeaders: Record<string, string> = {}
  let rejectedCount = 0
  for (const entry of headerEntriesOf(raw)) {
    if (validateHeader(entry.name, entry.value).ok) globalHeaders[entry.name] = entry.value
    else rejectedCount += 1
  }

  return {
    namespaceDetected,
    packageInstalled: options.packageInstalled,
    bothActive: namespaceDetected && options.namespaces.includes(PLUGIN_NAMESPACE),
    globalHeaders,
    rejectedCount,
  }
}

/** Pull `globalHeaders` out of a legacy value of unknown shape. */
function extractGlobalHeaders(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null || typeof value !== 'object') return undefined
  const headers = (value as { globalHeaders?: unknown }).globalHeaders
  if (headers === undefined || headers === null || typeof headers !== 'object') return undefined
  return headers as Record<string, unknown>
}

/**
 * Whether there is anything worth importing.
 * @param snapshot - the legacy snapshot.
 * @returns whether the migration prompt should be offered.
 */
export function hasImportableHeaders(snapshot: LegacySnapshot): boolean {
  return snapshot.namespaceDetected && Object.keys(snapshot.globalHeaders).length > 0
}

/**
 * Build the operations that import the legacy headers without disturbing
 * headers the user has already set in this plugin.
 *
 * An existing key in the new namespace wins, so a user who configured both
 * plugins keeps the configuration they made most recently.
 *
 * @param existing - this plugin's current global headers.
 * @param incoming - the legacy mapping.
 * @returns path-addressed operations against the plugin namespace.
 */
export function buildImportOps(
  existing: Record<string, string>,
  incoming: Record<string, string>,
): { op: 'set'; path: string[]; value: string }[] {
  const taken = new Set(Object.keys(existing).map((name) => name.toLowerCase()))
  const ops: { op: 'set'; path: string[]; value: string }[] = []
  for (const [name, value] of Object.entries(incoming)) {
    if (taken.has(name.toLowerCase())) continue
    ops.push({ op: 'set', path: ['globalHeaders', name], value })
  }
  return ops
}
