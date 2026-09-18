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
export const VERIFIED_DSH_VERSION = '0.1.5-rc.2'

/** This plugin's own version. Kept in step with package.json by the build check. */
export const PLUGIN_VERSION = '0.1.0'

/** Namespace owning the OpenAI-compatible provider routes. */
export const PROVIDER_NAMESPACE = 'llm-pi-ai'

/** Namespace this plugin registers for its own (non-provider) configuration. */
export const PLUGIN_NAMESPACE = 'dsh-advanced-provider-settings'

/** Namespace the retired community plugin used, for migration detection. */
export const LEGACY_NAMESPACE = 'dsh-custom-provider-settings'

/** Locale namespace for this plugin's own copy. */
export const LOCALE_NS = PLUGIN_NAMESPACE

// --------------------------------------------------------------------------
// Request protocols
// --------------------------------------------------------------------------

/**
 * Wire protocols a configured route may name.
 * Source: `PROTOCOLS` key order in dsh-llm-pi-ai (most-reached first), which
 * `supportedProtocols()` returns and the profile schema validates against.
 */
export const PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages'] as const

/** One wire protocol identifier. */
export type ProtocolId = (typeof PROTOCOLS)[number]

/** Narrow an arbitrary string to a known protocol id. */
export function isProtocolId(value: unknown): value is ProtocolId {
  return typeof value === 'string' && (PROTOCOLS as readonly string[]).includes(value)
}

// --------------------------------------------------------------------------
// Modalities (vision)
// --------------------------------------------------------------------------

/** Every request modality a profile may declare. Source: `MODALITIES`. */
export const MODALITIES = ['text', 'image'] as const

/** One request modality. */
export type Modality = (typeof MODALITIES)[number]

// --------------------------------------------------------------------------
// Thinking
// --------------------------------------------------------------------------

/**
 * Every thinking level a profile may declare, in escalation order.
 * Source: `THINKING_LEVELS`.
 */
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** One thinking level. */
export type ThinkingLevel = (typeof THINKING_LEVELS)[number]

/**
 * Reasoning-dispatch wire formats. Source: `SUPPORTED_THINKING_FORMATS`.
 */
export const THINKING_FORMATS = [
  'openai',
  'deepseek',
  'openrouter',
  'together',
  'baseten',
  'zai',
  'qwen',
  'chat-template',
  'qwen-chat-template',
  'string-thinking',
  'ant-ling',
] as const

/** Output-cap field spellings. Source: `MAX_TOKENS_FIELDS`. */
export const MAX_TOKENS_FIELDS = ['max_completion_tokens', 'max_tokens'] as const

/** Reasoning-budget field spellings. Source: `THINKING_TOKEN_BUDGET_FIELDS`. */
export const THINKING_TOKEN_BUDGET_FIELDS = [
  'thinking_token_budget',
  'thinking_budget',
  'thinking_budget_tokens',
] as const

/** Prompt-cache marker conventions. Source: `CACHE_CONTROL_FORMATS`. */
export const CACHE_CONTROL_FORMATS = ['anthropic'] as const

/** Request-state placeholders. Source: `CHAT_TEMPLATE_VARS`. */
export const CHAT_TEMPLATE_VARS = [
  'thinking.enabled',
  'thinking.effort',
  'thinking.budget',
] as const

/** Thinking-budget level keys. Source: `thinkingBudgets` schema. */
export const THINKING_BUDGET_LEVELS = ['minimal', 'low', 'medium', 'high'] as const

// --------------------------------------------------------------------------
// Transport / cache retention
// --------------------------------------------------------------------------

/**
 * Streaming transports a profile may name, in the schema's own order. Source:
 * the `transport` member list in dsh-llm-pi-ai — listed in declaration order so
 * a "present the first as the default" surface cannot drift from the schema.
 * There is no schema default: an absent `transport` inherits pi-ai's choice.
 */
export const TRANSPORTS = ['sse', 'websocket', 'websocket-cached', 'auto'] as const

/** One streaming transport. */
export type TransportId = (typeof TRANSPORTS)[number]

/** Prompt-cache retention settings. Source: `cacheRetention` schema. */
export const CACHE_RETENTIONS = ['none', 'short', 'long'] as const

// --------------------------------------------------------------------------
// Compatibility profile
// --------------------------------------------------------------------------

/** Value kind every compat field takes, for input dispatch. */
export type CompatFieldKind = 'boolean' | 'enum' | 'dict' | 'number'

/** One compatibility field and the protocols it actually affects. */
/**
 * Compat fields are grouped by what they change about the outgoing request, so
 * the panel can label clusters instead of presenting 26 flat toggles. The
 * grouping is about meaning, not about which protocol declares the field.
 */
export type CompatGroupId = 'request' | 'streaming' | 'reasoning' | 'tools' | 'caching' | 'misc'

/** Display order of the compat groups. */
export const COMPAT_GROUPS: readonly CompatGroupId[] = [
  'request',
  'streaming',
  'reasoning',
  'tools',
  'caching',
  'misc',
]

export interface CompatFieldDef {
  /** Field name inside `compat`. */
  readonly key: string
  /** What this field changes about the request. */
  readonly group: CompatGroupId
  /** Value kind, choosing the input control. */
  readonly kind: CompatFieldKind
  /**
   * Protocols whose pi-ai compat interface declares this field. A field absent
   * from a protocol's interface is not read by that protocol's request builder,
   * so exposing it there would be a lie (spec section 38).
   */
  readonly protocols: readonly ProtocolId[]
  /** Legal values, for `enum` fields. */
  readonly options?: readonly string[]
  /** Short English note mirrored into the locale files. */
  readonly note?: string
}

/**
 * The 26 compatibility fields this DSH version's `compatProfile` schema
 * accepts, each mapped to the protocols that read it.
 *
 * Applicability source: the three pi-ai compat interfaces. `supportsStrictMode`
 * and `supportsLongCacheRetention` appear in more than one, hence multiple
 * protocols; every other field is read by exactly one.
 */
export const COMPAT_FIELDS: readonly CompatFieldDef[] = [
  // -- OpenAI-compatible completions -------------------------------------
  {
    key: 'supportsStore',
    group: 'request',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Whether the endpoint accepts the `store` request field.',
  },
  {
    key: 'supportsDeveloperRole',
    group: 'request',
    kind: 'boolean',
    protocols: ['openai-completions', 'openai-responses'],
    note: 'Whether the endpoint accepts the `developer` role instead of `system`.',
  },
  {
    key: 'supportsReasoningEffort',
    group: 'reasoning',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Whether the endpoint accepts `reasoning_effort`.',
  },
  {
    key: 'supportsUsageInStreaming',
    group: 'streaming',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Whether `stream_options.include_usage` is accepted.',
  },
  {
    key: 'supportsFinishReason',
    group: 'streaming',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Whether streamed chunks carry a finish reason.',
  },
  {
    key: 'maxTokensField',
    group: 'request',
    kind: 'enum',
    protocols: ['openai-completions'],
    options: MAX_TOKENS_FIELDS,
    note: 'Which field carries the output cap.',
  },
  {
    key: 'requiresToolResultName',
    group: 'tools',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Whether tool results must repeat the tool name.',
  },
  {
    key: 'requiresAssistantAfterToolResult',
    group: 'tools',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Whether an assistant turn must follow tool results.',
  },
  {
    key: 'requiresThinkingAsText',
    group: 'reasoning',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Whether thinking must be sent as <thinking> text.',
  },
  {
    key: 'requiresReasoningContentOnAssistantMessages',
    group: 'reasoning',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Whether replayed assistant turns need an empty reasoning_content.',
  },
  {
    key: 'thinkingFormat',
    group: 'reasoning',
    kind: 'enum',
    protocols: ['openai-completions'],
    options: THINKING_FORMATS,
    note: 'Wire shape of the reasoning parameter.',
  },
  {
    key: 'chatTemplateKwargs',
    group: 'reasoning',
    kind: 'dict',
    protocols: ['openai-completions'],
    note: '`chat_template_kwargs` map (chat-template thinking formats).',
  },
  {
    key: 'chatTemplateArgs',
    group: 'reasoning',
    kind: 'dict',
    protocols: ['openai-completions'],
    note: '`chat_template_args` map (baseten thinking format).',
  },
  {
    key: 'supportsThinkingTokenBudget',
    group: 'reasoning',
    kind: 'boolean',
    protocols: ['openai-completions'],
    note: 'Alias enabling the vLLM thinking budget field.',
  },
  {
    key: 'thinkingTokenBudgetField',
    group: 'reasoning',
    kind: 'enum',
    protocols: ['openai-completions'],
    options: THINKING_TOKEN_BUDGET_FIELDS,
    note: 'Top-level field carrying the reasoning token cap.',
  },
  {
    key: 'vllmPriority',
    group: 'misc',
    kind: 'number',
    protocols: ['openai-completions'],
    note: 'vLLM scheduler priority (needs --scheduling-policy priority).',
  },
  {
    key: 'cacheControlFormat',
    group: 'caching',
    kind: 'enum',
    protocols: ['openai-completions'],
    options: CACHE_CONTROL_FORMATS,
    note: 'Prompt-cache marker convention.',
  },
  {
    key: 'supportsStrictMode',
    group: 'tools',
    kind: 'boolean',
    protocols: ['openai-completions', 'openai-responses'],
    note: 'Whether tool definitions accept `strict`.',
  },
  // -- OpenAI Responses --------------------------------------------------
  {
    key: 'supportsMaxOutputTokens',
    group: 'request',
    kind: 'boolean',
    protocols: ['openai-responses'],
    note: 'Whether `max_output_tokens` is accepted.',
  },
  // -- Shared by every protocol -----------------------------------------
  {
    key: 'supportsLongCacheRetention',
    group: 'caching',
    kind: 'boolean',
    protocols: ['openai-completions', 'openai-responses', 'anthropic-messages'],
    note: 'Whether long (24h / 1h TTL) prompt cache retention is supported.',
  },
  // -- Anthropic Messages ------------------------------------------------
  {
    key: 'supportsEagerToolInputStreaming',
    group: 'tools',
    kind: 'boolean',
    protocols: ['anthropic-messages'],
    note: 'Whether per-tool eager_input_streaming is accepted.',
  },
  {
    key: 'supportsCacheControlOnTools',
    group: 'caching',
    kind: 'boolean',
    protocols: ['anthropic-messages'],
    note: 'Whether cache_control is accepted on tool definitions.',
  },
  {
    key: 'supportsTemperature',
    group: 'request',
    kind: 'boolean',
    protocols: ['anthropic-messages'],
    note: 'Whether the temperature field is accepted.',
  },
  {
    key: 'forceAdaptiveThinking',
    group: 'reasoning',
    kind: 'boolean',
    protocols: ['anthropic-messages'],
    note: 'Force thinking.type "adaptive" plus output_config.effort.',
  },
  {
    key: 'allowEmptySignature',
    group: 'reasoning',
    kind: 'boolean',
    protocols: ['anthropic-messages'],
    note: 'Replay empty thinking signatures instead of converting to text.',
  },
  {
    key: 'supportsStrictTools',
    group: 'tools',
    kind: 'boolean',
    protocols: ['anthropic-messages'],
    note: 'Whether Anthropic strict tool schemas are accepted.',
  },
]

/** Fast lookup of a compat field definition by name. */
export const COMPAT_FIELD_BY_KEY: ReadonlyMap<string, CompatFieldDef> = new Map(
  COMPAT_FIELDS.map((field) => [field.key, field]),
)

/**
 * Compat fields that affect a given protocol, in table order.
 * @param protocol - the route's `api` value.
 * @returns the fields a UI should offer for that protocol.
 */
export function compatFieldsFor(protocol: string | undefined): readonly CompatFieldDef[] {
  if (protocol === undefined) return []
  return COMPAT_FIELDS.filter((field) => field.protocols.includes(protocol as ProtocolId))
}

// --------------------------------------------------------------------------
// Provider-level fields this plugin manages
// --------------------------------------------------------------------------

/**
 * Provider-level keys the plugin writes. Reset All and export consult this
 * list, which is why it must stay exhaustive and must never grow to include
 * identity, endpoint, or credential keys (spec sections 47-48).
 */
export const MANAGED_PROVIDER_KEYS = [
  'headers',
  'defaultInput',
  'reasoning',
  'thinkingBudgets',
  'cacheRetention',
  'transport',
  'timeoutMs',
  'streamIdleTimeoutMs',
  'websocketConnectTimeoutMs',
  'maxRequestImageBytes',
  'requestImagePixelBudget',
  'requestImageMaxBytes',
  'retryPolicy',
  'compat',
] as const

/** Model-level keys the plugin writes. Identity and window sizes stay native. */
export const MANAGED_MODEL_KEYS = ['input', 'reasoningEfforts'] as const

// --------------------------------------------------------------------------
// Reserved headers
// --------------------------------------------------------------------------

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
export const RESERVED_HEADER_NAMES: readonly string[] = ['user-agent']

/**
 * Whether a header name is reserved by Harness attribution.
 * @param name - header field name, any case.
 * @returns whether DSH overwrites this header on the wire.
 */
export function isReservedHeader(name: string): boolean {
  return RESERVED_HEADER_NAMES.includes(name.trim().toLowerCase())
}

/** The attribution value DSH sends, shown in diagnostics and previews. */
export function attributionUserAgent(version = VERIFIED_DSH_VERSION): string {
  return `deepseek-harness/${version} (+https://github.com/deepseek-ai/deepseek-harness)`
}

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
  id: string
  /** Locale key for the button label. */
  labelKey: string
  /** Value written into the `user-agent` global header. */
  value: string
}

/** User-Agent presets, in the order the editor shows them. */
export const USER_AGENT_PRESETS: readonly UserAgentPreset[] = [
  {
    id: 'chrome',
    labelKey: 'headers.preset.chrome',
    value:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
  {
    id: 'safari',
    labelKey: 'headers.preset.safari',
    value:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  },
  {
    id: 'firefox',
    labelKey: 'headers.preset.firefox',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
  },
  { id: 'opencode', labelKey: 'headers.preset.opencode', value: 'opencode/0.6.0' },
  { id: 'codex', labelKey: 'headers.preset.codex', value: 'codex_cli_rs/0.34.0' },
  { id: 'claude-cli', labelKey: 'headers.preset.claudeCli', value: 'claude-cli/1.0.0 (external, cli)' },
]
