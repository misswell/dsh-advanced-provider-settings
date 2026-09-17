/**
 * Host-side validation of a draft advanced configuration.
 *
 * The browser half validates before enabling Save, for immediate feedback. This
 * module is the defence-in-depth pass that runs on the host side of the RPC, so
 * a hand-crafted request cannot push a configuration that Harness would reject
 * at profile-resolution time.
 *
 * Note the division of labour with Harness: the real authority is the settings
 * document's own validation, which runs on every write (`RetryPolicySchema`
 * plus the `llm-pi-ai` section's `validate` hook calling `resolveRetryPolicy`).
 * This module mirrors the resolver's stricter rules so the failure is reported
 * as a field-level message instead of an opaque write rejection.
 */
import { COMPAT_FIELD_BY_KEY, isProtocolId, THINKING_LEVELS } from '../shared/capabilities.js'
import { validateHeaderRecord } from '../shared/headers.js'
import { validateRetryPolicy } from '../shared/retry.js'
import type { ProviderProfile } from '../shared/types.js'
import { validateImageLimit, validateModalities } from '../shared/vision.js'

/** One field-level problem found in a draft. */
export interface DraftIssue {
  /** Field path inside the provider profile, e.g. `retryPolicy.backoff.jitterRatio`. */
  field: string
  /** Stable code the client resolves through its locale files. */
  code: string
  /** Offending value rendered small and safe for diagnostics (never a secret). */
  detail?: string
}

/** Fields this module knows how to judge. */
const POSITIVE_INTEGER_FIELDS = ['timeoutMs', 'websocketConnectTimeoutMs'] as const

/**
 * Validate the advanced fields of one provider draft.
 *
 * Only plugin-managed fields are examined. Identity, endpoint, credential
 * reference and model window sizes are Harness's business and are not judged
 * here (spec section 48).
 *
 * @param profile - the candidate profile.
 * @returns every problem found, empty when the draft is acceptable.
 */
export function validateProviderDraft(profile: ProviderProfile): DraftIssue[] {
  const issues: DraftIssue[] = []

  if (profile.api !== undefined && !isProtocolId(profile.api)) {
    issues.push({ field: 'api', code: 'protocol-unknown', detail: String(profile.api) })
  }

  issues.push(...validateHeaderIssues(profile.headers))

  if (profile.defaultInput !== undefined) {
    const problem = validateModalities(profile.defaultInput)
    if (problem !== null) issues.push({ field: 'defaultInput', code: `modalities-${problem}` })
  }

  if (profile.reasoning !== undefined && !(THINKING_LEVELS as readonly unknown[]).includes(profile.reasoning)) {
    issues.push({ field: 'reasoning', code: 'thinking-level-unknown', detail: String(profile.reasoning) })
  }

  if (profile.thinkingBudgets !== undefined) {
    for (const [level, value] of Object.entries(profile.thinkingBudgets)) {
      if (!['minimal', 'low', 'medium', 'high'].includes(level)) {
        issues.push({ field: `thinkingBudgets.${level}`, code: 'thinking-budget-unknown-level' })
        continue
      }
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        issues.push({ field: `thinkingBudgets.${level}`, code: 'thinking-budget-invalid' })
      }
    }
  }

  for (const field of POSITIVE_INTEGER_FIELDS) {
    const value = profile[field]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      issues.push({ field, code: 'natural-number-required' })
    }
  }

  if (profile.streamIdleTimeoutMs !== undefined) {
    const value = profile.streamIdleTimeoutMs
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 2_147_483_647) {
      issues.push({ field: 'streamIdleTimeoutMs', code: 'positive-delay-required' })
    }
  }

  for (const field of ['maxRequestImageBytes', 'requestImagePixelBudget', 'requestImageMaxBytes'] as const) {
    const value = profile[field]
    if (value === undefined) continue
    const problem = validateImageLimit(value)
    if (problem !== null) issues.push({ field, code: `image-limit-${problem}` })
  }

  if (profile.retryPolicy !== undefined) {
    for (const issue of validateRetryPolicy(profile.retryPolicy)) {
      issues.push({ field: issue.field === '' ? 'retryPolicy' : `retryPolicy.${issue.field}`, code: issue.code })
    }
  }

  issues.push(...validateCompatIssues(profile.compat, 'compat', profile.api))

  const models = Array.isArray(profile.models) ? profile.models : []
  models.forEach((model, index) => {
    if (model.input !== undefined) {
      const problem = validateModalities(model.input)
      if (problem !== null) issues.push({ field: `models.${String(index)}.input`, code: `modalities-${problem}` })
    }
    if (model.reasoningEfforts !== undefined && model.reasoningEfforts !== false) {
      const efforts = model.reasoningEfforts
      if (typeof efforts !== 'object' || efforts === null || Array.isArray(efforts)) {
        issues.push({ field: `models.${String(index)}.reasoningEfforts`, code: 'reasoning-efforts-shape' })
      } else {
        for (const [level, wire] of Object.entries(efforts)) {
          if (!(THINKING_LEVELS as readonly unknown[]).includes(level)) {
            issues.push({
              field: `models.${String(index)}.reasoningEfforts.${level}`,
              code: 'thinking-level-unknown',
              detail: level,
            })
          }
          if (wire !== null && typeof wire !== 'string') {
            issues.push({
              field: `models.${String(index)}.reasoningEfforts.${level}`,
              code: 'reasoning-effort-wire-type',
            })
          }
        }
      }
    }
    issues.push(...validateCompatIssues(model.compat, `models.${String(index)}.compat`, profile.api))
  })

  return issues
}

/** Header problems, reported one per offending field. */
function validateHeaderIssues(headers: Record<string, unknown> | undefined): DraftIssue[] {
  return validateHeaderRecord(headers).map((problem) => ({
    field: `headers.${problem.name}`,
    code: `header-${problem.code}`,
  }))
}

/**
 * Compatibility problems.
 *
 * Model-level `compat` is a HARD ERROR in Harness when it names a field the
 * model's protocol does not offer, while a route-level one is silently skipped.
 * We report both, because a silently ignored route-level field is also a bug
 * the user should know about.
 */
function validateCompatIssues(
  compat: Record<string, unknown> | undefined,
  prefix: string,
  protocol: string | undefined,
): DraftIssue[] {
  if (compat === undefined || compat === null || typeof compat !== 'object') return []
  const issues: DraftIssue[] = []
  for (const [key, value] of Object.entries(compat)) {
    const definition = COMPAT_FIELD_BY_KEY.get(key)
    if (definition === undefined) {
      issues.push({ field: `${prefix}.${key}`, code: 'compat-unknown-field', detail: key })
      continue
    }
    if (protocol !== undefined && !definition.protocols.includes(protocol as never)) {
      issues.push({ field: `${prefix}.${key}`, code: 'compat-wrong-protocol', detail: protocol })
    }
    if (value === undefined || value === null) continue
    switch (definition.kind) {
      case 'boolean':
        if (typeof value !== 'boolean') issues.push({ field: `${prefix}.${key}`, code: 'compat-boolean-required' })
        break
      case 'enum':
        if (typeof value !== 'string' || !(definition.options ?? []).includes(value)) {
          issues.push({ field: `${prefix}.${key}`, code: 'compat-enum-invalid', detail: String(value) })
        }
        break
      case 'number':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          issues.push({ field: `${prefix}.${key}`, code: 'compat-integer-required' })
        }
        break
      case 'dict':
        if (typeof value !== 'object' || Array.isArray(value)) {
          issues.push({ field: `${prefix}.${key}`, code: 'compat-dict-required' })
        }
        break
    }
  }
  return issues
}

/** Whether any issue is severe enough to refuse the write. */
export function hasBlockingIssue(issues: readonly DraftIssue[]): boolean {
  return issues.length > 0
}
