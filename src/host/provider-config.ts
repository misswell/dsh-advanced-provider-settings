/**
 * Reading provider configuration on the host.
 *
 * The host half only ever READS `llm-pi-ai`; writes go through the settings
 * transport from the browser half so they carry the client's revision fence.
 * Keeping a single writer avoids two paths disagreeing about `expectedRevision`.
 */
import {
  PLUGIN_NAMESPACE,
  PROVIDER_NAMESPACE,
} from '../shared/capabilities.js'
import type { PluginSettings, ProviderNamespaceSection, ProviderProfile } from '../shared/types.js'
import { providerSectionOf } from './header-resolver.js'

/** The slice of the settings service this module needs. */
export interface SettingsReader {
  get: (namespace: string) => unknown
}

/** One configured provider route, as the host sees it. */
export interface HostProviderRecord {
  providerId: string
  displayName: string
  profile: ProviderProfile
}

/** Read this plugin's own resolved settings. */
export function readOwnSettings(settings: SettingsReader): PluginSettings | undefined {
  const value = settings.get(PLUGIN_NAMESPACE)
  if (value === undefined || value === null || typeof value !== 'object') return undefined
  return value as PluginSettings
}

/** Read the resolved `llm-pi-ai` section. */
export function readProviderSection(settings: SettingsReader): ProviderNamespaceSection | undefined {
  return providerSectionOf(settings.get(PROVIDER_NAMESPACE))
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
