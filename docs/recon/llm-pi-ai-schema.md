# `llm-pi-ai` provider configuration — exact schema for DSH 0.1.5-rc.2

Read-only reconnaissance. Every claim below is anchored to a file path + line number in the
**installed** DSH runtime. Nothing in this repository was modified to produce it.

## 0. Sources inspected (ground truth)

| Role | Path | Version |
|---|---|---|
| Adapter (bundled JS, readable) | `/Users/guofeng/Library/Application Support/DeepSeek Harness Desk/runtime/dsh/0.1.5-rc.2/node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js` (2688 lines) | 0.1.5-rc.2 |
| Adapter types | `…/@deepseek-ai/dsh-llm-pi-ai/lib/types/{config,catalog,adapter,discovery}.d.ts` | 0.1.5-rc.2 |
| LLM seam (retry, attribution) | `…/@deepseek-ai/dsh-llm/lib/types/{retry-policy.js,attribution.js,types.d.ts}` | 0.1.5-rc.2 |
| Upstream library | `…/@earendil-works/pi-ai/dist/{types.d.ts,models.js,api/*.js,utils/pi-user-agent.js}` | 0.85.1 |
| OpenAI SDK (header merge) | `…/node_modules/openai/{internal/headers.mjs,client.mjs}` | 6.40.0 |
| Anthropic SDK | `…/node_modules/@anthropic-ai/sdk` | 0.123.0 |
| Schema engine | `…/@deepseek-ai/schemastery/src/index.ts` | 3.18.2 |
| Live user settings | `~/.dsh/settings.yaml` | — |

All paths below are relative to
`/Users/guofeng/Library/Application Support/DeepSeek Harness Desk/runtime/dsh/0.1.5-rc.2/node_modules/`
unless stated otherwise. `PI` = `@earendil-works/pi-ai`.

**No secret values exist in the live file** — `llm-pi-ai.providers.*.apiKeyEnv` holds *references*
(`DEEPSEEK_V4_FLASH_API_KEY`, `ROUTER_API_KEY`), never values. Nothing to redact.

## 1. Plugin identity and registration

`dsh-llm-pi-ai/lib/index.js`:

```js
2531: const name = "llm-pi-ai";
2532: const inject = ["llm"];
2533: const NS = "llm-pi-ai";
```

Exports (line 2688): `Config, PiAiAdapter, apply, inject, name, recordKeyFor, supportedProtocols`.

* Settings namespace is **`llm-pi-ai`**; the section schema is installed at
  `settingsCtx.settings.installSection(ctx, NS, Config, config, …)` (line 2661).
* Credential records are addressed as `` credentialKey("llm-pi-ai", providerId) `` →
  `"llm-pi-ai/<route>"` (lines 1928 `RECORD_SCOPE`, 1933–1935 `recordKeyFor`).
* Provider directory entries advertise `settingsNs: NS` and `settingsPath: ["providers", provider]`
  (lines 2557–2562) — this is what a settings UI must write through.

## 2. Top-level `Config` schema (verbatim)

`dsh-llm-pi-ai/lib/index.js:983–1017`:

```js
const profile = z.object({
	apiKeyEnv: z.string().role("credential-ref"),
	displayName: z.string(),
	api: z.union(supportedProtocols()),
	baseURL: z.string(),
	models: z.array(modelProfile),
	modelOverrides: z.dict(modelOverride),
	compat: compatProfile,
	defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
	defaultMaxTokens: z.number().step(1).min(1).default(DEFAULT_MAX_TOKENS),
	defaultInput: z.array(z.union(MODALITIES)).default([...DEFAULT_INPUT]),
	headers: z.dict(z.string()),
	reasoning: z.union(THINKING_LEVELS),
	thinkingBudgets,
	cacheRetention: z.union([
		"none",
		"short",
		"long"
	]),
	transport: z.union([
		"sse",
		"websocket",
		"websocket-cached",
		"auto"
	]),
	timeoutMs: z.natural(),
	websocketConnectTimeoutMs: z.natural(),
	streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
	maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
	requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
	requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
	retryPolicy: RetryPolicySchema
});
/** Runtime schema for {@link Config}. */
const Config = z.object({ providers: z.dict(profile).default({}) });
```

`z.natural()` expands to `z.number().step(1).min(0)` — visible in the dumped JSON schema
(`timeoutMs: type=number meta={"step":1,"min":0}`); **there is no upper bound on `timeoutMs` or
`websocketConnectTimeoutMs`** even though the adapter later bounds other timers by
`MAX_TIMER_DELAY_MS`.

### 2.1 Defaults the schema itself materializes

Verified by executing the real schema:

```js
Config({ providers: { p: { api: "openai-completions", baseURL: "https://x/v1", models: [{ id: "m" }] } } })
```

produces:

```json
{
 "providers": {
  "p": {
   "api": "openai-completions",
   "baseURL": "https://x/v1",
   "models": [{ "id": "m", "input": [], "compat": { "chatTemplateKwargs": {}, "chatTemplateArgs": {} } }],
   "modelOverrides": {},
   "compat": { "chatTemplateKwargs": {}, "chatTemplateArgs": {} },
   "defaultContextWindow": 262144,
   "defaultMaxTokens": 32768,
   "defaultInput": ["text"],
   "headers": {},
   "thinkingBudgets": {},
   "streamIdleTimeoutMs": 300000,
   "maxRequestImageBytes": 20971520,
   "requestImagePixelBudget": 4194304,
   "requestImageMaxBytes": 1048576
  }
 }
}
```

Notes that follow from this:

* `models`, `modelOverrides`, `compat`, `headers`, `thinkingBudgets` are materialized as `{}`/`[]`
  even when absent. `configuredCompatEntries` (index.js:472–476) drops **empty** dicts, so an
  absent `chatTemplateKwargs`/`chatTemplateArgs` states nothing.
* `models[].input` is materialized as `[]`; `declaredInput` (index.js:292–294) treats `[]` as
  "no answer" and falls through to catalog → `defaultInput`.
* **`retryPolicy` has no schema default** — it stays absent and is defaulted by
  `resolveRetryPolicy` at resolution time (§7).
* `reasoning`, `cacheRetention`, `transport`, `timeoutMs`, `websocketConnectTimeoutMs` have
  **no defaults** (absent = inherit pi-ai behavior).

### 2.2 Default constants

`dsh-llm-pi-ai/lib/index.js:876–906`:

```js
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;                       // 300000
const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;         // 20971520
const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;           // 4194304
const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;              // 1048576
const DEFAULT_CONTEXT_WINDOW = 262144;
const DEFAULT_MAX_TOKENS = 32768;
const DEFAULT_INPUT = ["text"];
```

`MAX_TIMER_DELAY_MS = 2147483647` — `@deepseek-ai/dsh-timeout/lib/types/index.d.ts:22`.

## 3. Provider profile — full field table

Types source: `dsh-llm-pi-ai/lib/types/config.d.ts:53–144` (`PiAiProviderProfile`),
`catalog.d.ts` for `compat`/model shapes.

| Field (exact) | Type | Schema | Default | Validation at resolution (`resolveProfiles`, index.js:1051–1120) |
|---|---|---|---|---|
| `apiKeyEnv` | `string` | `z.string().role("credential-ref")` | none | branded via `credentialRef()` (index.js:1105) → must match `/^[A-Za-z_][A-Za-z0-9_]*$/` (`dsh-credentials/lib/index.js:14`), else throws `TypeError` |
| `displayName` | `string` | `z.string()` | route key (`index.js:1071`) | non-empty else throw (line 1059) |
| `api` | enum of 3 consts | `z.union(supportedProtocols())` | none (catalog model's own api) | must be one of §4.1; otherwise `buildProvider` throws "which this build cannot serve" (line 850) |
| `baseURL` | `string` | `z.string()` | installed catalog provider's `baseUrl` (line 668) | non-empty else throw (line 1058) |
| `models` | `PiAiModelProfile[]` | `z.array(modelProfile)`, default `[]` | serve installed catalog | non-empty route list replaces the catalog; each entry needs a resolvable id |
| `modelOverrides` | `Record<string, PiAiModelOverride>` | `z.dict(modelOverride)`, default `{}` | `{}` | only on a catalog route with **no** `models` list; naming an id the catalog lacks is refused (strict) or kept as a diagnostic (deferred) (lines 640–650) |
| `compat` | `PiAiCompatProfile` | `compatProfile`, default `{}` | `{}` | unknown/withheld key → throw (lines 517–525); every value must be non-null (line 523) |
| `defaultContextWindow` | `number` int ≥ 1 | `.step(1).min(1).default(262144)` | 262144 | re-checked as positive integer (line 670–671 is per-model; scalar as-is) |
| `defaultMaxTokens` | `number` int ≥ 1 | `.step(1).min(1).default(32768)` | 32768 | idem |
| `defaultInput` | `("text"\|"image")[]` | `z.array(z.union(MODALITIES)).default(["text"])` | `["text"]` | **must be non-empty** else throw (line 1070) |
| `headers` | `Record<string,string>` | `z.dict(z.string())`, default `{}` | `{}` | each name+value validated by `new Headers([[name,value]])` (`assertValidHeaders`, lines 1036–1042) — a single-line Fetch-representable value; **`null` is not expressible** |
| `reasoning` | `ModelThinkingLevel` | `z.union(THINKING_LEVELS)` | none | validated per model at request time against `getSupportedThinkingLevels` → `LlmError UNSUPPORTED_REASONING_EFFORT` (lines 1691–1695) |
| `thinkingBudgets` | `{minimal?,low?,medium?,high?: number}` | `z.object({minimal:z.number(),low:z.number(),medium:z.number(),high:z.number()})`, default `{}` | `{}` | passed through to pi-ai; pi-ai merges over `DEFAULT_THINKING_BUDGETS` |
| `cacheRetention` | `"none"\|"short"\|"long"` | union, no default | none (pi-ai: `"short"`) | pass-through |
| `transport` | `"sse"\|"websocket"\|"websocket-cached"\|"auto"` | union **in that order**, no default | none | pass-through |
| `timeoutMs` | int ≥ 0 | `z.natural()` | none | pass-through |
| `websocketConnectTimeoutMs` | int ≥ 0 | `z.natural()` | none | pass-through |
| `streamIdleTimeoutMs` | number, `(0, 2147483647]` | `.min(Number.MIN_VALUE).max(2147483647).default(300000)` | 300000 | requires **finite and > 0** (schema's `Number.MIN_VALUE` min does not exclude `0`) — line 1062 |
| `maxRequestImageBytes` | int ≥ 1 | `.step(1).min(1).default(20971520)` | 20971520 | positive integer (line 1064) |
| `requestImagePixelBudget` | int ≥ 1 | `.step(1).min(1).default(4194304)` | 4194304 | positive safe integer (line 1066) |
| `requestImageMaxBytes` | int ≥ 1 | `.step(1).min(1).default(1048576)` | 1048576 | positive safe integer (line 1068) |
| `retryPolicy` | `RetryPolicyConfig` | `RetryPolicySchema` (union), no default | see §7 | `resolveRetryPolicy` (stricter than the schema) |

### 3.1 Fields the task named that do **not** exist at provider level

* **`name` — ABSENT in 0.1.5-rc.2.** The display field is `displayName`. `resolveProfiles` renames
  nothing; any `name:` key under a provider is silently retained by schemastery (see §9) and read
  by nobody.
* Removed pre-release fields are explicitly rejected (`rejectRemovedFields`, index.js:1030–1034):
  * `provider` → "moved to the providers dict key"
  * `maxRetries` / `maxRetryDelayMs` → "removed; compose agent recovery with dsh-llm-retry"
* `providers` as an **array** is rejected: `"providers is now a dict keyed by provider route, not an array of profiles"` (line 1052).
* Per-model `api` / `baseURL` / `temperature` / `headers` — ABSENT (models carry neither; only the
  route does). `PiAiModelProfile` (`catalog.d.ts:257–293`) has exactly the fields in §6.

## 4. Enum vocabularies

### 4.1 `api` — the authoritative legal set (only 3)

`dsh-llm-pi-ai/lib/index.js:754–769`:

```js
const PROTOCOLS = {
	"openai-completions": openAICompletionsApi,
	"openai-responses": openAIResponsesApi,
	"anthropic-messages": anthropicMessagesApi
};
function supportedProtocols() {
	return Object.keys(PROTOCOLS);
}
```

Runtime value: `["openai-completions","openai-responses","anthropic-messages"]` (order is the
schema union order and therefore the configuration surface's default/first choice).

**Not legal as a configured `api`** even though pi-ai itself knows them
(`PI/dist/types.d.ts:15 KnownApi`): `mistral-conversations`, `azure-openai-responses`,
`openai-codex-responses`, `bedrock-converse-stream`, `google-generative-ai`, `google-vertex`,
`pi-messages`. They remain reachable only as **installed-catalog models'** own `api`, because a
route with no `api` keeps each catalog model's protocol.

Resolution-level default for `api` when the route omits it (`sharedCatalogApi`, index.js:532–544):
if every model of the route's installed catalog shares one `api` (`apis.size === 1`), a configured
model the catalog does not describe inherits **that** protocol; if the catalog's models disagree,
such a model must name `api` at the route or resolution fails with
`model "<id>" needs an api; the installed catalog does not describe it, so set the route's api to the
wire protocol its endpoint speaks` (line 667).

### 4.2 Modalities — `MODALITIES`

`index.js:279–282` → `["text","image"]`. (`PiAiModality = Model<Api>['input'][number]`,
`catalog.d.ts:16`.)

### 4.3 ModelThinkingLevel — `THINKING_LEVELS` (7 values, escalation order)

`index.js:296–304`:

```js
const THINKING_LEVELS = Object.keys({
	off: true,
	minimal: true,
	low: true,
	medium: true,
	high: true,
	xhigh: true,
	max: true
});
```

Upstream: `PI/dist/types.d.ts:24–25` —
`ThinkingLevel = "minimal"|"low"|"medium"|"high"|"xhigh"|"max"`,
`ModelThinkingLevel = "off" | ThinkingLevel`.

### 4.4 `thinkingFormat` — `SUPPORTED_THINKING_FORMATS`

`index.js:306–318` (order = "most-reached first"):

```
openai, deepseek, openrouter, together, baseten, zai, qwen,
chat-template, qwen-chat-template, string-thinking, ant-ling
```

### 4.5 `maxTokensField` — `MAX_TOKENS_FIELDS`

`index.js:320–323` → `["max_completion_tokens","max_tokens"]`.

### 4.6 `thinkingTokenBudgetField` — `THINKING_TOKEN_BUDGET_FIELDS`

`index.js:325–329` → `["thinking_token_budget","thinking_budget","thinking_budget_tokens"]`.

### 4.7 `cacheControlFormat`

`index.js:331` → `["anthropic"]` (single value).

### 4.8 `chatTemplateKwargs`/`chatTemplateArgs` values + `$var` placeholders

`index.js:333–337` → `CHAT_TEMPLATE_VARS = ["thinking.enabled","thinking.effort","thinking.budget"]`.

Value union `chatTemplateKwarg` (index.js:919–928): `string | number | boolean | null |
{ $var: <one of the three>, omitWhenOff?: boolean }`; dict keys are strings.

### 4.9 `transport` (the Transport enum)

Schema order (`index.js:1002–1007`): `["sse","websocket","websocket-cached","auto"]`.
Upstream type `PI/dist/types.d.ts:41 Transport = "sse"|"websocket"|"websocket-cached"|"auto"`.

> ⚠ `src/shared/capabilities.ts:124` currently lists `['auto','sse','websocket','websocket-cached']`.
> The **member set is correct**; the **order differs** from the schema. If the plugin presents the
> first entry as the default, it will present `auto` where DSH presents `sse`.

### 4.10 `cacheRetention`

`index.js:997–1001` → `["none","short","long"]`. Upstream default (when absent) is `"short"`
(`PI/dist/types.d.ts:131`).

## 5. `compat` — the complete `PiAiCompatProfile` for this version

Two independent sources, both authoritative and in agreement:

1. **The schemastery schema** `compatProfile` (`index.js:929–956`) — 26 fields, all optional, no
   defaults, values are `boolean` / enum-union / `z.dict(...)` / `z.number().step(1)`.
2. **The compile-time "drift gate" tables** (`COMPLETIONS_COMPAT_GATE`, `RESPONSES_COMPAT_GATE`,
   `ANTHROPIC_COMPAT_GATE`, `BEDROCK_COMPAT_GATE`, `index.js:379–447`; mirrored in
   `catalog.d.ts:74–131`), which classify every upstream field as `"offer"` or `"withhold"`.
   `COMPAT_GATES` (lines 428–447) is keyed by **protocol**.

The schema accepts all 26; `assertOfferedCompatFields` (index.js:517–525) rejects
**withheld** fields and misspellings *before* any protocol resolves:

> `sets compat "<f>", which is not configurable here: pi-ai's installed catalog sets it for the vendors that need it, so name that provider as the route instead`
> `sets compat "<f>", which no wire protocol declares; the configurable switches are …`

### 5.1 The 26 configurable fields, with the protocols that offer them

`offered` per protocol is taken verbatim from `COMPAT_GATES` (index.js:428–447). "Responses×3" =
`openai-responses`, `azure-openai-responses`, `openai-codex-responses` (pi-ai gives them one shared
compat type — `index.js:419–427`).

| # | Field | Type | Schema | Offered on (per `COMPAT_GATES`) |
|---|---|---|---|---|
| 1 | `supportsStore` | boolean | `z.boolean()` | `openai-completions` |
| 2 | `supportsDeveloperRole` | boolean | `z.boolean()` | `openai-completions` + Responses×3 |
| 3 | `supportsReasoningEffort` | boolean | `z.boolean()` | `openai-completions` |
| 4 | `supportsUsageInStreaming` | boolean | `z.boolean()` | `openai-completions` |
| 5 | `supportsFinishReason` | boolean | `z.boolean()` | `openai-completions` |
| 6 | `maxTokensField` | `"max_completion_tokens"\|"max_tokens"` | `z.union(MAX_TOKENS_FIELDS)` | `openai-completions` |
| 7 | `requiresToolResultName` | boolean | `z.boolean()` | `openai-completions` |
| 8 | `requiresAssistantAfterToolResult` | boolean | `z.boolean()` | `openai-completions` |
| 9 | `requiresThinkingAsText` | boolean | `z.boolean()` | `openai-completions` |
| 10 | `requiresReasoningContentOnAssistantMessages` | boolean | `z.boolean()` | `openai-completions` |
| 11 | `thinkingFormat` | 11-value enum (§4.4) | `z.union(SUPPORTED_THINKING_FORMATS)` | `openai-completions` |
| 12 | `chatTemplateKwargs` | `Record<string, ChatTemplateKwargValue>` | `z.dict(chatTemplateKwarg)` | `openai-completions` |
| 13 | `chatTemplateArgs` | same | `z.dict(chatTemplateKwarg)` | `openai-completions` |
| 14 | `supportsThinkingTokenBudget` | boolean | `z.boolean()` | `openai-completions` |
| 15 | `thinkingTokenBudgetField` | 3-value enum (§4.6) | `z.union(THINKING_TOKEN_BUDGET_FIELDS)` | `openai-completions` |
| 16 | `vllmPriority` | number, integer step | `z.number().step(1)` | `openai-completions` |
| 17 | `supportsMaxOutputTokens` | boolean | `z.boolean()` | Responses×3 |
| 18 | `supportsStrictMode` | boolean | `z.boolean()` | `openai-completions` + Responses×3 + `bedrock-converse-stream` |
| 19 | `cacheControlFormat` | `"anthropic"` | `z.union(CACHE_CONTROL_FORMATS)` | `openai-completions` |
| 20 | `supportsLongCacheRetention` | boolean | `z.boolean()` | `openai-completions` + Responses×3 + `anthropic-messages` |
| 21 | `supportsEagerToolInputStreaming` | boolean | `z.boolean()` | `anthropic-messages` |
| 22 | `supportsCacheControlOnTools` | boolean | `z.boolean()` | `anthropic-messages` |
| 23 | `supportsTemperature` | boolean | `z.boolean()` | `anthropic-messages` |
| 24 | `forceAdaptiveThinking` | boolean | `z.boolean()` | `anthropic-messages` |
| 25 | `allowEmptySignature` | boolean | `z.boolean()` | `anthropic-messages` |
| 26 | `supportsStrictTools` | boolean | `z.boolean()` | `anthropic-messages` |

All 26 are accepted by the schema at **route level and at model level**; applicability is enforced
per resolved protocol (see §5.3).

### 5.2 Withheld fields (accepted by pi-ai, **refused** by this DSH version)

From the gates (`index.js:399–405, 413–417, 441–444`):

* `openai-completions`: `openRouterRouting`, `vercelGatewayRouting`, `zaiToolStream`,
  `supportsOpenAIGrammarTools`, `sendSessionAffinityHeaders`, `deferredToolsMode`,
  `sessionAffinityFormat` (7)
* Responses×3: `sessionAffinityFormat`, `supportsOpenAIGrammarTools`, `supportsAdditionalTools`,
  `supportsToolSearch`, `supportsExplicitPromptCacheMode` (5)
* `anthropic-messages`: `sendSessionAffinityHeaders`, `supportsToolReferences`,
  `supportsMidConvoEffort`, `allowedFallbackModels` (4)
* `bedrock-converse-stream`: none withheld

Consequence for the UI: `sendSessionAffinityHeaders` and `sessionAffinityFormat` are
**not configurable**, yet still affect the wire (§10.4) because installed-catalog models set them.

### 5.3 Per-protocol branching — how DSH enforces the mapping

`resolveModelCompat` (`index.js:604–623`):

```js
function resolveModelCompat(provider, entry, route, base, api) {
	const gate = compatGate(api);
	const configured = {};
	for (const [field, value] of configuredCompatEntries(route)) {
		if (gate?.[field] !== "offer") continue;          // route-level: silently skipped
		configured[field] = value;
	}
	for (const [field, value] of configuredCompatEntries(entry.compat)) {
		if (gate?.[field] !== "offer") {
			const offered = offeredCompatFields(api);
			invalid(provider, `model "${entry.id}" sets compat "${field}", but its api is "${api}", which does not take it; that switch exists on ${compatProtocols(field).join(", ")}, and "${api}" offers ${offered.length === 0 ? "no configurable compat" : offered.join(", ")}`);
		}
		configured[field] = value;
	}
	if (Object.keys(configured).length === 0) return {};
	return { compat: {
		...base?.api === api ? base.compat : void 0,
		...configured
	} };
}
```

So the branch is asymmetric and important:

* **Route-level** (`providers.<id>.compat`) — a field the resolved model's protocol does not offer is
  **silently skipped** for that model (a route default must stay settable on a route whose models do
  not all speak one protocol).
* **Model-level** (`models[].compat` / `modelOverrides[].compat`) — a field the model's protocol
  does not offer is a **hard error** naming the field, the api, and the protocols that do take it.
* An unset field falls through: model → route → installed catalog entry → pi-ai's own
  `detectCompat()` from provider id / baseUrl (§5.4).
* `supportsStrictMode` also reaches `bedrock-converse-stream`; that protocol is unreachable from
  DSH configuration (§4.1) but reachable through a catalog model on a route with no `api`.

### 5.4 What pi-ai does when no layer sets a field

`PI/dist/api/openai-completions.js:1235–1357` `detectCompat`/`getCompat`: detection keys off
`model.provider` and `model.baseUrl` (`zai`, `together`, `moonshot`, `openrouter`, `cloudflare*`,
`nvidia`, `ant-ling`, `deepseek`, `xai`, `cerebras`, `opencode`, `chutes`, …), producing defaults
such as `supportsStore: !isNonStandard`, `supportsUsageInStreaming: true`,
`supportsFinishReason: true`, `thinkingFormat: "openai"` (or `deepseek`/`zai`/…),
`maxTokensField: "max_tokens"` for the non-standard set.
`PI/dist/api/openai-responses.js:46–56`: `supportsDeveloperRole ?? true`,
`supportsLongCacheRetention ?? true`, `supportsStrictMode ?? false`,
`sessionAffinityFormat ?? detectSessionAffinityFormat(model)`.

This is exactly why `PiAiCompatProfile` exists: a private gateway's URL matches none of those
predicates, so pi-ai answers "as though it were OpenAI itself" (`catalog.d.ts:141–147`).

## 6. Model level (`models[]`, and `modelOverrides.<id>`)

Schema `modelFields`/`modelProfile`/`modelOverride` (`index.js:968–982`); types
`PiAiModelProfile` (`catalog.d.ts:257–293`).

| Field | Type | Schema | Default / resolution |
|---|---|---|---|
| `id` | `string` (required) | `z.string().required()` | **only in `models[]`**; in `modelOverrides` the id is the dict key and setting an `id` key is refused (`index.js:649`) |
| `name` | `string` | `z.string()` | `entry.name ?? base?.name ?? entry.id` (line 678) |
| `contextWindow` | `number` int ≥ 1 | `z.number().step(1).min(1)` | `entry.contextWindow ?? base?.contextWindow ?? route.defaultContextWindow`; must be a positive integer (lines 670–671) |
| `maxTokens` | `number` int ≥ 1 | `z.number().step(1).min(1)` | `entry.maxTokens ?? base?.maxTokens ?? route.defaultMaxTokens`; a **configured** value additionally becomes the request default for that model via `configuredMaxTokens` (lines 672–674, 1806–1813) |
| `input` | `("text"\|"image")[]` | `z.array(z.union(MODALITIES))`, default `[]` | `[]`/absent → catalog `input` → `route.defaultInput` (`declaredInput`, line 682) |
| `reasoningEfforts` | `false \| Partial<Record<ModelThinkingLevel, string\|null>>` | `z.union([z.const(false), z.dict(z.union([z.string(), z.const(null)]), z.union(THINKING_LEVELS))])` | absent → catalog's `reasoning` (or `false` for a hand-declared model). `false` → non-reasoning. A dict must be non-empty, must offer ≥1 level beyond `off`, only `off` may map to `null`, no empty wire strings (lines 562–585) |
| `compat` | `PiAiCompatProfile` | `compatProfile`, default `{}` | wins over route `compat` field-by-field (§5.3) |

Forbidden on a `modelOverrides` entry: `id` (line 649). `modelOverrides` is refused when the route
also has a `models` list, when the route is not described by the installed catalog, and (strict
mode) when the id is unknown (lines 640–650).

Not present at model level: `api`, `baseURL`, `headers`, `temperature`, `cost`
(`cost` is filled from the catalog or `NO_COST = {input:0,output:0,cacheRead:0,cacheWrite:0}`,
lines 272–277, 683).

## 7. `retryPolicy` — full `RetryPolicyConfig` and DSH defaults

Schema and resolver live in `@deepseek-ai/dsh-llm`; `dsh-llm-pi-ai` embeds `RetryPolicySchema` and
calls `resolveRetryPolicy(policy, 'llm-pi-ai: provider "<route>" retryPolicy')` (index.js:1110).

`dsh-llm/lib/types/retry-policy.js:12–42`:

```js
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10_000;
const DEFAULT_JITTER_RATIO = 0.1;
const DEFAULT_RETRYABLE_CODES = Object.freeze([
    EMPTY_RESPONSE_CODE,   // "EMPTY_RESPONSE"  (dsh-llm/lib/index.js:143)
    'RATE_LIMIT',
    'SERVER',
    'TIMEOUT',
    'TRANSPORT',
]);
const backoffSchema = z.object({
    initialDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
    maxDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
    jitterRatio: z.number().min(0).max(1).default(DEFAULT_JITTER_RATIO),
});
const normalPolicySchema = z.object({
    mode: z.const('normal').required(),
    maxRetries: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
    retryableCodes: z.array(z.string()).default([...DEFAULT_RETRYABLE_CODES]),
    backoff: backoffSchema,
});
const alwaysPolicySchema = z.object({
    mode: z.const('always').required(),
    backoff: backoffSchema,
});
export const RetryPolicySchema = z.union([normalPolicySchema, alwaysPolicySchema]);
```

Shape:

* `mode`: `"normal" | "always"` — **required** (both members are `z.const(...).required()`).
* `normal`: `maxRetries?: int ≥ 0` (default 5), `retryableCodes?: string[]` (default the 5 codes),
  `backoff?`.
* `always`: `backoff?` only. `maxRetries`/`retryableCodes` are accepted-but-ignored
  (`ALWAYS_POLICY_KEYS` deliberately still lists them, lines 48–50).
* `backoff`: `{ initialDelayMs?, maxDelayMs?, jitterRatio? }` with schema defaults 500 / 10000 / 0.1.

**Defaults DSH applies when the field is absent entirely** (`resolveRetryPolicy(undefined, …)`,
lines 84–91):

```js
{ mode: 'normal', maxRetries: 5,
  retryableCodes: ['EMPTY_RESPONSE','RATE_LIMIT','SERVER','TIMEOUT','TRANSPORT'],
  initialDelayMs: 500, maxDelayMs: 10000, jitterRatio: 0.1 }   // frozen
```

**The resolver is strictly stricter than the schema** (lines 58–126) — a UI that only satisfies the
schema can still save config that throws at resolution:

* `initialDelayMs` / `maxDelayMs`: finite, **> 0**, ≤ `MAX_TIMER_DELAY_MS = 2147483647`;
  `initialDelayMs ≤ maxDelayMs` (the schema accepts `0` and would then throw).
* `jitterRatio`: finite, `0 ≤ x ≤ 1`.
* `normal.retryableCodes`: **non-empty**, every entry a non-empty string, **no duplicates**
  (error text: `must not be empty` / `must contain only non-empty strings` / `must not contain duplicates`).
* Unknown keys rejected by both modes: `validateKeys(config, NORMAL_POLICY_KEYS, path)` →
  `` `${path}: unknown key "${key}"` ``.

Message codes: the five default retryable codes are `EMPTY_RESPONSE`, `RATE_LIMIT`, `SERVER`,
`TIMEOUT`, `TRANSPORT` (`dsh-llm/lib/index.js:234–241`); `EMPTY_RESPONSE_CODE` is defined in
`dsh-llm/lib/types/error.js:34`, alongside `CONTEXT_WINDOW_EXCEEDED` (`:22`), `QUOTA` (`:24`, note:
the constant is `QUOTA_EXCEEDED_CODE` but its value is the string `'QUOTA'`) and
`INVALID_CREDENTIAL` (`:42`).

## 8. ModelThinkingLevel → wire value mapping

DSH itself performs **no** level→string translation. The mapping is two-layered:

1. **DSH** (`resolveModelReasoning`, `index.js:562–585`) converts a configured
   `models[].reasoningEfforts` dict into pi-ai's `Model.thinkingLevelMap`:
   declared levels get their wire spelling, **undeclared levels are pinned to `null`
   (unsupported)** — except `off` mapping to `null`, which stays *absent*, meaning
   "supported, send nothing". `off` with a string sends that string.
2. **pi-ai** dispatch (`PI/dist/api/openai-completions.js:634–736`) reads
   `model.thinkingLevelMap?.[reasoningEffort] ?? reasoningEffort` and shapes the request per
   `compat.thinkingFormat`. A few formats special-case `off` (`openrouter` sends
   `reasoning:{effort: <off ?? "none">}`, `string-thinking` sends `thinking: <off ?? "none">`,
   `deepseek` sends `thinking:{type:"disabled"}`, `zai` sends `thinking:{type:"disabled"}`,
   `qwen` sends `enable_thinking:false`, `ant-ling` omits `reasoning` when the mapped effort is null).

Level ordering (`PI/dist/models.js:550–562`):

```js
const EXTENDED_THINKING_LEVELS = ["off","minimal","low","medium","high","xhigh","max"];
export function getSupportedThinkingLevels(model) {
    if (!model.reasoning) return ["off"];
    return EXTENDED_THINKING_LEVELS.filter((level) => {
        const mapped = model.thinkingLevelMap?.[level];
        if (mapped === null) return false;
        if (level === "xhigh" || level === "max") return mapped !== undefined;
        return true;
    });
}
```

* Unmapped base levels are treated as **supported**; `xhigh`/`max` are treated as supported
  **only if explicitly mapped**. This asymmetry is precisely why DSH pins undeclared levels to
  `null` (`index.js:548–556`).
* `"off"` is never forwarded to pi-ai as a reasoning effort: `profileOptions` drops it
  (`enabledReasoning = reasoning === "off" ? undefined : reasoning`, index.js:1661–1664), because
  `SimpleStreamOptions.reasoning?: ThinkingLevel` excludes `off`.
* Thinking **budgets** (`thinkingBudgets`) use `PI/dist/api/simple-options.js`:

  ```js
  export const DEFAULT_THINKING_BUDGETS = { minimal: 1024, low: 2048, medium: 8192, high: 16384 };
  export function clampReasoning(effort) { return effort === "xhigh" || effort === "max" ? "high" : effort; }
  ```

  So **`xhigh` and `max` both fall back to the `high` budget (16384)** unless `thinkingBudgets.high`
  is configured; there is no separate budget key for them.
* The harness's own `ReasoningEffortId` is an opaque branded string with no validation
  (`dsh-llm/lib/index.js:875–877`); the adapter validates the incoming
  `GenerateOptions.reasoningEffort` against `getSupportedThinkingLevels` (index.js:1691–1695) and
  otherwise raises `LlmError … "UNSUPPORTED_REASONING_EFFORT"`.

## 9. Unknown keys, precedence of configuration layers, strict vs deferred

* **schemastery does not reject unknown keys.** `Schema.resolve(data, schema, options = {}, strict = false)`
  (`schemastery/src/index.ts:470`); the object validator merges unknown keys when `!strict`
  (`src/index.ts:752–762`: `if (!strict) merge(result, data)`). `Schema.prototype.toJSON()` is what
  configuration surfaces render, and `installSection` calls it (`dsh-settings/lib/index.js:363`).
  Practical effect: a typo like `baseUrl` or `name` under a provider is **silently retained and
  ignored**, *except* for the two explicitly rejected legacy keys and everything validated later
  (`retryPolicy` unknown keys, unknown `compat` keys, `modelOverrides` beside `models`, …).
* **Strict vs deferred** (`resolveProfiles(providers, validation = "strict")`,
  `index.js:1051–1120`): settings **writes** use `assertServiceable` → strict, which rejects any new
  or changed profile that cannot be served (`index.js:1026–1028`; unchanged stored profiles are not
  re-validated, so catalog drift never blocks editing another provider). Stored **reads** and adapter
  operation use `"deferred"`: `PiAiCatalogError`s become per-model `modelErrors` diagnostics plus one
  `catalogError`, and the route stays visible/editable (`index.js:1096–1099`).
* `provider` and `maxRetries`/`maxRetryDelayMs` are the only keys with rename/deprecation errors.

## 10. Reserved / attribution headers

### 10.1 What DSH injects

`dsh-llm/lib/types/attribution.js:21–45`:

```js
export const APP_IDENTITY = {
    product: 'deepseek-harness',
    version,                                   // read from dsh-llm/package.json → 0.1.5-rc.2
    url: 'https://github.com/deepseek-ai/deepseek-harness',
};
export function userAgent(identity = APP_IDENTITY) {
    return `${identity.product}/${identity.version} (+${identity.url})`;
}
export function attributionHeaders(identity = APP_IDENTITY) {
    return { 'user-agent': userAgent(identity) };
}
```

**The reserved set is exactly one name: `user-agent`** (lowercase). There is no way to suppress it
("nothing can suppress attribution entirely", `attribution.d.ts:26–29`).

Wire value observed: `deepseek-harness/0.1.5-rc.2 (+https://github.com/deepseek-ai/deepseek-harness)`.

### 10.2 Precedence for LLM stream calls — configured `headers` vs reserved

`dsh-llm-pi-ai/lib/index.js:1722–1730`:

```js
/** Merge deployment headers while removing case-insensitive attribution collisions. */
function requestHeaders(headers) {
	const attribution = attributionHeaders();
	const reserved = new Set(Object.keys(attribution).map((name) => name.toLowerCase()));
	return {
		...Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => !reserved.has(name.toLowerCase()))),
		...attribution
	};
}
```

applied at the only stream call site, `index.js:1873`: `headers: requestHeaders(profile.headers)`.
So at the DSH layer: **configured `headers` are filtered case-insensitively against `{user-agent}`,
then the harness value is added.** A configured `User-Agent` / `user-agent` never reaches pi-ai.

**Only `user-agent` is filtered by DSH.** `authorization`, `x-api-key`, `anthropic-beta`,
`accept`, … are all passed through untouched.

### 10.3 What actually reaches the wire (empirically verified)

I drove the real pi-ai + openai/anthropic SDK stack with a capturing fetch, using DSH's exact
`requestHeaders()` output and a configured `headers` set of
`{ 'X-Custom': 'yes', 'user-agent': 'USER-SUPPLIED-UA', 'Authorization': 'Bearer USER' }`.

`openai-completions` (`POST {baseURL}/chat/completions`):

```json
{ "accept":"application/json", "authorization":"Bearer USER", "content-type":"application/json",
  "user-agent":"deepseek-harness/0.1.5-rc.2 (+https://github.com/deepseek-ai/deepseek-harness)",
  "x-custom":"yes",
  "x-stainless-arch":"arm64", "x-stainless-lang":"js", "x-stainless-os":"MacOS",
  "x-stainless-package-version":"6.40.0", "x-stainless-retry-count":"0",
  "x-stainless-runtime":"node", "x-stainless-runtime-version":"v24.19.0" }
```

`openai-responses` (`POST {baseURL}/responses`): byte-for-byte the same header set as
`openai-completions` above (both go through the same openai SDK client constructor).

`anthropic-messages` (`POST {baseURL}/v1/messages?beta=true`):

```json
{ "accept":"application/json", "anthropic-dangerous-direct-browser-access":"true",
  "anthropic-version":"2023-06-01", "authorization":"Bearer USER", "content-type":"application/json",
  "user-agent":"deepseek-harness/0.1.5-rc.2 (+…)",
  "x-api-key":"<the resolved key>", "x-custom":"yes",
  "x-stainless-*": "…", "x-stainless-timeout":"600" }
```

Conclusions — 1, 2 and 4 are reproduced by the probes above; 3 is code-derived from the SDK merge
order and was not exercised:

1. **`user-agent` is fully overridden by DSH's value — pi-ai's own
   `pi (darwin <release>; arm64)` UA never appears.** Mechanism: pi-ai builds
   `{ "User-Agent": getPiUserAgent(), ...model.headers }` then `Object.assign(headers, optionsHeaders)`
   (`PI/dist/api/openai-completions.js:534–545`, `openai-responses.js:175–190`,
   `anthropic-messages.js:151–161 mergeHeaders`/`mergeClientHeaders`), so the object carries both
   `User-Agent` and `user-agent`; the OpenAI SDK's `iterateHeaders` clears-then-sets **per key** for
   a plain object (`openai/internal/headers.mjs:33–41`, `:50–72`), and the later lowercase key wins.
   Because DSH's key sorts last, DSH wins. Net precedence: **Harness attribution > provider `headers`.**
2. **A configured `authorization` beats the resolved API key** on the OpenAI protocols: the
   configured value (`Bearer USER`) replaced the SDK bearer (`Bearer sk-…`). Reason:
   `defaultHeaders` is merged *after* `authHeaders` in the SDK
   (`openai/client.mjs:602–625`, order: idempotency → SDK defaults/UA → `authHeaders` →
   `this._options.defaultHeaders` → body headers → per-request headers).
   On `anthropic-messages` the SDK's `x-api-key` **and** the configured `authorization` are both sent.
   **DSH does not guard `authorization` or `x-api-key`** — only `user-agent`.
3. **`x-stainless-*` headers are always present** (SDK-generated) and, by the same merge-order
   argument, a configured header of the same name would override them. *Code-derived, not probed.*
4. **`content-type` / `accept`** come from the SDK; a configured `accept` would override it on the
   stream path (but not on discovery, §11).

### 10.4 Session attribution headers — the biggest hidden reserved set

`dsh-llm-pi-ai/lib/index.js:1871` always forwards the harness session id:

```js
...options.sessionId === void 0 ? {} : { sessionId: String(options.sessionId) },
```

and the agent loop always supplies one (`dsh-agent-loop/lib/index.js:1215`:
`sessionId: this.session.id`). pi-ai then injects session-affinity headers, gated **differently per
protocol**. Verified by probe with `sessionId: "SESS-42"`:

| api | compat | injected headers |
|---|---|---|
| `openai-completions` | none | *(none)* |
| `openai-completions` | `sendSessionAffinityHeaders:true, sessionAffinityFormat:"openai"` | `session_id`, `x-client-request-id`, `x-session-affinity` |
| `openai-completions` | `sendSessionAffinityHeaders:true, sessionAffinityFormat:"openrouter"` | `x-session-id` |
| `openai-responses` | **none** | **`session_id`, `x-client-request-id`** |
| `openai-responses` | `sessionAffinityFormat:"openai"` | `session_id`, `x-client-request-id` |
| `openai-responses` | `sessionAffinityFormat:"openrouter"` | `x-session-id` |
| `anthropic-messages` | none | *(none)* |
| `anthropic-messages` | `sendSessionAffinityHeaders:true` | `x-session-affinity` |

Code: `PI/dist/api/openai-completions.js:557–570` (gated on `compat.sendSessionAffinityHeaders`),
`PI/dist/api/openai-responses.js:184–195` (**`if (sessionId)` with no gate**),
`PI/dist/api/anthropic-messages.js:724–726` (gated on `sendSessionAffinityHeaders`).

**Therefore: every `openai-responses` route emits a per-session `session_id` and
`x-client-request-id` header, always, and DSH cannot switch it off** (both
`sendSessionAffinityHeaders` and `sessionAffinityFormat` are withheld compat fields, §5.2;
the default format is `"openai"` unless the provider is `openrouter` —
`PI/dist/api/openai-responses.js:35–37`). The live `settings.yaml` route `router` and
`deepseek-v4-flash` both use `api: openai-responses`, so both already do this.

For `openai-completions` and `anthropic-messages`, session headers appear only for installed-catalog
models that set `sendSessionAffinityHeaders`/`sessionAffinityFormat` in their catalog compat — e.g.
`fireworks` (`anthropic-messages`), `cloudflare-workers-ai` (`openai-completions`),
`opencode` (`openai-responses`, `sessionAffinityFormat: "openai-nosession"`). Files:
`PI/dist/providers/data/{fireworks,cloudflare-workers-ai,opencode,opencode-go,cloudflare-ai-gateway}.json`.

Related body parameter (not a header): `prompt_cache_key` is derived from `sessionId` plus
`cacheRetention` (`PI/dist/api/openai-completions.js:576–583`).

`sessionId` is also the only per-request value the harness forwards for attribution — the pi-ai
adapter injects **no** `x-deepseek-harness-*` / `x-dsh-*` headers (`grep` over
`dsh-llm-pi-ai/lib/index.js` for `"x-` yields only the discovery `x-api-key`). Contrast
`dsh-llm-deepseek/lib/index.js:1654–1664`, which does inject
`x-deepseek-harness-user-id`, `x-deepseek-harness-session-id`, and `x-deepseek-harness-compact` —
the pi-ai adapter deliberately does not.

### 10.5 `github-copilot` dynamic headers

pi-ai adds Copilot-specific dynamic headers when `model.provider === "github-copilot"`
(`openai-completions.js:546–552`, `anthropic-messages.js:687–704`). Those come from installed catalog
compat, are not configurable, and are not `user-agent`.

## 11. Model discovery ("Get Models") call chain

Entry point and registration: `dsh-llm-pi-ai/lib/index.js:2629–2642`.

```js
	const storedDiscoveryProfile = (provider) => {
		if (provider === void 0) return void 0;
		const profile = profiles().get(provider);
		if (profile === void 0) return void 0;
		return { headers: profile.headers, resolveApiKey: () => resolveApiKey(provider, profile) };
	};
	ctx.llm.registerModelDiscovery(NS, (request, signal) => discoverModels({
		...request,
		...signal === void 0 ? {} : { signal }
	}, () => storedDiscoveryProfile(request.provider)));
```

Request shape (`dsh-llm/lib/types/types.d.ts:229–251`): `{ provider?, baseURL?, api?, apiKey?, signal? }`.
`LlmDiscoveredModel = { id, name?, contextWindow?, maxTokens? }`.

`discoverModels` (`index.js:2272–2322`):

1. **Catalog short-circuit (no network).** If `request.provider` names a route pi-ai ships and
   `catalogModels(provider).size > 0`, return the installed catalog verbatim
   (`{id,name,contextWindow,maxTokens}`). No headers, no credentials, no HTTP.
2. **Require an endpoint** when there is no catalog:
   `"pi-ai ships no catalog for provider "…", so its models can only come from its endpoint; set a baseURL, or enter this provider's models by hand"` (`DISCOVERY_FAILED`).
3. **Protocol allow-list** (`index.js:2126–2130`):
   `LISTABLE_PROTOCOLS = { "anthropic-messages", "openai-completions", "openai-responses" }`.
   `api` defaults to `"openai-completions"` when the draft names none (line 2283); anything else →
   `"has no model listing this build can read; enter this provider's models by hand"`
   (`DISCOVERY_UNSUPPORTED`).
4. **URL** (`listingUrl`, lines 2162–2166): base with trailing slashes stripped, treated as a
   **prefix** (not `new URL()` resolution), then
   * non-anthropic → `{base}/models`
   * anthropic → `{base-without-one-trailing-/v1}/v1/models?limit=1000`
     (`ANTHROPIC_MODEL_LIMIT = 1e3`, `ANTHROPIC_VERSION = "2023-06-01"`).
5. **Credential**: `request.apiKey` (the draft's one-shot key) wins; otherwise
   `storedProfile().resolveApiKey()` — i.e. the **configured route's** credential. Missing key is
   fine (unauthenticated probe); a blank/illegal key is refused before the request
   (`usableProbeKey`, lines 2257–2261, `INVALID_CREDENTIAL_CODE`).
6. **Headers** (`index.js:2290–2302`) — note this precedence **differs from the stream path**:

   ```js
   const headers = new Headers(stored?.headers === void 0 ? void 0 : Object.entries(stored.headers));
   headers.set("accept", "application/json");
   if (api === "anthropic-messages") {
       headers.set("anthropic-version", ANTHROPIC_VERSION);
       if (apiKey !== void 0) headers.set("x-api-key", apiKey);
   } else if (apiKey !== void 0) headers.set("authorization", `Bearer ${apiKey}`);
   for (const [name, value] of Object.entries(attributionHeaders())) headers.set(name, value);
   ```

   * The configured provider `headers` **are used** (as the base).
   * `accept`, `anthropic-version`, `authorization`/`x-api-key`, and `user-agent` are then **forced**
     over them (unlike the stream path, where a configured `authorization` wins).
   * A draft that names no `provider` (a brand-new route) gets **no** configured headers.
7. **Bounded read**: 4 MiB ceiling (`MAX_RESPONSE_BYTES`, line 2142), checked against
   `content-length` first and then enforced on bytes actually read; overflow is a rejection, not a
   truncation (`readBounded`, lines 2173–2204).
8. **Parse** (`readListing`, lines 2219–2248): prefers a `data` array; else a `models` **object map**
   (non-object properties ignored), using the map key as the endpoint-facing id (nested `id` only as
   a fallback); rows without a usable id are skipped; name falls back to id; capacities read from
   `contextWindow|context_window|context_length|max_input_tokens|limit.context` and
   `maxOutputTokens|max_output_tokens|maxTokens|max_tokens|limit.output|top_provider.max_completion_tokens`.
9. Failure codes: `DISCOVERY_FAILED` (unreachable / non-2xx / non-JSON / no listing shape) with
   `"; check the API key"` appended on 401/403; `ABORTED` on cancellation.

Nothing discovered is persisted — `settings.yaml` remains the only source of truth for what a route
serves (`discovery.d.ts:11–14`).

## 12. Which compat field applies to which protocol — quick reference

Derived from `COMPAT_GATES` (`index.js:428–447`), restricted to the three selectable `api` values:

| Protocol | offered compat fields |
|---|---|
| `openai-completions` | `supportsStore, supportsDeveloperRole, supportsReasoningEffort, supportsUsageInStreaming, supportsFinishReason, maxTokensField, requiresToolResultName, requiresAssistantAfterToolResult, requiresThinkingAsText, requiresReasoningContentOnAssistantMessages, thinkingFormat, chatTemplateKwargs, chatTemplateArgs, supportsThinkingTokenBudget, thinkingTokenBudgetField, vllmPriority, supportsStrictMode, cacheControlFormat, supportsLongCacheRetention` (19) |
| `openai-responses` | `supportsDeveloperRole, supportsMaxOutputTokens, supportsStrictMode, supportsLongCacheRetention` (4) |
| `anthropic-messages` | `supportsEagerToolInputStreaming, supportsLongCacheRetention, supportsCacheControlOnTools, supportsTemperature, forceAdaptiveThinking, allowEmptySignature, supportsStrictTools` (7) |

(Plus, for installed-catalog models only: `supportsStrictMode` on `bedrock-converse-stream`, and the
Responses-set on `azure-openai-responses` / `openai-codex-responses`.)

`src/shared/capabilities.ts:165–333` already matches this mapping for the three selectable
protocols. One nuance to consider: if the plugin ever renders compat for a **catalog model whose own
api** is `azure-openai-responses` or `openai-codex-responses`, those four Responses fields apply too.

## 13. Live `~/.dsh/settings.yaml` — how it maps

```yaml
llm-pi-ai:
  providers:
    deepseek-v4-flash:
      displayName: Ark                    # displayName ✔
      apiKeyEnv: DEEPSEEK_V4_FLASH_API_KEY # credential ref, /^[A-Za-z_][A-Za-z0-9_]*$/ ✔
      api: openai-responses               # legal enum ✔
      baseURL: https://ark.cn-beijing.volces.com/api/coding/v3
      models:
        - id: deepseek-v4-flash
          name: deepseek-v4-flash
          contextWindow: 1000000
          maxTokens: 256000
        - id: glm-5.3-flash
          name: glm-5.3-flash
      retryPolicy:
        mode: always
        backoff: { initialDelayMs: 2000, maxDelayMs: 300000, jitterRatio: 0.2 }
    router:
      displayName: Router
      apiKeyEnv: ROUTER_API_KEY
      api: openai-responses
      baseURL: http://127.0.0.1:3456/v1
      models:
        - id: opencode.ai/deepseek-v4.1-flash
          name: opencode-ds-v4.1-flash
          input: [text, image]            # models[].input ✔
      retryPolicy:
        mode: always
        backoff: { initialDelayMs: 2000, maxDelayMs: 300000, jitterRatio: 0.2 }
```

Everything in the live file is expressible by the schema. Both routes use `api: openai-responses`,
hence both emit `session_id` + `x-client-request-id` on every request (§10.4) and pi-ai's
openai-responses compat defaults (`supportsDeveloperRole: true`,
`supportsLongCacheRetention: true`, `supportsStrictMode: false`,
`sessionAffinityFormat: "openai"`).

## 14. ABSENT in 0.1.5-rc.2 (explicit findings)

| Considered | Verdict |
|---|---|
| provider-level `name` | **ABSENT** — use `displayName` |
| provider-level `provider` | **ABSENT + explicitly rejected** ("moved to the providers dict key") |
| provider-level `maxRetries`, `maxRetryDelayMs` | **ABSENT + explicitly rejected** ("compose agent recovery with dsh-llm-retry") |
| provider-level `api` values beyond the 3 in §4.1 | **REJECTED** (`z.union` of 3 consts) |
| per-model `api`, `baseURL`, `headers`, `temperature` | **ABSENT** |
| `compat.sendSessionAffinityHeaders`, `sessionAffinityFormat`, `openRouterRouting`, `vercelGatewayRouting`, `zaiToolStream`, `supportsOpenAIGrammarTools`, `deferredToolsMode`, `supportsAdditionalTools`, `supportsToolSearch`, `supportsExplicitPromptCacheMode`, `supportsToolReferences`, `supportsMidConvoEffort`, `allowedFallbackModels` | **PRESENT upstream, WITHHELD here** — configuring them throws by name |
| any harness `x-deepseek-harness-*` / `x-dsh-*` header on pi-ai requests | **ABSENT** (exists only in `dsh-llm-deepseek`) |
| ability to suppress attribution `user-agent` | **ABSENT** — reserved and forced |
| `headers` value of `null` (pi-ai's suppression mechanism) | **ABSENT** — `z.dict(z.string())` accepts strings only |

## 15. Uncertain / UNVERIFIED

* **`thinkingBudgets` values are unvalidated** (any `number`, including negative or non-integer —
  `z.number()`). How pi-ai clamps a negative budget was not traced. Marked UNVERIFIED.
* **Exact `Adapter`/UI error surface for a withheld compat key** (the `LlmError` code vs a settings
  validation error) was read but not exercised end-to-end. The throw itself is verified by code
  (`invalid(...)` → `PiAiCatalogError`), the transport to the UI is not.
* **Whether any settings layer imposes `strict` schemastery validation** on `llm-pi-ai`. `installSection`
  passes the schema straight to `settings.register(ns, schema, …)` (`dsh-settings/lib/index.js:327–335`)
  and no `strict` flag was found in `dsh-settings/lib/index.js`; by default schemastery is
  non-strict, so unknown keys pass. Confirmed for direct `Config(...)` calls; not re-confirmed
  through a live settings write.
* The `mcp`/`typert` remote-error mapping for discovery (`llm/model-discovery-rejected`) was noted in
  types but not traced through the wire.

## 16. Verbatim reference blocks

`dsh-llm-pi-ai/lib/types/catalog.d.ts:156–228` (`PiAiCompatProfile`, abridged comment headers kept
in place above; field list is exhaustive):

```ts
export interface PiAiCompatProfile {
    supportsStore?: boolean;                                   // openai-completions
    supportsDeveloperRole?: boolean;                           // openai-completions + Responses×3
    supportsReasoningEffort?: boolean;                         // openai-completions
    supportsUsageInStreaming?: boolean;                        // openai-completions
    supportsFinishReason?: boolean;                            // openai-completions
    maxTokensField?: NonNullable<OpenAICompletionsCompat['maxTokensField']>;
    requiresToolResultName?: boolean;
    requiresAssistantAfterToolResult?: boolean;
    requiresThinkingAsText?: boolean;
    requiresReasoningContentOnAssistantMessages?: boolean;
    thinkingFormat?: PiAiThinkingFormat;
    chatTemplateKwargs?: NonNullable<OpenAICompletionsCompat['chatTemplateKwargs']>;
    chatTemplateArgs?: NonNullable<OpenAICompletionsCompat['chatTemplateArgs']>;
    supportsThinkingTokenBudget?: boolean;
    thinkingTokenBudgetField?: PiAiThinkingTokenBudgetField;
    vllmPriority?: number;
    supportsMaxOutputTokens?: boolean;                         // Responses×3
    supportsStrictMode?: boolean;                              // completions + Responses×3 + bedrock
    cacheControlFormat?: NonNullable<OpenAICompletionsCompat['cacheControlFormat']>;
    supportsLongCacheRetention?: boolean;                      // completions + Responses×3 + anthropic
    supportsEagerToolInputStreaming?: boolean;                 // anthropic-messages
    supportsCacheControlOnTools?: boolean;                     // anthropic-messages
    supportsTemperature?: boolean;                             // anthropic-messages
    forceAdaptiveThinking?: boolean;                           // anthropic-messages
    allowEmptySignature?: boolean;                             // anthropic-messages
    supportsStrictTools?: boolean;                             // anthropic-messages
}
```

Two compile-time gates guarantee the list cannot drift from pi-ai
(`catalog.d.ts:229–255`): `EveryProfileFieldIsOffered` (every documented field must be `"offer"` on
some protocol) and `EveryProfileFieldMatchesUpstream` (each field's type must equal the upstream
intersection type, in both directions).

`dsh-llm-pi-ai/lib/types/catalog.d.ts:68`:

```ts
export type PiAiReasoningEfforts = Partial<Record<ModelThinkingLevel, string | null>>;
```

`dsh-llm-pi-ai/lib/types/config.d.ts:21–50` default declarations:
`DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000`, `DEFAULT_MAX_REQUEST_IMAGE_BYTES`,
`DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET`, `DEFAULT_REQUEST_IMAGE_MAX_BYTES`,
`DEFAULT_CONTEXT_WINDOW = 262144`, `DEFAULT_MAX_TOKENS = 32768`, `DEFAULT_INPUT: readonly PiAiModality[]`.

`dsh-llm/lib/types/attribution.js:43–45`:

```js
export function attributionHeaders(identity = APP_IDENTITY) {
    return { 'user-agent': userAgent(identity) };
}
```

## 17. Appendix — how the empirical claims were produced

No project file was modified. Three throwaway Node ESM scripts under `/tmp` were executed against the
installed runtime:

1. **Schema dump.** `Config.toJSON()` from
   `…/@deepseek-ai/dsh-llm-pi-ai/lib/index.js`, walked recursively resolving `refs`, to produce the
   complete field/type/default tree quoted in §2–§7.
2. **Default materialization.** `Config({ providers: { p: { … } } })` to observe exactly which keys
   schemastery writes and with what values (§2.1).
3. **Header capture.** `createProvider` + `createModels` from `@earendil-works/pi-ai` with a
   `models` entry per protocol, an injected `fetch` that records
   `Object.fromEntries(new Headers(init.headers).entries())`, and options
   `{ apiKey, maxRetries: 0, fetch, headers: requestHeaders(<configured>) }` — i.e. DSH's exact
   option shape (`index.js:1867–1874`). The api implementations were imported through the same lazy
   factories DSH uses (`@earendil-works/pi-ai/api/*.lazy`), because the `.lazy` export is what
   `PROTOCOLS` holds. The provider `auth.apiKey.resolve` was stubbed to return a fixed key.

Caveat: these probes exercise the *pi-ai + SDK* layers exactly; they do not exercise DSH's own
credential resolution or the settings write path.

