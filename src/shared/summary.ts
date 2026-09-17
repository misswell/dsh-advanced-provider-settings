/**
 * Section status projection: what each advanced section currently holds, in a
 * form the collapsed disclosure can render without expanding (spec sections 8,
 * 9) and the Config Preview can narrate (section 41).
 *
 * The projection returns structured facts, never sentences — every string the
 * user reads comes from the locale files.
 */
import { COMPAT_FIELDS } from './capabilities.js'
import { matchRetryPreset } from './retry.js'
import type { ProviderProfile } from './types.js'
import { claimsImageSupport } from './vision.js'

/** Identifiers of the advanced sections. */
export type AdvancedSectionId =
  | 'headers'
  | 'retry'
  | 'timeout'
  | 'transport'
  | 'vision'
  | 'reasoning'
  | 'compatibility'
  | 'models'

/** Structured status of one section, translated at render time. */
export type SectionStatus =
  /** Nothing set: Harness defaults apply. */
  | { kind: 'default' }
  /** Nothing set, but a warning is worth surfacing. */
  | { kind: 'default-warning' }
  /** N items configured (headers, overrides, models). */
  | { kind: 'count'; count: number }
  /** A bounded retry policy with N maximum retries. */
  | { kind: 'retries'; count: number }
  /** The unbounded retry policy — always a warning. */
  | { kind: 'always' }
  /** A chosen reasoning level. */
  | { kind: 'level'; level: string }
  /** Set to something without a countable shape. */
  | { kind: 'custom' }
  /** Set, and the setting carries a hazard the user must see. */
  | { kind: 'custom-warning' }

/** One section's id + status. */
export interface SectionSummary {
  id: AdvancedSectionId
  status: SectionStatus
}

/**
 * Count the provider-level compatibility overrides present.
 * @param profile - the profile as read.
 * @returns how many compat fields are explicitly set.
 */
export function compatOverrideCount(profile: ProviderProfile): number {
  const compat = profile.compat
  if (compat === undefined || compat === null || typeof compat !== 'object') return 0
  const known = new Set(COMPAT_FIELDS.map((field) => field.key))
  return Object.keys(compat).filter((key) => known.has(key)).length
}

/**
 * Count models whose stored declaration claims image support, plus the
 * provider default when it does.
 * @param profile - the profile as read.
 * @returns the image-claiming count.
 */
export function visionModelCount(profile: ProviderProfile): number {
  const models = Array.isArray(profile.models) ? profile.models : []
  return models.filter((model) => claimsImageSupport(model.input)).length
}

/** Whether the provider default declares image input. */
export function providerClaimsImages(profile: ProviderProfile): boolean {
  return claimsImageSupport(profile.defaultInput)
}

/**
 * Whether any plugin-managed key is set on the profile or its models.
 * @param profile - the profile as read.
 * @returns whether anything is configured.
 */
export function hasAnyAdvanced(profile: ProviderProfile): boolean {
  return summarizeSections(profile).some((section) => section.status.kind !== 'default')
}

/**
 * Project every section's status from a profile.
 * @param profile - the profile as read from the user layer.
 * @returns one summary per section, in display order.
 */
export function summarizeSections(profile: ProviderProfile): SectionSummary[] {
  return [
    { id: 'headers', status: headersStatus(profile) },
    { id: 'retry', status: retryStatus(profile) },
    { id: 'timeout', status: timeoutStatus(profile) },
    { id: 'transport', status: transportStatus(profile) },
    { id: 'vision', status: visionStatus(profile) },
    { id: 'reasoning', status: reasoningStatus(profile) },
    { id: 'compatibility', status: compatStatus(profile) },
    { id: 'models', status: modelsStatus(profile) },
  ]
}

/** Headers: one count per configured field. */
function headersStatus(profile: ProviderProfile): SectionStatus {
  const headers = profile.headers
  const count = headers !== undefined && headers !== null && typeof headers === 'object' ? Object.keys(headers).length : 0
  return count === 0 ? { kind: 'default' } : { kind: 'count', count }
}

/** Retry: the preset name and, for a bounded policy, its budget. */
function retryStatus(profile: ProviderProfile): SectionStatus {
  const policy = profile.retryPolicy
  if (policy === undefined) return { kind: 'default' }
  if (matchRetryPreset(policy) === 'harness-default') return { kind: 'default' }
  if (policy.mode === 'always') return { kind: 'always' }
  return { kind: 'retries', count: policy.maxRetries ?? 5 }
}

/** Timeout: any of the three overrides present. */
function timeoutStatus(profile: ProviderProfile): SectionStatus {
  const set = [
    profile.timeoutMs,
    profile.streamIdleTimeoutMs,
    profile.websocketConnectTimeoutMs,
  ].filter((value) => value !== undefined).length
  return set === 0 ? { kind: 'default' } : { kind: 'count', count: set }
}

/** Transport: an explicit transport choice, or the cache-retention sibling. */
function transportStatus(profile: ProviderProfile): SectionStatus {
  const set = [profile.transport, profile.cacheRetention].filter((value) => value !== undefined).length
  return set === 0 ? { kind: 'default' } : { kind: 'count', count: set }
}

/** Vision: how many models claim images, plus whether budgets are customised. */
function visionStatus(profile: ProviderProfile): SectionStatus {
  const models = visionModelCount(profile)
  const budget =
    profile.maxRequestImageBytes !== undefined ||
    profile.requestImagePixelBudget !== undefined ||
    profile.requestImageMaxBytes !== undefined
  if (profile.defaultInput !== undefined) {
    return { kind: 'count', count: models + 1 }
  }
  if (models > 0) return { kind: 'count', count: models }
  if (budget) return { kind: 'custom' }
  return { kind: 'default' }
}

/** Reasoning: the provider default level, plus thinking budgets. */
function reasoningStatus(profile: ProviderProfile): SectionStatus {
  if (profile.reasoning !== undefined) return { kind: 'level', level: profile.reasoning }
  if (profile.thinkingBudgets !== undefined) return { kind: 'custom' }
  return { kind: 'default' }
}

/** Compatibility: how many provider-level overrides are set. */
function compatStatus(profile: ProviderProfile): SectionStatus {
  const count = compatOverrideCount(profile)
  return count === 0 ? { kind: 'default' } : { kind: 'count', count }
}

/** Models: how many entries carry a plugin-managed override. */
function modelsStatus(profile: ProviderProfile): SectionStatus {
  const models = Array.isArray(profile.models) ? profile.models : []
  const count = models.filter(
    (model) => model.input !== undefined || model.reasoningEfforts !== undefined,
  ).length
  return count === 0 ? { kind: 'default' } : { kind: 'count', count }
}

/** One line of the Effective Configuration preview. */
export interface PreviewLine {
  /** Stable key for the label lookup. */
  key: string
  /** Already-formatted value; numbers and short identifiers only. */
  value: string
}

/**
 * Build the summarised "Effective Configuration" the preview shows — never a
 * full YAML dump (spec section 41).
 * @param profile - the profile as read.
 * @returns labelled value lines.
 */
export function buildPreview(profile: ProviderProfile): PreviewLine[] {
  const lines: PreviewLine[] = []

  const headerCount = profile.headers === undefined ? 0 : Object.keys(profile.headers).length
  if (headerCount > 0) lines.push({ key: 'headers', value: String(headerCount) })

  if (profile.retryPolicy !== undefined) {
    const policy = profile.retryPolicy
    lines.push({
      key: 'retry',
      value:
        policy.mode === 'always'
          ? 'always'
          : `normal · ${String(policy.maxRetries ?? 5)}`,
    })
  }

  if (profile.transport !== undefined) lines.push({ key: 'transport', value: String(profile.transport) })
  if (profile.cacheRetention !== undefined) {
    lines.push({ key: 'cacheRetention', value: String(profile.cacheRetention) })
  }

  const timeouts: string[] = []
  if (profile.timeoutMs !== undefined) timeouts.push(`http ${String(profile.timeoutMs)}ms`)
  if (profile.streamIdleTimeoutMs !== undefined) {
    timeouts.push(`idle ${String(profile.streamIdleTimeoutMs)}ms`)
  }
  if (profile.websocketConnectTimeoutMs !== undefined) {
    timeouts.push(`ws ${String(profile.websocketConnectTimeoutMs)}ms`)
  }
  if (timeouts.length > 0) lines.push({ key: 'timeout', value: timeouts.join(' · ') })

  const vision = visionModelCount(profile)
  if (vision > 0) lines.push({ key: 'vision', value: String(vision) })
  if (providerClaimsImages(profile)) lines.push({ key: 'defaultInput', value: 'text+image' })

  if (profile.reasoning !== undefined) lines.push({ key: 'reasoning', value: profile.reasoning })

  const compat = profile.compat
  if (compat !== undefined && compat !== null && typeof compat === 'object') {
    for (const field of COMPAT_FIELDS) {
      const value = (compat as Record<string, unknown>)[field.key]
      if (value === undefined) continue
      lines.push({ key: `compat.${field.key}`, value: formatCompatValue(value) })
    }
  }

  const models = Array.isArray(profile.models) ? profile.models : []
  const overridden = models.filter((model) => model.reasoningEfforts !== undefined).length
  if (overridden > 0) lines.push({ key: 'reasoningEfforts', value: String(overridden) })

  return lines
}

/** Render one compat value compactly for the preview. */
function formatCompatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (value === null) return 'null'
  if (typeof value === 'object') return `{ ${String(Object.keys(value as object).length)} }`
  return String(value)
}
