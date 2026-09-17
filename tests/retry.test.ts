/**
 * Retry validation and preset semantics (spec sections 21-25, 67).
 *
 * The rules asserted here are the Harness RESOLVER's, not merely the
 * schemastery schema's. The cases below (`initialDelayMs: 0`, empty codes,
 * duplicates) pass the schema and then throw at profile resolution, which is
 * exactly why the UI must reject them.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RETRYABLE_CODES,
  MAX_TIMER_DELAY_MS,
  RETRY_PRESETS,
  fromRetryEditorState,
  matchRetryPreset,
  toRetryEditorState,
  validateRetryPolicy,
  type RetryPolicy,
} from '../src/shared/retry.js'

const validNormal: RetryPolicy = {
  mode: 'normal',
  maxRetries: 5,
  retryableCodes: ['EMPTY_RESPONSE', 'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT'],
  backoff: { initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 },
}

describe('validateRetryPolicy — normal', () => {
  it('accepts a well-formed normal policy', () => {
    expect(validateRetryPolicy(validNormal)).toEqual([])
  })

  it('accepts an omitted maxRetries because the schema defaults it', () => {
    expect(validateRetryPolicy({ mode: 'normal' })).toEqual([])
  })

  it('accepts maxRetries = 0, the way to retry nothing', () => {
    expect(validateRetryPolicy({ ...validNormal, maxRetries: 0 })).toEqual([])
  })

  it('accepts the boundary maxRetries = 5', () => {
    expect(validateRetryPolicy({ ...validNormal, maxRetries: 5 })).toEqual([])
  })

  it('rejects a negative maxRetries', () => {
    expect(validateRetryPolicy({ ...validNormal, maxRetries: -1 })).toContainEqual({
      field: 'maxRetries',
      code: 'max-retries-negative',
    })
  })

  it('rejects a fractional maxRetries', () => {
    expect(validateRetryPolicy({ ...validNormal, maxRetries: 1.5 })).toContainEqual({
      field: 'maxRetries',
      code: 'max-retries-not-integer',
    })
  })

  it('rejects an empty retryableCodes list', () => {
    expect(validateRetryPolicy({ ...validNormal, retryableCodes: [] })).toContainEqual({
      field: 'retryableCodes',
      code: 'codes-empty',
    })
  })

  it('rejects an empty string code', () => {
    expect(validateRetryPolicy({ ...validNormal, retryableCodes: ['SERVER', ''] })).toContainEqual({
      field: 'retryableCodes',
      code: 'codes-not-string',
    })
  })

  it('rejects duplicate codes', () => {
    expect(validateRetryPolicy({ ...validNormal, retryableCodes: ['SERVER', 'SERVER'] })).toContainEqual({
      field: 'retryableCodes',
      code: 'codes-duplicate',
    })
  })

  it('accepts custom codes, because the Harness list is open', () => {
    expect(validateRetryPolicy({ ...validNormal, retryableCodes: ['QUOTA', 'GATEWAY_TEMPORARY'] })).toEqual([])
  })

  it('has no default codes in the preset list beyond the five Harness ships', () => {
    expect(DEFAULT_RETRYABLE_CODES).toEqual([
      'EMPTY_RESPONSE',
      'RATE_LIMIT',
      'SERVER',
      'TIMEOUT',
      'TRANSPORT',
    ])
  })
})

describe('validateRetryPolicy — always', () => {
  it('accepts an always policy with backoff only', () => {
    expect(validateRetryPolicy({ mode: 'always', backoff: { initialDelayMs: 2000, maxDelayMs: 300_000, jitterRatio: 0.2 } })).toEqual([])
  })

  it('accepts an always policy carrying the fields the engine ignores', () => {
    // The live settings.yaml carries retryableCodes under mode: always because
    // ALWAYS_POLICY_KEYS deliberately admits them.
    expect(validateRetryPolicy({ mode: 'always', maxRetries: 3, retryableCodes: ['SERVER'] })).toEqual([])
  })

  it('does not police maxRetries under always, mirroring the resolver', () => {
    expect(validateRetryPolicy({ mode: 'always', maxRetries: -5 })).toEqual([])
  })
})

describe('validateRetryPolicy — mode and shape', () => {
  it('requires mode whenever the policy is present', () => {
    expect(validateRetryPolicy({})).toContainEqual({ field: 'mode', code: 'mode-required' })
    expect(validateRetryPolicy({ maxRetries: 3 })).toContainEqual({ field: 'mode', code: 'mode-required' })
  })

  it('rejects an unknown mode', () => {
    expect(validateRetryPolicy({ mode: 'sometimes' })).toContainEqual({ field: 'mode', code: 'mode-invalid' })
  })

  it('rejects a non-object policy', () => {
    expect(validateRetryPolicy(null)).toContainEqual({ field: '', code: 'mode-invalid' })
    expect(validateRetryPolicy('normal')).toContainEqual({ field: '', code: 'mode-invalid' })
  })
})

describe('validateRetryPolicy — backoff', () => {
  it('rejects jitterRatio below 0', () => {
    expect(validateRetryPolicy({ ...validNormal, backoff: { jitterRatio: -0.01 } })).toContainEqual({
      field: 'backoff.jitterRatio',
      code: 'jitter-out-of-range',
    })
  })

  it('accepts the jitterRatio boundaries 0 and 1', () => {
    expect(validateRetryPolicy({ ...validNormal, backoff: { jitterRatio: 0 } })).toEqual([])
    expect(validateRetryPolicy({ ...validNormal, backoff: { jitterRatio: 1 } })).toEqual([])
  })

  it('rejects jitterRatio above 1', () => {
    expect(validateRetryPolicy({ ...validNormal, backoff: { jitterRatio: 1.5 } })).toContainEqual({
      field: 'backoff.jitterRatio',
      code: 'jitter-out-of-range',
    })
  })

  it('rejects a non-finite jitterRatio', () => {
    expect(validateRetryPolicy({ ...validNormal, backoff: { jitterRatio: Number.NaN } })).toContainEqual({
      field: 'backoff.jitterRatio',
      code: 'jitter-not-finite',
    })
  })

  it('accepts initialDelayMs equal to maxDelayMs', () => {
    expect(validateRetryPolicy({ ...validNormal, backoff: { initialDelayMs: 1000, maxDelayMs: 1000 } })).toEqual([])
  })

  it('rejects initialDelayMs greater than maxDelayMs', () => {
    expect(validateRetryPolicy({ ...validNormal, backoff: { initialDelayMs: 1001, maxDelayMs: 1000 } })).toContainEqual({
      field: 'backoff.maxDelayMs',
      code: 'backoff-initial-exceeds-max',
    })
  })

  it('rejects the zero delays that pass the schema but throw in the resolver', () => {
    expect(validateRetryPolicy({ ...validNormal, backoff: { initialDelayMs: 0 } })).toContainEqual({
      field: 'backoff.initialDelayMs',
      code: 'backoff-initial-invalid',
    })
    expect(validateRetryPolicy({ ...validNormal, backoff: { maxDelayMs: 0 } })).toContainEqual({
      field: 'backoff.maxDelayMs',
      code: 'backoff-max-invalid',
    })
  })

  it('rejects delays above the timer ceiling', () => {
    expect(validateRetryPolicy({ ...validNormal, backoff: { maxDelayMs: MAX_TIMER_DELAY_MS + 1 } })).toContainEqual({
      field: 'backoff.maxDelayMs',
      code: 'backoff-max-invalid',
    })
  })

  it('accepts exactly the timer ceiling', () => {
    expect(validateRetryPolicy({ mode: 'normal', backoff: { maxDelayMs: MAX_TIMER_DELAY_MS } })).toEqual([])
  })
})

describe('presets', () => {
  it('maps the absent policy to the Harness Default preset', () => {
    expect(matchRetryPreset(undefined)).toBe('harness-default')
    expect(RETRY_PRESETS.find((p) => p.id === 'harness-default')?.policy).toBeNull()
  })

  it('round-trips every concrete preset through the editor state', () => {
    for (const preset of RETRY_PRESETS) {
      if (preset.policy === null) continue
      const state = toRetryEditorState(preset.policy)
      expect(state).not.toBeNull()
      expect(fromRetryEditorState(state!)).toEqual(preset.policy)
      expect(matchRetryPreset(fromRetryEditorState(state!))).toBe(preset.id)
    }
  })

  it('reports a hand-edited policy as custom', () => {
    expect(matchRetryPreset({ mode: 'normal', maxRetries: 7 })).toBe('custom')
  })

  it('never enables always by default', () => {
    for (const preset of RETRY_PRESETS) {
      expect(preset.policy?.mode === 'always').toBe(false)
    }
  })

  it('drops maxRetries and retryableCodes when the mode is always', () => {
    const state = toRetryEditorState(validNormal)!
    const always = fromRetryEditorState({ ...state, mode: 'always' })
    expect(always).toEqual({
      mode: 'always',
      backoff: { initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 },
    })
    expect(Object.hasOwn(always, 'maxRetries')).toBe(false)
    expect(Object.hasOwn(always, 'retryableCodes')).toBe(false)
  })

  it('fills omitted fields from Harness defaults for display', () => {
    const state = toRetryEditorState({ mode: 'normal' })!
    expect(state).toMatchObject({ maxRetries: 5, initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 })
    expect(state.retryableCodes).toEqual([...DEFAULT_RETRYABLE_CODES])
  })

  it('returns null for an absent policy so the UI shows Harness Default', () => {
    expect(toRetryEditorState(undefined)).toBeNull()
  })
})
