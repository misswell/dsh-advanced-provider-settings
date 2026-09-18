/**
 * Schema-derived capability table — the ONE place that knows what this DSH
 * version accepts.
 *
 * Section 56 of the project spec forbids hard-coding Harness enums across the
 * code base. Every enum, default, and field list below was read out of the
 * installed DSH build rather than guessed, and each entry cites where it came
 * from so a future Harness upgrade is a single-file change:
 *
 *  - provider/model schema:  @deepseek-ai/dsh-llm-pi-ai/lib/index.js
 *                            (`profile`, `modelFields`, `compatProfile`)
 *  - retry schema:           @deepseek-ai/dsh-llm      (`RetryPolicySchema`)
 *  - compat applicability:   @earendil-works/pi-ai/dist/types.d.ts
 *                            (`OpenAICompletionsCompat`, `OpenAIResponsesCompat`,
 *                             `AnthropicMessagesCompat`)
 *  - reserved headers:       @deepseek-ai/dsh-llm      (`attributionHeaders`)
 *
 * `HARNESS_MATRIX` records the exact build this table was verified against; the
 * Diagnostics panel surfaces it so a bug report can name it.
 */
/** The DSH build every constant in this file was verified against. */
export declare const VERIFIED_DSH_VERSION = "0.1.5-rc.2";
/** This plugin's own version. Kept in step with package.json by the build check. */
export declare const PLUGIN_VERSION = "0.1.0";
/** Namespace owning the OpenAI-compatible provider routes. */
export declare const PROVIDER_NAMESPACE = "llm-pi-ai";
/** Namespace this plugin registers for its own (non-provider) configuration. */
export declare const PLUGIN_NAMESPACE = "dsh-advanced-provider-settings";
/** Namespace the retired community plugin used, for migration detection. */
export declare const LEGACY_NAMESPACE = "dsh-custom-provider-settings";
/** Locale namespace for this plugin's own copy. */
export declare const LOCALE_NS = "dsh-advanced-provider-settings";
/**
 * Wire protocols a configured route may name.
 * Source: `PROTOCOLS` key order in dsh-llm-pi-ai (most-reached first), which
 * `supportedProtocols()` returns and the profile schema validates against.
 */
export declare const PROTOCOLS: readonly ["openai-completions", "openai-responses", "anthropic-messages"];
/** One wire protocol identifier. */
export type ProtocolId = (typeof PROTOCOLS)[number];
/** Narrow an arbitrary string to a known protocol id. */
export declare function isProtocolId(value: unknown): value is ProtocolId;
/** Every request modality a profile may declare. Source: `MODALITIES`. */
export declare const MODALITIES: readonly ["text", "image"];
/** One request modality. */
export type Modality = (typeof MODALITIES)[number];
/**
 * Every thinking level a profile may declare, in escalation order.
 * Source: `THINKING_LEVELS`.
 */
export declare const THINKING_LEVELS: readonly ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
/** One thinking level. */
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
/**
 * Reasoning-dispatch wire formats. Source: `SUPPORTED_THINKING_FORMATS`.
 */
export declare const THINKING_FORMATS: readonly ["openai", "deepseek", "openrouter", "together", "baseten", "zai", "qwen", "chat-template", "qwen-chat-template", "string-thinking", "ant-ling"];
/** Output-cap field spellings. Source: `MAX_TOKENS_FIELDS`. */
export declare const MAX_TOKENS_FIELDS: readonly ["max_completion_tokens", "max_tokens"];
/** Reasoning-budget field spellings. Source: `THINKING_TOKEN_BUDGET_FIELDS`. */
export declare const THINKING_TOKEN_BUDGET_FIELDS: readonly ["thinking_token_budget", "thinking_budget", "thinking_budget_tokens"];
/** Prompt-cache marker conventions. Source: `CACHE_CONTROL_FORMATS`. */
export declare const CACHE_CONTROL_FORMATS: readonly ["anthropic"];
/** Request-state placeholders. Source: `CHAT_TEMPLATE_VARS`. */
export declare const CHAT_TEMPLATE_VARS: readonly ["thinking.enabled", "thinking.effort", "thinking.budget"];
/** Thinking-budget level keys. Source: `thinkingBudgets` schema. */
export declare const THINKING_BUDGET_LEVELS: readonly ["minimal", "low", "medium", "high"];
/**
 * Streaming transports a profile may name, in the schema's own order. Source:
 * the `transport` member list in dsh-llm-pi-ai — listed in declaration order so
 * a "present the first as the default" surface cannot drift from the schema.
 * There is no schema default: an absent `transport` inherits pi-ai's choice.
 */
export declare const TRANSPORTS: readonly ["sse", "websocket", "websocket-cached", "auto"];
/** One streaming transport. */
export type TransportId = (typeof TRANSPORTS)[number];
/** Prompt-cache retention settings. Source: `cacheRetention` schema. */
export declare const CACHE_RETENTIONS: readonly ["none", "short", "long"];
/** Value kind every compat field takes, for input dispatch. */
export type CompatFieldKind = 'boolean' | 'enum' | 'dict' | 'number';
/** One compatibility field and the protocols it actually affects. */
/**
 * Compat fields are grouped by what they change about the outgoing request, so
 * the panel can label clusters instead of presenting 26 flat toggles. The
 * grouping is about meaning, not about which protocol declares the field.
 */
export type CompatGroupId = 'request' | 'streaming' | 'reasoning' | 'tools' | 'caching' | 'misc';
/** Display order of the compat groups. */
export declare const COMPAT_GROUPS: readonly CompatGroupId[];
export interface CompatFieldDef {
    /** Field name inside `compat`. */
    readonly key: string;
    /** What this field changes about the request. */
    readonly group: CompatGroupId;
    /** Value kind, choosing the input control. */
    readonly kind: CompatFieldKind;
    /**
     * Protocols whose pi-ai compat interface declares this field. A field absent
     * from a protocol's interface is not read by that protocol's request builder,
     * so exposing it there would be a lie (spec section 38).
     */
    readonly protocols: readonly ProtocolId[];
    /** Legal values, for `enum` fields. */
    readonly options?: readonly string[];
    /** Short English note mirrored into the locale files. */
    readonly note?: string;
}
/**
 * The 26 compatibility fields this DSH version's `compatProfile` schema
 * accepts, each mapped to the protocols that read it.
 *
 * Applicability source: the three pi-ai compat interfaces. `supportsStrictMode`
 * and `supportsLongCacheRetention` appear in more than one, hence multiple
 * protocols; every other field is read by exactly one.
 */
export declare const COMPAT_FIELDS: readonly CompatFieldDef[];
/** Fast lookup of a compat field definition by name. */
export declare const COMPAT_FIELD_BY_KEY: ReadonlyMap<string, CompatFieldDef>;
/**
 * Compat fields that affect a given protocol, in table order.
 * @param protocol - the route's `api` value.
 * @returns the fields a UI should offer for that protocol.
 */
export declare function compatFieldsFor(protocol: string | undefined): readonly CompatFieldDef[];
/**
 * Provider-level keys the plugin writes. Reset All and export consult this
 * list, which is why it must stay exhaustive and must never grow to include
 * identity, endpoint, or credential keys (spec sections 47-48).
 */
export declare const MANAGED_PROVIDER_KEYS: readonly ["headers", "defaultInput", "reasoning", "thinkingBudgets", "cacheRetention", "transport", "timeoutMs", "streamIdleTimeoutMs", "websocketConnectTimeoutMs", "maxRequestImageBytes", "requestImagePixelBudget", "requestImageMaxBytes", "retryPolicy", "compat"];
/** Model-level keys the plugin writes. Identity and window sizes stay native. */
export declare const MANAGED_MODEL_KEYS: readonly ["input", "reasoningEfforts"];
/**
 * Header names the Harness overwrites on every provider request, lowercased.
 *
 * Source: `attributionHeaders()` in @deepseek-ai/dsh-llm returns exactly one
 * entry, `user-agent`, and dsh-llm-pi-ai's `requestHeaders()` filters any
 * user-supplied header whose lowercased name collides with it before merging
 * the attribution value on top. Consequence, and the reason this constant
 * exists: a provider-level `User-Agent` in `headers` is SILENTLY DROPPED by
 * DSH 0.1.5-rc.2. The UI must say so rather than pretend the field works.
 */
export declare const RESERVED_HEADER_NAMES: readonly string[];
/**
 * Whether a header name is reserved by Harness attribution.
 * @param name - header field name, any case.
 * @returns whether DSH overwrites this header on the wire.
 */
export declare function isReservedHeader(name: string): boolean;
/** The attribution value DSH sends, shown in diagnostics and previews. */
export declare function attributionUserAgent(version?: string): string;
/**
 * One User-Agent preset.
 *
 * WHY THESE LIVE IN THE GLOBAL LAYER ONLY: `requestHeaders()` in
 * dsh-llm-pi-ai strips any configured `user-agent` from a provider profile and
 * then appends Harness attribution, so a provider-level User-Agent never reaches
 * the wire. The global layer is applied by this plugin's own transport wrapper,
 * after Harness has built its header set, and is therefore the only way to send
 * a whitelisted client string.
 *
 * The version numbers are deliberately ordinary current values, not claims: a
 * gateway that whitelists clients will have its own expectations, and every
 * preset is an editable starting point rather than a pinned constant.
 */
export interface UserAgentPreset {
    /** Stable id used as the React key. */
    id: string;
    /** Locale key for the button label. */
    labelKey: string;
    /** Value written into the `user-agent` global header. */
    value: string;
}
/** User-Agent presets, in the order the editor shows them. */
export declare const USER_AGENT_PRESETS: readonly UserAgentPreset[];
