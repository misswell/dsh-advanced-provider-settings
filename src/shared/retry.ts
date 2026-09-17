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
import { THINKING_LEVELS } from './capabilities.js'

/**
 * Largest timer delay Harness accepts, from `dsh-timeout`'s MAX_TIMER_DELAY_MS.
 * The resolver rejects anything above it for both backoff bounds.
 */
export const MAX_TIMER_DELAY_MS = 2_147_483_647

/**
 * Failure codes retried when a policy omits `retryableCodes`.
 * Source: `DEFAULT_RETRYABLE_CODES` in dsh-llm.
 */
export const DEFAULT_RETRYABLE_CODES = [
  'EMPTY_RESPONSE',
  'RATE_LIMIT',
  'SERVER',
  'TIMEOUT',
  'TRANSPORT',
] as const

/**
 * The codes the UI offers as checkboxes. The list is deliberately NOT an enum:
 * Harness accepts `z.array(z.string())` and the resolver only rejects empty
 * arrays, empty strings and duplicates, so custom codes are first-class
 * (spec section 23).
 */
export const WELL_KNOWN_RETRYABLE_CODES = DEFAULT_RETRYABLE_CODES

/** Harness defaults in force when `retryPolicy` is absent, for display only. */
export const RETRY_DEFAULTS = {
  mode: 'normal',
  maxRetries: 5,
  retryableCodes: [...DEFAULT_RETRYABLE_CODES],
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  jitterRatio: 0.1,
} as const

/** Exponential-backoff settings. All fields optional: omission inherits. */
export interface RetryBackoff {
  initialDelayMs?: number
  maxDelayMs?: number
  jitterRatio?: number
}

/** Policy retrying a bounded number of in-policy failures. */
export interface NormalRetryPolicy {
  mode: 'normal'
  maxRetries?: number
  /** Custom codes are permitted; Harness does not interpret unknown values. */
  retryableCodes?: string[]
  backoff?: RetryBackoff
}

/**
 * Policy retrying every failure without a budget, until success, cancellation
 * or shutdown. Powers the strongest warning in the UI (spec section 22).
 */
export interface AlwaysRetryPolicy {
  mode: 'always'
  backoff?: RetryBackoff
}

/** A provider's `retryPolicy` value. */
export type RetryPolicy = NormalRetryPolicy | AlwaysRetryPolicy

/** Stable pre-harness configurations the UI can apply in one click. */
export type RetryPresetId = 'harness-default' | 'conservative' | 'aggressive' | 'custom'

/** One preset's contents, or the instruction to delete the key. */
export interface RetryPreset {
  id: RetryPresetId
  /** `null` means "delete `retryPolicy` and inherit Harness defaults". */
  policy: RetryPolicy | null
}

/**
 * Plugin-authored presets.
 *
 * Only `harness-default` reflects an official default. The other two are this
 * plugin's suggestions and the UI labels them as such (spec section 25).
 */
export const RETRY_PRESETS: readonly RetryPreset[] = [
  { id: 'harness-default', policy: null },
  {
    id: 'conservative',
    policy: {
      mode: 'normal',
      maxRetries: 3,
      retryableCodes: [...DEFAULT_RETRYABLE_CODES],
      backoff: { initialDelayMs: 1000, maxDelayMs: 10_000, jitterRatio: 0.1 },
    },
  },
  {
    id: 'aggressive',
    policy: {
      mode: 'normal',
      maxRetries: 10,
      retryableCodes: [...DEFAULT_RETRYABLE_CODES],
      backoff: { initialDelayMs: 1000, maxDelayMs: 30_000, jitterRatio: 0.2 },
    },
  },
]

/** Machine-readable validation failure, resolved to copy by the caller. */
export type RetryIssueCode =
  | 'mode-required'
  | 'mode-invalid'
  | 'max-retries-not-integer'
  | 'max-retries-negative'
  | 'codes-empty'
  | 'codes-not-string'
  | 'codes-duplicate'
  | 'backoff-initial-invalid'
  | 'backoff-max-invalid'
  | 'backoff-initial-exceeds-max'
  | 'jitter-out-of-range'
  | 'jitter-not-finite'

/** One validation failure with the field it belongs to. */
export interface RetryIssue {
  /** Dotted path inside the policy, e.g. `backoff.initialDelayMs`. */
  field: string
  code: RetryIssueCode
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
export function validateRetryPolicy(policy: unknown): RetryIssue[] {
  const issues: RetryIssue[] = []
  if (typeof policy !== 'object' || policy === null || Array.isArray(policy)) {
    return [{ field: '', code: 'mode-invalid' }]
  }
  const record = policy as Record<string, unknown>

  if (record.mode === undefined) issues.push({ field: 'mode', code: 'mode-required' })
  else if (record.mode !== 'normal' && record.mode !== 'always') {
    issues.push({ field: 'mode', code: 'mode-invalid' })
  }
  const mode = record.mode === 'always' ? 'always' : 'normal'

  if (mode === 'normal') {
    const maxRetries = record.maxRetries
    if (maxRetries !== undefined) {
      if (typeof maxRetries !== 'number' || !Number.isSafeInteger(maxRetries)) {
        issues.push({ field: 'maxRetries', code: 'max-retries-not-integer' })
      } else if (maxRetries < 0) {
        issues.push({ field: 'maxRetries', code: 'max-retries-negative' })
      }
    }

    const codes = record.retryableCodes
    if (codes !== undefined) {
      if (!Array.isArray(codes) || codes.length === 0) {
        issues.push({ field: 'retryableCodes', code: 'codes-empty' })
      } else if (codes.some((code) => typeof code !== 'string' || code.length === 0)) {
        issues.push({ field: 'retryableCodes', code: 'codes-not-string' })
      } else if (new Set(codes).size !== codes.length) {
        issues.push({ field: 'retryableCodes', code: 'codes-duplicate' })
      }
    }
  }

  const backoff = record.backoff
  if (backoff !== undefined && backoff !== null) {
    if (typeof backoff !== 'object' || Array.isArray(backoff)) {
      issues.push({ field: 'backoff', code: 'backoff-initial-invalid' })
      return issues
    }
    const values = backoff as Record<string, unknown>
    const initial = values.initialDelayMs
    const max = values.maxDelayMs
    const jitter = values.jitterRatio

    const initialOk = validDelay(initial)
    const maxOk = validDelay(max)
    if (!initialOk) issues.push({ field: 'backoff.initialDelayMs', code: 'backoff-initial-invalid' })
    if (!maxOk) issues.push({ field: 'backoff.maxDelayMs', code: 'backoff-max-invalid' })
    if (initialOk && maxOk && (initial as number) > (max as number)) {
      issues.push({ field: 'backoff.maxDelayMs', code: 'backoff-initial-exceeds-max' })
    }
    if (jitter !== undefined) {
      if (typeof jitter !== 'number' || !Number.isFinite(jitter)) {
        issues.push({ field: 'backoff.jitterRatio', code: 'jitter-not-finite' })
      } else if (jitter < 0 || jitter > 1) {
        issues.push({ field: 'backoff.jitterRatio', code: 'jitter-out-of-range' })
      }
    }
  }

  return issues
}

/** Whether a backoff bound is absent or an accepted positive finite delay. */
function validDelay(value: unknown): boolean {
  if (value === undefined) return true
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_TIMER_DELAY_MS
}

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
  mode: 'normal' | 'always'
  maxRetries: number
  retryableCodes: string[]
  initialDelayMs: number
  maxDelayMs: number
  jitterRatio: number
}

/**
 * Project a stored policy into editor state, inheriting Harness defaults for
 * every omitted field.
 * @param policy - stored policy, or undefined for "Harness Default".
 * @returns editor state, or `null` when the key is absent (inherit).
 */
export function toRetryEditorState(policy: RetryPolicy | undefined): RetryEditorState | null {
  if (policy === undefined) return null
  const backoff = policy.backoff ?? {}
  return {
    mode: policy.mode,
    maxRetries: policy.mode === 'normal' ? policy.maxRetries ?? RETRY_DEFAULTS.maxRetries : RETRY_DEFAULTS.maxRetries,
    retryableCodes:
      policy.mode === 'normal'
        ? [...(policy.retryableCodes ?? RETRY_DEFAULTS.retryableCodes)]
        : [...RETRY_DEFAULTS.retryableCodes],
    initialDelayMs: backoff.initialDelayMs ?? RETRY_DEFAULTS.initialDelayMs,
    maxDelayMs: backoff.maxDelayMs ?? RETRY_DEFAULTS.maxDelayMs,
    jitterRatio: backoff.jitterRatio ?? RETRY_DEFAULTS.jitterRatio,
  }
}

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
export function fromRetryEditorState(state: RetryEditorState): RetryPolicy {
  const backoff: RetryBackoff = {
    initialDelayMs: state.initialDelayMs,
    maxDelayMs: state.maxDelayMs,
    jitterRatio: state.jitterRatio,
  }
  if (state.mode === 'always') return { mode: 'always', backoff }
  return {
    mode: 'normal',
    maxRetries: state.maxRetries,
    retryableCodes: [...state.retryableCodes],
    backoff,
  }
}

/**
 * The policy Harness resolves when `retryPolicy` is absent: `mode: normal`
 * with the documented budgets.
 *
 * Used ONLY to recognise "the user stored exactly what the defaults would have
 * given them". It is never written to YAML — the whole point of the
 * Harness Default option is that the key is deleted, so a future DSH release
 * that changes these numbers is inherited rather than pinned (section 46).
 */
export const HARNESS_DEFAULT_POLICY: NormalRetryPolicy = {
  mode: 'normal',
  maxRetries: RETRY_DEFAULTS.maxRetries,
  retryableCodes: [...DEFAULT_RETRYABLE_CODES],
  backoff: {
    initialDelayMs: RETRY_DEFAULTS.initialDelayMs,
    maxDelayMs: RETRY_DEFAULTS.maxDelayMs,
    jitterRatio: RETRY_DEFAULTS.jitterRatio,
  },
}

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
export function matchRetryPreset(policy: RetryPolicy | undefined): RetryPresetId {
  if (policy === undefined) return 'harness-default'
  const candidates: RetryPolicy[] = [HARNESS_DEFAULT_POLICY]
  for (const preset of RETRY_PRESETS) {
    if (preset.policy !== null) candidates.push(preset.policy)
  }
  for (let index = 0; index < candidates.length; index += 1) {
    if (samePolicy(candidates[index]!, policy)) {
      return index === 0 ? 'harness-default' : RETRY_PRESETS.filter((p) => p.policy !== null)[index - 1]!.id
    }
  }
  return 'custom'
}

/** Structural comparison over the stored policy shape. */
function samePolicy(a: RetryPolicy, b: RetryPolicy): boolean {
  if (a.mode !== b.mode) return false
  const aBackoff = a.backoff ?? {}
  const bBackoff = b.backoff ?? {}
  if (
    (aBackoff.initialDelayMs ?? RETRY_DEFAULTS.initialDelayMs) !==
      (bBackoff.initialDelayMs ?? RETRY_DEFAULTS.initialDelayMs) ||
    (aBackoff.maxDelayMs ?? RETRY_DEFAULTS.maxDelayMs) !== (bBackoff.maxDelayMs ?? RETRY_DEFAULTS.maxDelayMs) ||
    (aBackoff.jitterRatio ?? RETRY_DEFAULTS.jitterRatio) !== (bBackoff.jitterRatio ?? RETRY_DEFAULTS.jitterRatio)
  ) {
    return false
  }
  if (a.mode !== 'normal' || b.mode !== 'normal') return true
  const aCodes = [...(a.retryableCodes ?? RETRY_DEFAULTS.retryableCodes)]
  const bCodes = [...(b.retryableCodes ?? RETRY_DEFAULTS.retryableCodes)]
  return a.maxRetries === b.maxRetries && aCodes.join('\u0000') === bCodes.join('\u0000')
}

/** Re-exported so the reasoning section can validate thinking-budget keys. */
export { THINKING_LEVELS }
