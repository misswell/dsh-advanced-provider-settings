/**
 * Retry-policy model: the shape DSH stores, the presets the UI offers, and the
 * validation the Harness resolver actually enforces.
 *
 * This plugin CONFIGURES retry; it never implements it. The engine lives in
 * `dsh-llm-retry`, so abort, cancellation, session lifecycle and retry events
 * keep following native behaviour (spec section 68).
 *
 * Two validation layers exist in Harness and they disagree:
 *   - the schemastery schema (`RetryPolicySchema`) is the looser one;
 *   - `resolveRetryPolicy()` is the stricter one and is what throws at profile
 *     resolution time.
 * `validateRetryPolicy` below mirrors the RESOLVER, not the schema, because a
 * UI that only satisfied the schema would happily let the user save a config
 * that fails on the next request. Both layers are cited in `capabilities.ts`.
 */
import { THINKING_LEVELS } from './capabilities.js';
/**
 * Largest timer delay Harness accepts, from `dsh-timeout`'s MAX_TIMER_DELAY_MS.
 * The resolver rejects anything above it for both backoff bounds.
 */
export declare const MAX_TIMER_DELAY_MS = 2147483647;
/**
 * Failure codes retried when a policy omits `retryableCodes`.
 * Source: `DEFAULT_RETRYABLE_CODES` in dsh-llm.
 */
export declare const DEFAULT_RETRYABLE_CODES: readonly ["EMPTY_RESPONSE", "RATE_LIMIT", "SERVER", "TIMEOUT", "TRANSPORT"];
/**
 * The codes the UI offers as checkboxes. The list is deliberately NOT an enum:
 * Harness accepts `z.array(z.string())` and the resolver only rejects empty
 * arrays, empty strings and duplicates, so custom codes are first-class
 * (spec section 23).
 */
export declare const WELL_KNOWN_RETRYABLE_CODES: readonly ["EMPTY_RESPONSE", "RATE_LIMIT", "SERVER", "TIMEOUT", "TRANSPORT"];
/** Harness defaults in force when `retryPolicy` is absent, for display only. */
export declare const RETRY_DEFAULTS: {
    readonly mode: "normal";
    readonly maxRetries: 5;
    readonly retryableCodes: readonly ["EMPTY_RESPONSE", "RATE_LIMIT", "SERVER", "TIMEOUT", "TRANSPORT"];
    readonly initialDelayMs: 500;
    readonly maxDelayMs: 10000;
    readonly jitterRatio: 0.1;
};
/** Exponential-backoff settings. All fields optional: omission inherits. */
export interface RetryBackoff {
    initialDelayMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
}
/** Policy retrying a bounded number of in-policy failures. */
export interface NormalRetryPolicy {
    mode: 'normal';
    maxRetries?: number;
    /** Custom codes are permitted; Harness does not interpret unknown values. */
    retryableCodes?: string[];
    backoff?: RetryBackoff;
}
/**
 * Policy retrying every failure without a budget, until success, cancellation
 * or shutdown. Powers the strongest warning in the UI (spec section 22).
 */
export interface AlwaysRetryPolicy {
    mode: 'always';
    backoff?: RetryBackoff;
}
/** A provider's `retryPolicy` value. */
export type RetryPolicy = NormalRetryPolicy | AlwaysRetryPolicy;
/** Stable pre-harness configurations the UI can apply in one click. */
export type RetryPresetId = 'harness-default' | 'conservative' | 'aggressive' | 'custom';
/** One preset's contents, or the instruction to delete the key. */
export interface RetryPreset {
    id: RetryPresetId;
    /** `null` means "delete `retryPolicy` and inherit Harness defaults". */
    policy: RetryPolicy | null;
}
/**
 * Plugin-authored presets.
 *
 * Only `harness-default` reflects an official default. The other two are this
 * plugin's suggestions and the UI labels them as such (spec section 25).
 */
export declare const RETRY_PRESETS: readonly RetryPreset[];
/** Machine-readable validation failure, resolved to copy by the caller. */
export type RetryIssueCode = 'mode-required' | 'mode-invalid' | 'max-retries-not-integer' | 'max-retries-negative' | 'codes-empty' | 'codes-not-string' | 'codes-duplicate' | 'backoff-initial-invalid' | 'backoff-max-invalid' | 'backoff-initial-exceeds-max' | 'jitter-out-of-range' | 'jitter-not-finite';
/** One validation failure with the field it belongs to. */
export interface RetryIssue {
    /** Dotted path inside the policy, e.g. `backoff.initialDelayMs`. */
    field: string;
    code: RetryIssueCode;
}
/**
 * Validate a retry policy exactly as `resolveRetryPolicy` would.
 *
 * Note the two places the resolver is STRICTER than the schemastery schema,
 * both of which surprise users and are therefore enforced here:
 *   - `initialDelayMs` / `maxDelayMs` must be strictly positive (`0` passes
 *     the schema, then throws at resolution);
 *   - `retryableCodes` must be non-empty and duplicate-free.
 *
 * @param policy - the candidate policy.
 * @returns every problem found, empty when Harness would accept it.
 */
export declare function validateRetryPolicy(policy: unknown): RetryIssue[];
/**
 * Read a stored policy into the flat form the form edits, filling omitted
 * fields from Harness defaults so the controls always show a real number.
 *
 * Display only: the stored YAML keeps whatever the user set, so an omitted
 * field stays inherited after a Harness upgrade.
 *
 * @param policy - the stored policy, or undefined when the key is absent.
 * @returns flat editor state.
 */
export interface RetryEditorState {
    mode: 'normal' | 'always';
    maxRetries: number;
    retryableCodes: string[];
    initialDelayMs: number;
    maxDelayMs: number;
    jitterRatio: number;
}
/**
 * Project a stored policy into editor state, inheriting Harness defaults for
 * every omitted field.
 * @param policy - stored policy, or undefined for "Harness Default".
 * @returns editor state, or `null` when the key is absent (inherit).
 */
export declare function toRetryEditorState(policy: RetryPolicy | undefined): RetryEditorState | null;
/**
 * Turn editor state into the object to store.
 *
 * `always` deliberately drops `maxRetries` and `retryableCodes`: the resolver
 * ignores them in that mode, and storing fields the engine discards would make
 * the YAML claim something untrue (spec section 22).
 *
 * @param state - flat editor state.
 * @returns the policy to write.
 */
export declare function fromRetryEditorState(state: RetryEditorState): RetryPolicy;
/**
 * The policy Harness resolves when `retryPolicy` is absent: `mode: normal`
 * with the documented budgets.
 *
 * Used ONLY to recognise "the user stored exactly what the defaults would have
 * given them". It is never written to YAML — the whole point of the
 * Harness Default option is that the key is deleted, so a future DSH release
 * that changes these numbers is inherited rather than pinned (section 46).
 */
export declare const HARNESS_DEFAULT_POLICY: NormalRetryPolicy;
/**
 * Which preset a stored policy's VALUES correspond to.
 *
 * An absent key and an explicit policy equal to the Harness defaults both
 * report `harness-default`, because the user-visible behaviour is identical.
 * The two are still distinguishable at the call site by `policy === undefined`,
 * which is what tells the UI whether the key is inherited or merely restated.
 *
 * @param policy - the stored policy, or undefined when the key is absent.
 * @returns the matching preset id, or `custom`.
 */
export declare function matchRetryPreset(policy: RetryPolicy | undefined): RetryPresetId;
/** Re-exported so the reasoning section can validate thinking-budget keys. */
export { THINKING_LEVELS };
