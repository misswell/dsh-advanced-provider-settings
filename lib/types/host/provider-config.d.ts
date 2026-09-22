import { type SettingsServiceLike } from './settings.js';
import type { ProviderNamespaceSection, ProviderProfile } from '../shared/types.js';
/** One configured provider route, as the host sees it. */
export interface HostProviderRecord {
    providerId: string;
    displayName: string;
    profile: ProviderProfile;
}
/**
 * Read the resolved `llm-pi-ai` config.
 *
 * The directory reports an entry only when its `Config` has a volatile field, so
 * an absent namespace here means the provider plugin is not composed into this
 * profile — the same answer the browser gets from the describe mirror.
 */
export declare function readProviderSection(settings: SettingsServiceLike): ProviderNamespaceSection | undefined;
/**
 * List the configured provider routes.
 * @param section - the resolved `llm-pi-ai` section.
 * @returns one record per route, in configuration order.
 */
export declare function listHostProviders(section: ProviderNamespaceSection | undefined): HostProviderRecord[];
/** The profile for one provider, or undefined when the route is not configured. */
export declare function readProviderProfile(section: ProviderNamespaceSection | undefined, providerId: string): ProviderProfile | undefined;
