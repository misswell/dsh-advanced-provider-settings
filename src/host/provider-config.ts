/**
 * Reading provider configuration on the host.
 *
 * The host half only ever READS `llm-pi-ai`; writes go through the settings
 * transport from the browser half so they carry the client's revision fence.
 * Keeping a single writer avoids two paths disagreeing about `expectedRevision`.
 */
import {
  PROVIDER_NAMESPACE,
} from '../shared/capabilities.js'
import { namespaceValue, type SettingsServiceLike } from './settings.js'
import type { ProviderNamespaceSection, ProviderProfile } from '../shared/types.js'
import { providerSectionOf } from './header-resolver.js'

/** One configured provider route, as the host sees it. */
export interface HostProviderRecord {
  providerId: string
  displayName: string
  profile: ProviderProfile
}

/**
 * Read the resolved `llm-pi-ai` config.
 *
 * The directory reports an entry only when its `Config` has a volatile field, so
 * an absent namespace here means the provider plugin is not composed into this
 * profile — the same answer the browser gets from the describe mirror.
 */
export function readProviderSection(settings: SettingsServiceLike): ProviderNamespaceSection | undefined {
  return providerSectionOf(namespaceValue(settings, PROVIDER_NAMESPACE))
}

/**
 * List the configured provider routes.
 * @param section - the resolved `llm-pi-ai` section.
 * @returns one record per route, in configuration order.
 */
export function listHostProviders(section: ProviderNamespaceSection | undefined): HostProviderRecord[] {
  const providers = section?.providers ?? {}
  return Object.entries(providers).map(([providerId, profile]) => ({
    providerId,
    displayName: typeof profile?.displayName === 'string' ? profile.displayName : providerId,
    profile: profile ?? {},
  }))
}

/** The profile for one provider, or undefined when the route is not configured. */
export function readProviderProfile(
  section: ProviderNamespaceSection | undefined,
  providerId: string,
): ProviderProfile | undefined {
  return section?.providers?.[providerId]
}
