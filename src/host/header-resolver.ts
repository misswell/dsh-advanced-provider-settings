/**
 * Header resolution shared by the runtime, the Effective Headers preview and
 * the Discover Models RPC.
 *
 * One function decides the layers, so a preview can never disagree with what
 * the transport actually sends (spec section 19).
 */
import {
  PROVIDER_NAMESPACE,
  RESERVED_HEADER_NAMES,
  attributionUserAgent,
  isReservedHeader,
} from '../shared/capabilities.js'
import {
  effectiveHeaders,
  headerEntriesOf,
  validateHeader,
  type HeaderEntry,
  type HeaderLayer,
  type ResolvedHeader,
} from '../shared/headers.js'
import type { PluginSettings, ProviderProfile, ProviderNamespaceSection } from '../shared/types.js'

/** The attribution layer Harness always contributes, for preview and warnings. */
export function harnessHeaderLayer(version?: string): HeaderLayer {
  return {
    source: 'harness',
    headers: [{ name: 'user-agent', value: attributionUserAgent(version) }],
  }
}

/**
 * Read the global header mapping out of this plugin's own settings.
 *
 * Invalid entries are dropped rather than passed on: an edit made by hand in
 * `settings.yaml` must not be able to inject a header (section 18).
 * @param settings - this plugin's resolved settings.
 * @returns validated global headers, in stored order.
 */
export function globalHeaderEntries(settings: PluginSettings | undefined): HeaderEntry[] {
  const record = settings?.globalHeaders
  if (record === undefined || record === null) return []
  return headerEntriesOf(record).filter((entry) => validateHeader(entry.name, entry.value).ok)
}

/**
 * Read a provider's header mapping out of the `llm-pi-ai` section.
 * @param section - the resolved `llm-pi-ai` value.
 * @param providerId - route id.
 * @returns validated provider headers.
 */
export function providerHeaderEntries(
  section: ProviderNamespaceSection | undefined,
  providerId: string,
): HeaderEntry[] {
  const profile = section?.providers?.[providerId]
  return headerEntriesOf(profile?.headers).filter((entry) => validateHeader(entry.name, entry.value).ok)
}

/**
 * Compute the effective headers for one provider.
 * @param options - the settings layers to fold.
 * @returns effective headers with source and reserved flags, in override order.
 */
export function resolveEffectiveHeaders(options: {
  settings: PluginSettings | undefined
  section: ProviderNamespaceSection | undefined
  providerId: string
  harnessVersion?: string
}): ResolvedHeader[] {
  return effectiveHeaders(
    [
      harnessHeaderLayer(options.harnessVersion),
      { source: 'global', headers: globalHeaderEntries(options.settings) },
      { source: 'provider', headers: providerHeaderEntries(options.section, options.providerId) },
    ],
    RESERVED_HEADER_NAMES,
  )
}

/** A provider header the user should be told about before trusting it. */
export interface HeaderAdvisory {
  /** `reserved` — Harness overwrites it. `credential` — it can defeat the stored key. */
  code: 'reserved-provider-header' | 'credential-overrides-key' | 'authorization-with-credential'
  /** The offending header name as the user wrote it. */
  name: string
}

/**
 * Explain the two provider-header traps this DSH version actually has.
 *
 * Both were verified against the installed build and both are silent at
 * runtime, which is exactly why the UI has to say them out loud:
 *
 *  - `requestHeaders()` strips any provider header named `user-agent` before
 *    adding Harness attribution, so a provider-level User-Agent never reaches
 *    the wire.
 *  - `authorization` is NOT reserved. On the OpenAI protocols a configured
 *    `authorization` header replaces the resolved credential — which looks like
 *    "my key stopped working" rather than "my header overrode it".
 *
 * @param providerHeaders - the provider's configured headers.
 * @param credentialRef - the profile's `apiKeyEnv`, when it names one.
 * @returns advisories for the UI, empty when nothing is risky.
 */
export function headerAdvisories(
  providerHeaders: readonly HeaderEntry[],
  credentialRef: string | undefined,
): HeaderAdvisory[] {
  const advisories: HeaderAdvisory[] = []
  for (const header of providerHeaders) {
    const lower = header.name.toLowerCase()
    if (isReservedHeader(header.name)) {
      advisories.push({ code: 'reserved-provider-header', name: header.name })
      continue
    }
    if ((lower === 'authorization' || lower === 'x-api-key') && credentialRef !== undefined) {
      advisories.push({ code: 'authorization-with-credential', name: header.name })
    }
  }
  return advisories
}

/** Whether the global layer overrides Harness attribution on the wire. */
export function overridesAttribution(settings: PluginSettings | undefined): boolean {
  return globalHeaderEntries(settings).some((entry) => isReservedHeader(entry.name))
}

/**
 * Extract the provider sub-section the header resolver needs.
 * @param resolved - the resolved `llm-pi-ai` value, whatever shape it has.
 * @returns a narrow view, or undefined when the namespace is absent.
 */
export function providerSectionOf(resolved: unknown): ProviderNamespaceSection | undefined {
  if (resolved === undefined || resolved === null || typeof resolved !== 'object') return undefined
  const providers = (resolved as { providers?: unknown }).providers
  if (providers === undefined || providers === null || typeof providers !== 'object') {
    return { providers: {} }
  }
  return { providers: providers as Record<string, ProviderProfile> }
}

/** The settings namespace whose providers this plugin configures. */
export const CONFIGURED_NAMESPACE = PROVIDER_NAMESPACE
