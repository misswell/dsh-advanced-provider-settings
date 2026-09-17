# DSH Retry Subsystem — Recon Report (0.1.5-rc.2)

Read-only reconnaissance. No source was created or modified.

**Root path convention.** All `…/dsh-llm/...` paths below are relative to

```text
$DSH = /Users/guofeng/Library/Application Support/DeepSeek Harness Desk/runtime/dsh/0.1.5-rc.2/node_modules/@deepseek-ai
```

**Version.** Every package inspected is `0.1.5-rc.2` (`package.json` → `"version": "0.1.5-rc.2"`).

**Files carrying ground truth**

| File | Role |
|---|---|
| `$DSH/dsh-llm/lib/types/retry-policy.d.ts` | `RetryPolicyConfig` / `ResolvedRetryPolicy` types |
| `$DSH/dsh-llm/lib/types/retry-policy.js` | **The schema + resolver (canonical, 127 lines)** |
| `$DSH/dsh-llm/lib/index.js` (L234–L320) | Identical bundled runtime copy of the above |
| `$DSH/dsh-llm-retry/lib/index.js` | The executor plugin (backoff + waterfall listener) |
| `$DSH/dsh-llm-retry/lib/types/types.d.ts` | `llm/retry` + `llm/retry-started` durable event payloads |
| `$DSH/dsh-llm-pi-ai/lib/index.js` | Per-provider `retryPolicy` schema embed + settings wiring |
| `$DSH/dsh-llm-deepseek/lib/index.js` | Route-level `retryPolicy` for `deepseek-official` |

---

## 0. TL;DR

- `RetryPolicyConfig` is a **2-variant discriminated union** on `mode`: `normal` | `always`.
- `mode` is **required** whenever `retryPolicy` is present (`retryPolicy: {}` is invalid).
- `retryableCodes` is **`z.array(z.string())` — an OPEN list. Arbitrary/custom codes are accepted** by the schema *and* by the resolver. There is no enum.
- Defaults (empirically verified by executing the installed code, see §6): `maxRetries=5`, `retryableCodes=[EMPTY_RESPONSE, RATE_LIMIT, SERVER, TIMEOUT, TRANSPORT]`, `initialDelayMs=500`, `maxDelayMs=10000`, `jitterRatio=0.1`.
- `retryPolicy` is **per provider route** (`llm-pi-ai.providers.<id>.retryPolicy`), never per model.
- Invalid values **throw** (they are neither clamped nor ignored). Two independent layers throw: schemastery `RetryPolicySchema` at settings-validation time, and `resolveRetryPolicy()` at profile-resolution time.

---

## 1. The full `RetryPolicyConfig` schema, verbatim

### 1.1 TypeScript shape

`$DSH/dsh-llm/lib/types/retry-policy.d.ts` L10–L58:

```ts
/** Bounded exponential backoff with symmetric jitter around each local delay. */
export interface BackoffConfig {
    /** Initial local exponential-backoff delay in milliseconds (default 500). */
    initialDelayMs?: number;
    /** Maximum locally scheduled or accepted provider delay in milliseconds (default 10000). */
    maxDelayMs?: number;
    /** Symmetric random multiplier range around one (default 0.1). */
    jitterRatio?: number;
}
/** Current bounded transient retry behavior for one provider route. */
export interface NormalRetryPolicyConfig {
    /** Retry only configured transient failure codes. */
    mode: 'normal';
    /** Maximum eligible retries after the first request (default 5). */
    maxRetries?: number;
    /** Stable failure codes eligible for this policy. */
    retryableCodes?: string[];
    /** Local exponential-backoff and jitter configuration. */
    backoff?: BackoffConfig;
}
/** Unbounded retry behavior for every model-request failure on one provider route. */
export interface AlwaysRetryPolicyConfig {
    /** Retry every model-request failure until success, cancellation, or disposal. */
    mode: 'always';
    /** Local exponential-backoff and jitter configuration. */
    backoff?: BackoffConfig;
}
/** Provider-owned model-request retry policy configuration. */
export type RetryPolicyConfig = NormalRetryPolicyConfig | AlwaysRetryPolicyConfig;
/** Fully resolved backoff shared by both retry modes. */
export interface ResolvedRetryBackoff {
    readonly initialDelayMs: number;
    readonly maxDelayMs: number;
    readonly jitterRatio: number;
}
/** Fully resolved bounded transient retry policy. */
export interface ResolvedNormalRetryPolicy extends ResolvedRetryBackoff {
    readonly mode: 'normal';
    readonly maxRetries: number;
    readonly retryableCodes: readonly string[];
}
/** Fully resolved unbounded retry policy. */
export interface ResolvedAlwaysRetryPolicy extends ResolvedRetryBackoff {
    readonly mode: 'always';
}
/** Immutable provider policy captured when its adapter route is registered. */
export type ResolvedRetryPolicy = ResolvedNormalRetryPolicy | ResolvedAlwaysRetryPolicy;
/** Cordis schema embedded by each concrete provider configuration. */
export declare const RetryPolicySchema: z<RetryPolicyConfig>;
```

Note `always` mode has **no** `maxRetries` and **no** `retryableCodes` in the *type*, yet the *runtime key allow-list* for `always` accepts both (see §2.2).

### 1.2 The runtime validation object, verbatim

`$DSH/dsh-llm/lib/types/retry-policy.js` L12–L51 (byte-identical to `dsh-llm/lib/index.js` L234–L265, modulo `10_000`→`1e4`, `0.1`→`.1`):

```js
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10_000;
const DEFAULT_JITTER_RATIO = 0.1;
const DEFAULT_RETRYABLE_CODES = Object.freeze([
    EMPTY_RESPONSE_CODE,
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
/** Cordis schema embedded by each concrete provider configuration. */
export const RetryPolicySchema = z.union([
    normalPolicySchema,
    alwaysPolicySchema,
]);
const NORMAL_POLICY_KEYS = new Set([
    'mode', 'maxRetries', 'retryableCodes', 'backoff',
]);
// Layered configuration can retain normal-only fields after switching modes;
// always mode ignores those inactive values while still rejecting unknown keys.
const ALWAYS_POLICY_KEYS = new Set([
    'mode', 'maxRetries', 'retryableCodes', 'backoff',
]);
const BACKOFF_KEYS = new Set(['initialDelayMs', 'maxDelayMs', 'jitterRatio']);
```

`z` here is `@deepseek-ai/schemastery` (`dsh-llm/package.json` deps), imported as `import z from '@deepseek-ai/schemastery';`. `EMPTY_RESPONSE_CODE` is the constant from `dsh-llm/lib/types/error.js` (value `"EMPTY_RESPONSE"`). `MAX_TIMER_DELAY_MS = 2147483647` from `@deepseek-ai/dsh-timeout`.

**Where DSH embeds this schema**

- `$DSH/dsh-llm-pi-ai/lib/index.js` L1014, inside the per-provider `profile` schemastery object:
  ```js
  retryPolicy: RetryPolicySchema
  ```
- `$DSH/dsh-llm-deepseek/lib/index.js` L1908, inside the adapter's `Config` schema:
  ```js
  retryPolicy: RetryPolicySchema
  ```

### 1.3 Complete field table

| Field | Type | Legal values | Required? | Default when absent | Enforced by |
|---|---|---|---|---|---|
| `mode` | `'normal' \| 'always'` | exactly those two | **yes**, when `retryPolicy` is present | — (whole object omitted ⇒ normal defaults) | schema `z.const().required()`, resolver `default:` branch |
| `maxRetries` | number | integer `0 … Number.MAX_SAFE_INTEGER` | no (`normal` only) | `5` | schema `z.number().step(1).min(0).max(MAX_SAFE_INTEGER)`; resolver `Number.isSafeInteger && >= 0` |
| `retryableCodes` | string[] | **any non-empty strings, uniquely — open set** | no (`normal` only) | `["EMPTY_RESPONSE","RATE_LIMIT","SERVER","TIMEOUT","TRANSPORT"]` | schema `z.array(z.string())`; resolver rejects `[]`, `""`, duplicates |
| `backoff.initialDelayMs` | number | finite `> 0` and `<= 2147483647` | no | `500` | schema `.max(MAX_TIMER_DELAY_MS)`; resolver rejects `<=0`, `>MAX`, non-finite |
| `backoff.maxDelayMs` | number | finite `> 0`, `<= 2147483647`, `>= initialDelayMs` | no | `10000` | schema `.max(MAX_TIMER_DELAY_MS)`; resolver rejects `<=0`, `>MAX`, `< initialDelayMs` |
| `backoff.jitterRatio` | number | `0 … 1` inclusive | no | `0.1` | schema `.min(0).max(1)`; resolver re-checks |
| `backoff` | object | only the 3 keys above | no | fully defaulted | resolver `validateKeys(config, BACKOFF_KEYS, path)` |

`always` mode **effectively ignores** `maxRetries` and `retryableCodes` (they are in `ALWAYS_POLICY_KEYS`, so they pass the unknown-key check and are then dropped — see §2.2), and `always` mode **produces no `maxRetries`/`retryableCodes`** in the resolved value.

**ABSENT in 0.1.5-rc.2** (no such fields exist anywhere in the schema or resolver): `maxRetryDelayMs`, `retryOnStatuses`, `retryOnNetworkError`, `exponentialBase` / `multiplier` / `backoffFactor`, `jitter` (only `jitterRatio`), `respectRetryAfter` (always-on, not configurable), `timeoutMs` inside `retryPolicy`, per-model retry overrides, `retryPolicy.onExhausted` / fallback hooks. The legacy provider keys `maxRetries` / `maxRetryDelayMs` at the provider level are explicitly **rejected** with a migration error:

`$DSH/dsh-llm-pi-ai/lib/index.js` L1029–L1034:
```js
function rejectRemovedFields(provider, source) {
	const legacy = source;
	if ("provider" in legacy) throw new Error(`llm-pi-ai: provider "${provider}" sets "provider", which moved to the providers dict key`);
	if ("maxRetries" in legacy || "maxRetryDelayMs" in legacy) throw new Error(`llm-pi-ai: provider "${provider}" sets maxRetries or maxRetryDelayMs, which were removed; compose agent recovery with dsh-llm-retry`);
}
```

---

## 2. `mode` — legal values and exact semantics

### 2.1 Legal values

`'normal'` and `'always'`. Nothing else. Both the schema (`z.const('normal')` / `z.const('always')` inside a `z.union`) and the resolver reject anything else:

`$DSH/dsh-llm/lib/types/retry-policy.js` L93–L125:
```js
    switch (config.mode) {
        case 'normal': {
            validateKeys(config, NORMAL_POLICY_KEYS, path);
            ...
        }
        case 'always':
            validateKeys(config, ALWAYS_POLICY_KEYS, path);
            return Object.freeze({
                mode: 'always',
                ...resolveBackoff(config.backoff, `${path}.backoff`),
            });
        default:
            throw new Error(`${path}.mode must be "normal" or "always"`);
    }
```

### 2.2 `always` accepts (and ignores) `maxRetries` / `retryableCodes`

`ALWAYS_POLICY_KEYS` deliberately re-lists the normal-only keys so a layered settings document that switched modes does not fail validation. The comment at `retry-policy.js` L46–L50 states this explicitly. Empirically verified against the installed package:

```text
RetryPolicySchema({mode:'always', retryableCodes:['X'], maxRetries:9, backoff:{...}})
  → OK; normalized to {"mode":"always","backoff":{...},"retryableCodes":["X"],"maxRetries":9}
resolveRetryPolicy(same, 'p')
  → {"mode":"always","initialDelayMs":1,"maxDelayMs":2,"jitterRatio":0.5}   // codes/retries dropped
```

This is why the live `~/.dsh/settings.yaml` can keep `retryableCodes` under a `mode: always` policy (`llm-deepseek`, L5–L12) without error.

### 2.3 Exact semantic difference (the executor branch)

`$DSH/dsh-llm-retry/lib/index.js` L151–L174 — `recover()`:

```js
	async function recover({ agent, turn, step, provider, failure, retryPolicy: policy, signal }, next) {
		if (policy === void 0) return next();
		if (policy.mode === "always") {
			if (signal.aborted || lifetime.signal.aborted) return;
			const fusedSignal = AbortSignal.any([signal, lifetime.signal]);
			const downstream = await settleDownstream(next);
			if (fusedSignal.aborted) return;
			if (downstream.type === "error") ctx.logger.warn(`llm-retry: provider "${provider}" always policy ignored a downstream recovery failure: %o`, downstream.error);
			if (downstream.type === "decision" && downstream.decision?.kind === "retry") return downstream.decision;
		} else if (!policy.retryableCodes.includes(failure.code)) return next();
		const policyKey = retryPolicyKey(policy);
		const previous = ctx.sessionProjections.stateOf(agent.session, "llmRetry")[retryStateKey(provider, policyKey)];
		const previousRetry = previous?.retry ?? 0;
		if (policy.mode === "normal" && previousRetry >= policy.maxRetries) return next();
		const retry = previousRetry + 1;
		const retryId = previous?.retryId ?? RetryId(randomUUID());
		let delayMs;
		if (failure.providerRetryAfterMs !== void 0 && Number.isFinite(failure.providerRetryAfterMs) && failure.providerRetryAfterMs > 0) if (failure.providerRetryAfterMs > policy.maxDelayMs) {
			if (policy.mode === "normal") return next();
			delayMs = localDelay(policy, retry, random);
		} else delayMs = failure.providerRetryAfterMs;
		else delayMs = localDelay(policy, retry, random);
		return backoff(agent, turn, step, failure, provider, policy, policyKey, retry, retryId, delayMs, signal);
	}
```

Concretely:

| | `normal` | `always` |
|---|---|---|
| eligibility | `policy.retryableCodes.includes(failure.code)` | **every** failure |
| budget | `previousRetry >= policy.maxRetries` ⇒ give up | none (unbounded) |
| downstream waterfall | not consulted | **consulted first** (`next()`); a downstream `{kind:'retry'}` wins and is returned as-is |
| provider `Retry-After` above `maxDelayMs` | abandons retry (`return next()`) | falls back to local backoff |
| terminates on | success, budget exhausted, ineligible code, cancellation, disposal | success, cancellation, disposal |

Downstream-first in `always` mode is important: `dsh-compaction-basic` also listens on `agent/request-error` (see §8) and would otherwise be pre-empted.

---

## 3. `retryableCodes` — open list, custom codes allowed

### 3.1 The validation (decisive quote)

Schema, `$DSH/dsh-llm/lib/types/retry-policy.js` L31:
```js
    retryableCodes: z.array(z.string()).default([...DEFAULT_RETRYABLE_CODES]),
```

Resolver, same file L101–L109:
```js
            if (retryableCodes.length === 0) {
                throw new Error(`${path}.retryableCodes must not be empty`);
            }
            if (retryableCodes.some(code => typeof code !== 'string' || code.length === 0)) {
                throw new Error(`${path}.retryableCodes must contain only non-empty strings`);
            }
            if (new Set(retryableCodes).size !== retryableCodes.length) {
                throw new Error(`${path}.retryableCodes must not contain duplicates`);
            }
```

**Verdict: the enum is OPEN. Arbitrary custom strings are accepted.** Empirically verified against the installed build:

```text
RetryPolicySchema({mode:'normal', retryableCodes:['GATEWAY_TEMPORARY','QUOTA']}) → OK
resolveRetryPolicy(...) → {"mode":"normal","maxRetries":5,
  "retryableCodes":["GATEWAY_TEMPORARY","QUOTA"],
  "initialDelayMs":500,"maxDelayMs":10000,"jitterRatio":0.1}
```

Rules for the list: non-empty array, every element a non-empty `string`, no duplicates. `[]` is **rejected** — to express "retry nothing" in normal mode use `maxRetries: 0` instead.

A custom code only ever fires if some adapter actually emits that exact `failure.code`; the retry layer does no interpretation of it beyond string equality (the plugin README: "插件不自己解释 Custom Code").

### 3.2 The 5 built-in defaults, and every code an adapter can actually emit

`DEFAULT_RETRYABLE_CODES` (`retry-policy.js` L16–L22), all matched by string equality:

```text
EMPTY_RESPONSE
RATE_LIMIT
SERVER
TIMEOUT
TRANSPORT
```

For completeness, the complete set of codes the shipped adapters can place in `failure.code` (`LlmFailure.code`, `dsh-llm/lib/types/types.d.ts` L26–L37 — an *open* `string`, not an enum):

`dsh-llm-pi-ai/lib/index.js` L1367–L1376 (`classifyPiAiError`) plus `mapStopReason` L1388–L1445:

| Code | Retried by default? | Source |
|---|---|---|
| `EMPTY_RESPONSE` | **yes** | `mapStopReason`, `stop` with zero content blocks (L1404) |
| `RATE_LIMIT` | **yes** | `/\b429\b\|rate.?limit/i` (L1369) |
| `SERVER` | **yes** | `/\b5\d\d\b/` (L1372) |
| `TIMEOUT` | **yes** | timeout wording (L1373); also idle-timeout throw at L1896 (`"TIMEOUT"`) |
| `TRANSPORT` | **yes** | `stream ended (before\|without)`, network/connection/socket/fetch, ECONN\*, HTTP2 no-response, WebSocket closed, premature close (L1374–L1375) |
| `AUTH` | no | `/\b(?:401\|403)\b/` (L1367) |
| `QUOTA` (`QUOTA_EXCEEDED_CODE`) | no | `isQuotaExceededError` (L1368) |
| `INVALID_REQUEST` | no | 400/413/payload-too-large (L1370–L1371) |
| `CONTEXT_WINDOW_EXCEEDED` | no | overflow detector (L1395) — handled separately by `dsh-compaction-basic` |
| `PI_AI_ERROR` | no | fallback, and terminal `pending`/`deferred` (L1414, L1421) |
| `ABORTED` | no (finish kind `aborted`, never enters retry) | L1428 |

`dsh-llm-deepseek/lib/index.js` L1527–L1540 additionally maps `401/403 → AUTH`, `429 → RATE_LIMIT`, `>=500 → SERVER`, `413 → INVALID_REQUEST`, `QUOTA_EXCEEDED_CODE`, `CONTEXT_WINDOW_EXCEEDED_CODE`, `EMPTY_RESPONSE_CODE` (L1243), and `TIMEOUT` for stream idle timeout (L1642).

So: a plugin UI could legitimately offer `AUTH`, `QUOTA`, `INVALID_REQUEST`, `CONTEXT_WINDOW_EXCEEDED`, `PI_AI_ERROR`, `ABORTED` as *custom* codes, but retrying `AUTH`/`INVALID_REQUEST`/`PI_AI_ERROR` with a bounded budget normally just burns the budget. (`always` mode already retries all of them unconditionally.)

---

## 4. `backoff` — types, defaults, constraints, failure mode

### 4.1 Constraint checks

Schema (`retry-policy.js` L23–L27):
```js
const backoffSchema = z.object({
    initialDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
    maxDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
    jitterRatio: z.number().min(0).max(1).default(DEFAULT_JITTER_RATIO),
});
```

Resolver (`retry-policy.js` L58–L77) — the authoritative cross-field checks:
```js
function resolveBackoff(config, path) {
    if (config !== undefined)
        validateKeys(config, BACKOFF_KEYS, path);
    const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
    const maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    const jitterRatio = config?.jitterRatio ?? DEFAULT_JITTER_RATIO;
    if (!Number.isFinite(initialDelayMs) || initialDelayMs <= 0 || initialDelayMs > MAX_TIMER_DELAY_MS) {
        throw new Error(`${path}.initialDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
    }
    if (!Number.isFinite(maxDelayMs) || maxDelayMs <= 0 || maxDelayMs > MAX_TIMER_DELAY_MS) {
        throw new Error(`${path}.maxDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
    }
    if (initialDelayMs > maxDelayMs) {
        throw new Error(`${path}.initialDelayMs must be less than or equal to maxDelayMs`);
    }
    if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) {
        throw new Error(`${path}.jitterRatio must be between 0 and 1`);
    }
    return Object.freeze({ initialDelayMs, maxDelayMs, jitterRatio });
}
```

| Check | Where | Behaviour |
|---|---|---|
| `initialDelayMs` finite, `> 0`, `<= 2147483647` | resolver | **throw** |
| `maxDelayMs` finite, `> 0`, `<= 2147483647` | resolver | **throw** |
| `initialDelayMs <= maxDelayMs` | resolver only (not in schema) | **throw** |
| `jitterRatio` finite, in `[0,1]` | schema **and** resolver | **throw** |
| no unknown keys under `backoff` | resolver `validateKeys` | **throw** `path: unknown key "x"` |

### 4.2 What happens on invalid values — throw, never clamp/ignore

Every failure is an exception, raised at the earliest of two moments:

1. **Settings write / load** — schemastery validates the `llm-pi-ai` `Config` section (which embeds `RetryPolicySchema`) before the value is admitted, then the `validate` hook runs resolution. `$DSH/dsh-llm-pi-ai/lib/index.js` L2661–L2665:
   ```js
   		settingsCtx.settings.installSection(ctx, NS, Config, config, {
   			validate: (value) => {
   				if (registering) resolveProfiles(value.providers, "deferred");
   				else assertServiceable(value, current());
   			},
   ```
   A refused update keeps the previously registered routes (`onChange` catch, L2669–L2682 logs and keeps prior state).
2. **Provider-profile resolution** — `$DSH/dsh-llm-pi-ai/lib/index.js` L1110:
   ```js
   			retryPolicy: resolveRetryPolicy(retryPolicy, `llm-pi-ai: provider "${provider}" retryPolicy`),
   ```
   (for `dsh-llm-deepseek`, L2014: `retryPolicy: resolveRetryPolicy(config.retryPolicy, "llm-deepseek: retryPolicy")`).

Error paths are human-readable and provider-scoped, e.g. `llm-pi-ai: provider "router" retryPolicy.backoff.initialDelayMs must be less than or equal to maxDelayMs`.

Empirical matrix (executed against the installed build, `path='p'`):

```text
{}                                    schema SCHEMA-FAIL   resolve p.mode must be "normal" or "always"
{maxRetries:3}                        schema SCHEMA-FAIL   resolve p.mode must be "normal" or "always"
{mode:'sometimes'}                    schema SCHEMA-FAIL   resolve p.mode must be "normal" or "always"
{mode:'normal',retryableCodes:[]}     schema OK            resolve p.retryableCodes must not be empty
{mode:'normal',retryableCodes:['']}   schema OK            resolve ...only non-empty strings
{mode:'normal',retryableCodes:['A','A']} schema OK         resolve ...must not contain duplicates
{mode:'normal',retryableCodes:[1]}    schema SCHEMA-FAIL   resolve ...only non-empty strings
{mode:'normal',maxRetries:-1}         schema SCHEMA-FAIL   resolve ...non-negative safe integer
{mode:'normal',maxRetries:2.5}        schema SCHEMA-FAIL   resolve ...non-negative safe integer
{mode:'normal',maxRetries:0}          schema OK            resolve OK
{mode:'normal',backoff:{initialDelayMs:0}} schema OK       resolve ...must be a positive finite number...
{mode:'normal',backoff:{maxDelayMs:0}}     schema OK       resolve ...must be a positive finite number...
{mode:'normal',backoff:{jitterRatio:1.5}}  schema SCHEMA-FAIL  resolve ...must be between 0 and 1
{mode:'normal',backoff:{jitterRatio:-0.5}} schema SCHEMA-FAIL  resolve ...must be between 0 and 1
{mode:'normal',backoff:{initialDelayMs:11,maxDelayMs:10}} schema OK  resolve ...less than or equal to maxDelayMs
{mode:'normal',foo:1}                 schema OK            resolve p: unknown key "foo"
```

Two design consequences worth carrying into the plugin UI:

- The schema is **looser than the resolver** (`initialDelayMs: 0`, `retryableCodes: []`, duplicates, and unknown keys all pass schemastery). The plugin must mirror the **resolver** rules, not just the schema, or a save will fail later during `resolveProfiles`.
- The schema does **not** strip unknown keys (`{mode:'normal', foo:1}` normalizes with `foo` retained), so unknown-field preservation (§45 of the project brief) is not automatically guaranteed by the harness; the plugin's own minimal-patch writer must preserve them.

### 4.3 The delay algorithm actually used

`$DSH/dsh-llm-retry/lib/index.js` L44–L49:
```js
function localDelay(config, retry, random) {
	const exponent = Math.min(retry - 1, 1024);
	const exponential = Math.min(config.initialDelayMs * 2 ** exponent, config.maxDelayMs);
	const jitter = 1 - config.jitterRatio + 2 * config.jitterRatio * random();
	return Math.min(exponential * jitter, config.maxDelayMs);
}
```

Bounded exponential backoff, symmetric jitter as a multiplier in `[1-r, 1+r]`, final result re-clamped to `maxDelayMs`. A valid, in-bounds provider `Retry-After` (`failure.providerRetryAfterMs`) replaces it entirely (`recover()`, L168–L172).

---

## 5. Where DSH reads `retryPolicy` from settings — the full wiring

**It is per provider route; never per model, and not global.**

### 5.1 Settings layer (host-owned schema, not the plugin's namespace)

`$DSH/dsh-llm-pi-ai/lib/types/config.d.ts` L137–L143:
```ts
    /**
     * Raw encoded-byte target for each deterministic inline request version;
     * the smallest quality-ladder output is used when no quality fits.
     */
    requestImageMaxBytes?: number;
    /** Provider-owned model-request retry policy; omission uses normal mode with five retries. */
    retryPolicy?: RetryPolicyConfig;
}
```

The namespace is `NS = "llm-pi-ai"` (`$DSH/dsh-llm-pi-ai/lib/index.js` L2533) and the path is `["providers", provider]` (L2562), i.e. the settings document address is exactly `llm-pi-ai.providers.<id>.retryPolicy`.

### 5.2 Settings → resolved profile

`$DSH/dsh-llm-pi-ai/lib/index.js` L1051–L1120 (`resolveProfiles`), key line L1100 & L1110:
```js
		const { apiKeyEnv, retryPolicy, models: _models, displayName: _displayName, ...rest } = source;
		resolved.set(provider, {
			...rest,
			provider,
			displayName,
			...
			retryPolicy: resolveRetryPolicy(retryPolicy, `llm-pi-ai: provider "${provider}" retryPolicy`),
```

The resolved value is `ResolvedPiAiProviderProfile.retryPolicy: ResolvedRetryPolicy` (`config.d.ts` L146–L162), captured **per route**.

`profiles()` (L2585–L2592) memoizes by raw-config identity; the settings `setSource` callback swaps `current`, so a settings write re-resolves the profiles.

### 5.3 Profile → adapter route registration (this is where the engine picks it up)

`$DSH/dsh-llm-pi-ai/lib/index.js` L2539–L2545 and L2645–L2657:
```js
function registrationFacts(profiles) {
	return [...profiles.entries()].map(([provider, profile]) => ({
		provider,
		displayName: profile.displayName,
		retryPolicy: profile.retryPolicy
	})).sort((left, right) => left.provider.localeCompare(right.provider));
}
...
	const ensureRegistrationFacts = () => {
		const facts = registrationFacts(profiles());
		if (deepEqualJson(facts, registeredFacts)) return;
		const routes = [...profiles().keys()];
		if (registration === void 0) {
			if (routes.length === 0) { registeredFacts = facts; return; }
			registration = ctx.llm.registerAdapter(routes, adapter);
		} else registration.replace(routes);
		registeredFacts = facts;
	};
```

`retryPolicy` is part of `registrationFacts`, so **changing it hot-reloads the route registration** (no restart). The adapter exposes it:

`$DSH/dsh-llm-pi-ai/lib/index.js` L1781–L1783:
```js
	providerRetryPolicy(provider) {
		return this.current().profiles.get(provider)?.retryPolicy;
	}
```

### 5.4 Adapter → llm service registry (policy captured per route)

`$DSH/dsh-llm/lib/index.js` L1814 & L1817–L1823:
```js
				const retryPolicy = adapter.providerRetryPolicy(provider) ?? resolveRetryPolicy(void 0, `llm: provider "${provider}" retryPolicy`);
				registrations.push({
					adapter,
					provider: { id: info.id, name: info.name },
					retryPolicy
				});
```

So an adapter that declares no policy (or omits the route) still gets the normal-mode defaults materialized at registration time.

### 5.5 Registry → prepared call

`$DSH/dsh-llm/lib/index.js` L2159 (`prepareCall`):
```js
			return Object.freeze({
				config: resolvedConfig,
				retryPolicy: registration.retryPolicy,
```

`PreparedLlmCall.retryPolicy` is documented at `$DSH/dsh-llm/lib/types/index.d.ts` L91–L95 as "Immutable retry policy captured with the adapter registration."

### 5.6 Prepared call → agent loop waterfall

`$DSH/dsh-agent-loop/lib/index.js` L1088–L1094:
```js
					const action = await this.dispatch.waterfall("agent/request-error", {
						turn,
						step,
						provider: request.provider,
						failure: finish.failure,
						retryPolicy: preparedCall?.retryPolicy,
						signal
					}, () => Promise.resolve(void 0));
					signal.throwIfAborted();
					if (action?.kind !== "retry") throw new LlmError(finish.failure.message, finish.failure.code, finish.failure);
					continue;
```

`agent/request-error` payload contract, `$DSH/dsh-agent/lib/types/runtime-types.d.ts` L343–L359:
```ts
         * @param payload.provider - the provider selected for the failed request.
         * @param payload.failure - serializable facts normalized at the final adapter boundary.
         * @param payload.retryPolicy - the policy of the adapter registration that served the failed request.
         * @param payload.signal - the turn abort signal.
         * @mode waterfall
         */
        'agent/request-error'(this: Scoped<Agent>, payload: {
            agent: Agent;
            turn: number;
            step: number;
            provider: string;
            failure: LlmFailure;
            retryPolicy: ResolvedRetryPolicy | undefined;
            signal: AbortSignal;
        }, next: () => Promise<RequestErrorAction>): Promise<RequestErrorAction>;
```

`RequestErrorAction` is `{ kind: 'retry' } | undefined` (`runtime-types.d.ts` L100–L103, declaration at L101).

### 5.7 Executor consumes it

`$DSH/dsh-llm-retry/lib/index.js` L175–L178:
```js
	const disposeListener = ctx.on("agent/request-error", (payload, next) => {
		if (lifetime.signal.aborted) return Promise.resolve(void 0);
		return track(recover(payload, next));
	});
```

**Summary of the chain:**

```text
~/.dsh/settings.yaml
  llm-pi-ai.providers.<route>.retryPolicy        (user settings layer)
      │  schemastery RetryPolicySchema  +  resolveRetryPolicy()
      ▼
PiAiAdapter.providerRetryPolicy(route)  ─┐
                                         ├─► ctx.llm.registerAdapter(routes, adapter)
DeepSeekAdapter.providerRetryPolicy()   ─┘        │  registry.adapters[route].retryPolicy
                                                  ▼
                              LlmRuntime.prepareCall() → PreparedLlmCall.retryPolicy
                                                  ▼
                       agent-loop dispatch.waterfall("agent/request-error", {retryPolicy,…})
                                                  ▼
                       @deepseek-ai/dsh-llm-retry listener → backoff() → {kind:'retry'}
                                                  ▼
                       loop `continue` → failed step re-runs in the same open turn
```

**Granularity: per provider route.** `llm-pi-ai.providers.<id>.retryPolicy` covers every model under `<id>` (`models[]` has no retry field — `config.d.ts` L969–L980 defines only `id/name/contextWindow/maxTokens/input/reasoningEfforts/compat`). `llm-deepseek.retryPolicy` covers its single hard-coded route `PROVIDER = "deepseek-official"` (`dsh-llm-deepseek/lib/index.js` L1837–L1840). There is no global `llm` retry setting (§8).

The live settings file confirms the per-route shape (`~/.dsh/settings.yaml` L34–L39 and L55–L60 both hold the identical `mode: always` policy, one per route).

### 5.8 Changing the policy mid-session

The budget counter is keyed by `retryPolicyKey(policy)`, which encodes mode + budget + sorted codes + backoff (`dsh-llm-retry/lib/index.js` L50–L64). A policy edit therefore starts a **fresh** retry budget rather than inheriting the old counter, and in-flight prepared calls keep the policy captured at their own registration.

---

## 6. Actual default values in effect — CONFIRMED

Source of truth: `$DSH/dsh-llm/lib/types/retry-policy.js` L12–L15 and the omission branch L84–L92:
```js
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10_000;
const DEFAULT_JITTER_RATIO = 0.1;
...
export function resolveRetryPolicy(config, path) {
    if (config === undefined) {
        return Object.freeze({
            mode: 'normal',
            maxRetries: DEFAULT_MAX_RETRIES,
            retryableCodes: DEFAULT_RETRYABLE_CODES,
            ...resolveBackoff(undefined, `${path}.backoff`),
        });
    }
```

Executed against the installed build:

```text
resolveRetryPolicy(undefined, 'p')
→ {"mode":"normal","maxRetries":5,
   "retryableCodes":["EMPTY_RESPONSE","RATE_LIMIT","SERVER","TIMEOUT","TRANSPORT"],
   "initialDelayMs":500,"maxDelayMs":10000,"jitterRatio":0.1}
```

**The hypothesis is CONFIRMED in full:**

| Proposed default | Actual | Status |
|---|---|---|
| `maxRetries = 5` | `5` | ✅ confirmed |
| `initialDelayMs = 500` | `500` | ✅ confirmed |
| `maxDelayMs = 10000` | `10000` | ✅ confirmed |
| `jitterRatio = 0.1` | `0.1` | ✅ confirmed |

Plus, not in the hypothesis: **`mode` defaults to `normal`**, and `retryableCodes` defaults to the frozen 5-code list. Note the frozen module-level `DEFAULT_RETRYABLE_CODES` array is shared by reference when the whole policy is omitted, whereas a `mode: 'normal'` object with no `retryableCodes` gets a fresh copy (`[...DEFAULT_RETRYABLE_CODES]`, L97) — the returned policy is always `Object.freeze`d either way.

---

## 7. Events, cancellation, session-lifecycle interaction

### 7.1 Durable events

Two new `SessionEventMap` members, declared in `$DSH/dsh-llm-retry/lib/types/types.d.ts` L4–L11:
```ts
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        /** Durable, non-surface record of one provider-routed retry scheduled after a failed request attempt. */
        'llm/retry': LlmRetryEventData;
        /** Durable transition written after a retry wait succeeds and before the next request attempt starts. */
        'llm/retry-started': LlmRetryStartedEventData;
    }
}
```

Payloads (L13–L41) — note `normal` carries `maxRetries`, `always` does not:
```ts
export type LlmRetryEventData = {
    retryId: RetryId; turn: number; step: number; provider: string;
    mode: 'normal'; policyKey: string; retry: number; maxRetries: number;
    delayMs: number; failure: LlmFailure;
} | {
    retryId: RetryId; turn: number; step: number; provider: string;
    mode: 'always'; policyKey: string; retry: number;
    delayMs: number; failure: LlmFailure;
};
/** Durable transition recorded after one retry delay completes. */
export interface LlmRetryStartedEventData {
    retryId: RetryId; turn: number; step: number; retry: number;
}
```

Both are **non-surface** ("durable before wait"): `llm/retry` is appended *before* the timer, `llm/retry-started` only after the wait succeeds (`dsh-llm-retry/lib/index.js` L116–L150):
```js
		agent.session.append("llm/retry", eventData);
		if (!await cancellableDelay(delayMs, fusedSignal)) return;
		agent.session.append("llm/retry-started", { retryId, turn, step, retry });
		return { kind: "retry" };
```

The model never sees any of this (`README.md` "Model Experience": no retry event, delay, provider error, or failed partial output is model-visible). The web trajectory UI does render it: `$DSH/dsh-client-ui-trajectory/lib/client.js` L832 & L849–L860 folds `llm/retry` into the assistant-step card (failure message/code, `retry`, and `maxRetries` for normal mode).

### 7.2 Session projection (budget state)

`$DSH/dsh-llm-retry/lib/index.js` L82–L107 registers the `llmRetry` projection with `stateVersion: 1` and a zod record `{[provider+policyKey]: {retry, retryId}}`. Crucially:
```js
		apply: (state, event) => {
			if (event.type === "step/start" || event.type === "turn/end") return {};
			if (event.type !== "llm/retry") return state;
```
The retry budget **resets at every new step and at turn end**; within one step the `retry` counter and `retryId` persist across attempts. Because a retry re-runs the *same* step, the budget is effectively "maxRetries per failed step".

### 7.3 Cancellation

- Input signal: the turn abort signal carried on the waterfall payload.
- Plugin lifetime: `const lifetime = new AbortController()` (L109), fused via `AbortSignal.any([signal, lifetime.signal])` (L117, L155).
- The wait is cancellable and resolves `false` on abort: `cancellableDelay` (L68–L81) `clearTimeout`s and resolves `false`; `backoff()` then returns without appending `llm/retry-started` or returning `{kind:'retry'}`.
- Pre-aborted signal short-circuits (`if (fusedSignal.aborted) return;` L118; `if (signal.aborted || lifetime.signal.aborted) return;` L154).
- Every in-flight recovery promise is tracked (`track`, L111–L115) and disposal drains them:
```js
	ctx.effect(() => async () => {
		disposeListener();
		lifetime.abort(new Error("llm-retry plugin disposed"));
		await Promise.allSettled([...active]);
	}, "llm-retry: abort and drain active recovery");
```
- Listener fails closed once disposed: `if (lifetime.signal.aborted) return Promise.resolve(void 0);` (L176).

### 7.4 `always`-mode composition hazard (documented limitation)

Because `always` runs downstream recovery first and **returns without calling `next()`**, a downstream listener that ignores cancellation and never settles blocks fallback, turn quiescence, and plugin disposal. Stated in `$DSH/dsh-llm-retry/README.md` ("Waterfall composition") and in "Known Limitations".

### 7.5 Scope / direct calls

Recovery runs only on the agent-loop extension point. Direct `ctx.llm.stream()` callers are **single-attempt** — a raw stream cannot separate already-emitted chunks durably (`README.md`, "Use this package"). The plugin is agent-scoped via `dsh-scope` (`$DSH/dsh-scope/lib/invariant.js` L19 binds `agent/request-error` to `args[0]["agent"]`).

---

## 8. Every other place retry/timeout behaviour is configured (do NOT duplicate)

| # | Location | Setting | What it does | Relation to `retryPolicy` |
|---|---|---|---|---|
| 1 | `@deepseek-ai/dsh-llm-retry` plugin config | **none** | `const Config = z.object({})` (`dsh-llm-retry/lib/index.js` L24); `validateConfig` explicitly rejects a `retryPolicy` key: `throw new Error("llm-retry: retryPolicy belongs under each provider configuration")` (L28) | The executor has no config of its own — policy lives on adapters |
| 2 | `llm-pi-ai.providers.<id>.retryPolicy` | `RetryPolicyConfig` | the subject of this report | canonical, per route |
| 3 | `llm-deepseek.retryPolicy` | `RetryPolicyConfig` | route-level policy for `deepseek-official` (`dsh-llm-deepseek/lib/index.js` L1908, L2014, L2072–L2078) | same type, one provider |
| 4 | **Global `llm` namespace** | — | **ABSENT in 0.1.5-rc.2.** `dsh-llm` declares no `installSection`, no `NS`, no settings schema of its own (grep for `installSection` in `dsh-llm/lib/index.js` returns nothing; only `settingsNs` *arguments* for provider directories/discovery) | There is no global retry setting to read or write |
| 5 | `agent-loop` | `maxParallelToolCalls` (`~/.dsh/settings.yaml` L61–L62) | concurrency only | unrelated |
| 6 | `dsh-compaction-basic` | `maxOverflowRetries` (default `1`), `compactionRetries` (default `1`), `auto` | **A second, independent `agent/request-error` listener** — for `CONTEXT_WINDOW_EXCEEDED` it compacts and returns `{kind:'retry'}` up to `maxOverflowRetries` (`dsh-compaction-basic/lib/index.js` L820–L840; defaults L74; schema L739–L750; `types.d.ts` L24) | Overlaps the same waterfall; `always` mode deliberately defers to it. **Do not model context-overflow retry inside a retryPolicy UI** |
| 7 | `dsh-tools` `defineTool({ timeoutMs })` | per-tool cooperative budget | enforced by `@deepseek-ai/dsh-tool-call-timeout-policy` on `tools/execute`; `timeoutMs` is never model-visible (`dsh-tools/lib/types/index.d.ts` L134–L139) | tool-level, not model-request |
| 8 | `dsh-bash-local` | `timeoutMs` (default foreground timeout), `maxTimeoutMs` (cap for per-call overrides), `graceMs` (`dsh-bash-local/lib/types/index.d.ts` L30–L40) | shell/subprocess deadline | tool-level |
| 9 | Provider `timeoutMs` / `streamIdleTimeoutMs` / `websocketConnectTimeoutMs` | `PiAiProviderProfile` fields (`config.d.ts` L122–L127) | transport deadlines, idle watchdog; a fired idle watchdog becomes a `TIMEOUT` failure that `retryPolicy` may then retry | orthogonal — a *cause* of retryable failures, not a retry knob |
| 10 | `@deepseek-ai/dsh-timeout` | **library only** | exports `TimeoutReason`, `MAX_TIMER_DELAY_MS = 2147483647`, `clampTimeout()`, `deadline()`, `idleWatchdog()`, `timeoutOf()` (`dsh-timeout/lib/types/index.d.ts` L11–L92). **No retry function.** The retry executor imports only `MAX_TIMER_DELAY_MS` and implements its own `cancellableDelay` via `setTimeout` | not a retry configuration surface |
| 11 | `agent/request-error` waterfall itself | — | the official extension point any plugin may listen on; `llm-retry` is one listener, `compaction-basic` another | the correct place to *observe* retries, not to re-implement |

Also relevant: there is no `dsh-llm-retry` row configuration in the shipped profiles — it is mounted config-free by `dsh-base` (`$DSH/dsh-base/cordis.patch.yml` L84–L85):
```yaml
    - id: llm-retry
      name: '@deepseek-ai/dsh-llm-retry'
```

---

## 9. How a plugin reads the EFFECTIVE retry policy at runtime

There **is** a service method. Use `ctx.llm.providerRetryPolicy(provider)`.

`$DSH/dsh-llm/lib/types/index.d.ts` L313–L318 (public `LlmRuntime` service):
```ts
    /**
     * Resolve the retry policy captured when one provider route was registered.
     * @param provider - registered provider route to inspect.
     * @returns the provider-owned policy, with normal defaults already resolved.
     */
    providerRetryPolicy(provider: string): ResolvedRetryPolicy;
```

Implementation, `$DSH/dsh-llm/lib/index.js` L1984–L1986:
```js
		providerRetryPolicy(provider) {
			return this.registration(provider).retryPolicy;
		}
```

Properties:

- Returns a **fully resolved, frozen** `ResolvedRetryPolicy` — defaults already materialized, so it is exactly the value the engine uses. This is the right source for a plugin's "effective configuration" preview.
- **Synchronous**, and **host-side only**: it carries no `@Remote` decorator (the only `@Remote` in the runtime is `remoteDiscoverModels`, `dsh-llm/lib/index.js` L1703; `dsh-llm/lib/typert.host.js` L164–L166 lists it as a plain method), so a browser/client plugin cannot call it across the Remote boundary — a client UI must get the value from a host-side companion or from settings.
- **Throws** for an unregistered provider: `registration(provider)` raises `LlmError("no adapter registered for provider \"...\"", "NO_ADAPTER")` (`dsh-llm/lib/index.js` L2177–L2180, `registration()` at L2177, throw at L2179), whereas `imageRequestPricing` deliberately degrades to `undefined`. Guard with `ctx.llm.listProviders()` / `listConfigurableProviders()` when the route may not be mounted.
- **Route granularity only.** There is no `providerRetryPolicy(provider, model)`; the policy is shared by all models on the route, so per-model display is out of scope.
- Lifecycle: the value is captured at `registerAdapter` time and refreshed automatically when the adapter's `registration.replace(...)` runs (pi-ai does this whenever `retryPolicy` changes — §5.3), so re-reading after a settings change yields the new policy without a restart.
- On the **adapter** side, `LlmAdapter.providerRetryPolicy(_provider)` (`dsh-llm/lib/types/index.d.ts` L138) is the overridable seam: `PiAiAdapter` returns the per-profile value (possibly `undefined`), `DeepSeekAdapter` returns `this.config.options().retryPolicy`.

Reading the settings document directly is therefore **not** necessary and is strictly worse: it would bypass schema defaults, the resolver's cross-field validation, mode layering (`always` ignoring `maxRetries`/`retryableCodes`), and hot-reload. If a plugin must show the raw configured (pre-default) value, read the `llm-pi-ai` settings section (`ctx.settings`, namespace `llm-pi-ai`, path `["providers", route]`) and pair it with `ctx.llm.providerRetryPolicy(route)` for the effective view.

---

## 10. Notes / gaps

- The schemastery `Config` used by `installSection` was **not** exercised end-to-end (no settings service was mounted in this recon); the schema-level probes in §1/§4 were run directly against the exported `RetryPolicySchema`. The steps after the schema (settings layer → `resolveProfiles`) are read from source and are unambiguous.
- The live `~/.dsh/settings.yaml` currently configures `mode: always` with `initialDelayMs: 2000`, `maxDelayMs: 300000`, `jitterRatio: 0.2` on both `llm-deepseek` (L5–L16) and each `llm-pi-ai` route (L34–L39, L55–L60). Note the `llm-deepseek` entry also carries a (ignored) `retryableCodes` list — valid because `ALWAYS_POLICY_KEYS` permits it (§2.2).
- A plugin UI that offers "Reset to Harness Default" should **delete** the `retryPolicy` key rather than writing the five default values, so a future DSH default change is inherited. The harness gives no "absent vs explicit-default" marker, so only the plugin's own minimal-patch writer can preserve that distinction.
- There is no user-facing validation of retry `mode` values beyond `normal`/`always`; no `aggressive`/`conservative` presets exist in DSH (those are a plugin-side concept in the project brief).
