import { type HeaderEntry, type HeaderLayer, type ResolvedHeader } from '../shared/headers.js';
import type { PluginSettings, ProviderNamespaceSection } from '../shared/types.js';
/** The attribution layer Harness always contributes, for preview and warnings. */
export declare function harnessHeaderLayer(version?: string): HeaderLayer;
/**
 * Read the global header mapping out of this plugin's own settings.
 *
 * Invalid entries are dropped rather than passed on: an edit made by hand in
 * `settings.yaml` must not be able to inject a header (section 18).
 * @param settings - this plugin's resolved settings.
 * @returns validated global headers, in stored order.
 */
export declare function globalHeaderEntries(settings: PluginSettings | undefined): HeaderEntry[];
/**
 * Read a provider's header mapping out of the `llm-pi-ai` section.
 * @param section - the resolved `llm-pi-ai` value.
 * @param providerId - route id.
 * @returns validated provider headers.
 */
export declare function providerHeaderEntries(section: ProviderNamespaceSection | undefined, providerId: string): HeaderEntry[];
/**
 * Compute the effective headers for one provider.
 * @param options - the settings layers to fold.
 * @returns effective headers with source and reserved flags, in override order.
 */
export declare function resolveEffectiveHeaders(options: {
    settings: PluginSettings | undefined;
    section: ProviderNamespaceSection | undefined;
    providerId: string;
    harnessVersion?: string;
}): ResolvedHeader[];
/** A provider header the user should be told about before trusting it. */
export interface HeaderAdvisory {
    /** `reserved` — Harness overwrites it. `credential` — it can defeat the stored key. */
    code: 'reserved-provider-header' | 'credential-overrides-key' | 'authorization-with-credential';
    /** The offending header name as the user wrote it. */
    name: string;
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
export declare function headerAdvisories(providerHeaders: readonly HeaderEntry[], credentialRef: string | undefined): HeaderAdvisory[];
/** Whether the global layer overrides Harness attribution on the wire. */
export declare function overridesAttribution(settings: PluginSettings | undefined): boolean;
/**
 * Extract the provider sub-section the header resolver needs.
 * @param resolved - the resolved `llm-pi-ai` value, whatever shape it has.
 * @returns a narrow view, or undefined when the namespace is absent.
 */
export declare function providerSectionOf(resolved: unknown): ProviderNamespaceSection | undefined;
/** The settings namespace whose providers this plugin configures. */
export declare const CONFIGURED_NAMESPACE = "llm-pi-ai";
