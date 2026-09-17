import type { PluginSettings, ProviderNamespaceSection, ProviderProfile } from '../shared/types.js';
/** The slice of the settings service this module needs. */
export interface SettingsReader {
    get: (namespace: string) => unknown;
}
/** One configured provider route, as the host sees it. */
export interface HostProviderRecord {
    providerId: string;
    displayName: string;
    profile: ProviderProfile;
}
/** Read this plugin's own resolved settings. */
export declare function readOwnSettings(settings: SettingsReader): PluginSettings | undefined;
/** Read the resolved `llm-pi-ai` section. */
export declare function readProviderSection(settings: SettingsReader): ProviderNamespaceSection | undefined;
/**
 * List the configured provider routes.
 * @param section - the resolved `llm-pi-ai` section.
 * @returns one record per route, in configuration order.
 */
export declare function listHostProviders(section: ProviderNamespaceSection | undefined): HostProviderRecord[];
/** The profile for one provider, or undefined when the route is not configured. */
export declare function readProviderProfile(section: ProviderNamespaceSection | undefined, providerId: string): ProviderProfile | undefined;
