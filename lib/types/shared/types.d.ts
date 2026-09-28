/**
 * The settings shapes this plugin reads and writes.
 *
 * IMPORTANT: every interface here is deliberately OPEN (an index signature
 * admits unknown keys). The plugin reads the user layer as it exists on disk,
 * changes only the keys it owns, and writes back path-addressed operations —
 * so a field a future DSH version adds, or another plugin writes, survives
 * untouched (spec sections 45, 70). Nothing in this file may be used to
 * reconstruct a whole provider object from scratch.
 */
import type { Modality, ThinkingLevel } from './capabilities.js';
import type { RetryPolicy } from './retry.js';
/**
 * One entry in a provider's `models` array.
 *
 * `id` is required by the Harness schema; `name`, `contextWindow` and
 * `maxTokens` are the native editor's business and this plugin never writes
 * them (spec section 40).
 */
export interface ProviderModelEntry {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
    /** Declared modalities. Absent means "inherit the catalog / provider default". */
    input?: Modality[];
    /**
     * Level → wire value map, or `false` to disable reasoning efforts entirely.
     * A `null` wire value is meaningful (the level sends nothing).
     */
    reasoningEfforts?: false | Record<string, string | null>;
    /** Per-model compatibility overrides. */
    compat?: Record<string, unknown>;
    /** Unknown fields from other writers, preserved verbatim. */
    [key: string]: unknown;
}
/**
 * One `modelOverrides` entry: the fields a `models` entry may carry, minus the
 * `id`, which is the dict key.
 *
 * This is the FINEST level the Harness schema offers on a catalog route. A
 * route that declares no `models` list serves the installed catalog, and
 * `modelOverrides` reshapes one catalog model without replacing the other
 * thirty-seven — the only per-model channel such a route has. It accepts every
 * field a `models` entry does, including the identity and capacity fields the
 * Models page owns for listed models, because no page edits this channel.
 */
export interface ProviderModelOverride {
    /** Display name for selectors; defaults to the catalog name, then the id. */
    name?: string;
    /** Maximum combined request and response context in tokens. */
    contextWindow?: number;
    /** Maximum output tokens; configuring one also makes it the request default. */
    maxTokens?: number;
    /** Request modalities this model accepts; absent keeps the catalog's. */
    input?: Modality[];
    /** Level → wire value map, or `false` to declare a non-reasoning model. */
    reasoningEfforts?: false | Record<string, string | null>;
    /** Per-model compatibility overrides, winning over the route's per field. */
    compat?: Record<string, unknown>;
    /** Unknown fields from other writers, preserved verbatim. */
    [key: string]: unknown;
}
/** One provider profile as stored under `llm-pi-ai.providers.<id>`. */
export interface ProviderProfile {
    /** Credential reference name. Never a secret; owned by Harness Credentials. */
    apiKeyEnv?: string;
    displayName?: string;
    api?: string;
    baseURL?: string;
    models?: ProviderModelEntry[];
    /**
     * Installed-catalog customizations by model id. Only meaningful while
     * `models` is absent or empty — a non-empty `models` list already replaces
     * the served catalog, so an override beside it is refused by Harness.
     */
    modelOverrides?: Record<string, ProviderModelOverride>;
    compat?: Record<string, unknown>;
    defaultContextWindow?: number;
    defaultMaxTokens?: number;
    defaultInput?: Modality[];
    headers?: Record<string, string>;
    reasoning?: ThinkingLevel;
    thinkingBudgets?: Record<string, number>;
    cacheRetention?: string;
    transport?: string;
    timeoutMs?: number;
    websocketConnectTimeoutMs?: number;
    streamIdleTimeoutMs?: number;
    maxRequestImageBytes?: number;
    requestImagePixelBudget?: number;
    requestImageMaxBytes?: number;
    retryPolicy?: RetryPolicy;
    /** Unknown fields from other writers, preserved verbatim. */
    [key: string]: unknown;
}
/** The `llm-pi-ai` user layer as stored. */
export interface ProviderNamespaceSection {
    providers?: Record<string, ProviderProfile>;
    [key: string]: unknown;
}
/** This plugin's own namespace. Holds only what Harness cannot express. */
export interface PluginSettings {
    /** Headers applied to every provider request, below provider headers. */
    globalHeaders?: Record<string, string>;
    /** UI preferences. Never provider configuration. */
    ui?: PluginUiSettings;
    /** Records that the legacy plugin's headers were imported, so we ask once. */
    migration?: MigrationState;
}
/** Durable UI preferences. */
export interface PluginUiSettings {
    /** Whether the Advanced Settings disclosure starts open. */
    advancedExpanded?: boolean;
    /** Whether the "Always retry" warning has been acknowledged once. */
    acknowledgedAlwaysRetry?: boolean;
}
/** How far the legacy-plugin migration got. */
export interface MigrationState {
    /** `imported` once the legacy headers were copied across. */
    globalHeaders?: 'imported' | 'ignored';
    /** ISO timestamp of the decision, for diagnostics. */
    decidedAt?: string;
}
/** One path-addressed edit, matching the Harness `SettingsPathOp` wire type. */
export type SettingsPathOp = {
    op: 'set';
    path: string[];
    value: unknown;
} | {
    op: 'unset';
    path: string[];
};
/** JSON-safe value accepted by a `set` op. */
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
/**
 * Build the path to one provider-level managed field.
 * @param providerId - route id.
 * @param field - field name inside the profile.
 * @returns the settings path.
 */
export declare function providerFieldPath(providerId: string, field: string): string[];
/**
 * Build the path to one field of one model entry.
 *
 * Index-addressed on purpose: a path op must name a position, and the caller
 * fences the write with the revision it read, so a concurrent `models` change
 * causes a conflict rather than a misdirected edit.
 *
 * @param providerId - route id.
 * @param modelIndex - position in the `models` array.
 * @param field - field name inside the model entry.
 * @returns the settings path.
 */
export declare function modelFieldPath(providerId: string, modelIndex: number, field: string): string[];
/**
 * Build the path to one field of one `modelOverrides` entry.
 *
 * Keyed by model id rather than by position: the id is the dict key, so a
 * catalog reorder cannot misdirect the edit the way an index could.
 *
 * @param providerId - route id.
 * @param modelId - catalog model id, used verbatim as the dict key.
 * @param field - field name inside the override entry.
 * @returns the settings path.
 */
export declare function modelOverrideFieldPath(providerId: string, modelId: string, field: string): string[];
/**
 * Build the path to one whole `modelOverrides` entry.
 * @param providerId - route id.
 * @param modelId - catalog model id.
 * @returns the settings path.
 */
export declare function modelOverrideEntryPath(providerId: string, modelId: string): string[];
/**
 * Build the path to a route's whole `modelOverrides` mapping.
 * @param providerId - route id.
 * @returns the settings path.
 */
export declare function modelOverrideMapPath(providerId: string): string[];
/** Path to the plugin's global-header mapping. */
export declare const GLOBAL_HEADERS_PATH: readonly string[];
/** Path to the plugin's durable UI preferences. */
export declare const PLUGIN_UI_PATH: readonly string[];
/** One provider's advanced state as the UI models it. */
export interface AdvancedProviderState {
    /** Route id. */
    providerId: string;
    /** Display name from the directory row. */
    displayName: string;
    /** The route's protocol (`api`). */
    protocol: string | undefined;
    /** The profile's user layer, unknown fields included. */
    profile: ProviderProfile;
    /** Whether any settings layer configures this route. */
    configured: boolean;
}
