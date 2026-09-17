/**
 * Vision declarations, byte units, and the status summary (spec sections 9,
 * 28-32, 41, 69).
 */
import { describe, expect, it } from 'vitest'
import {
  IMAGE_LIMIT_DEFAULTS,
  describePixelBudget,
  formatBytes,
  fromBytes,
  fromInputChoice,
  toBytes,
  toInputChoice,
  validateImageLimit,
  validateModalities,
} from '../src/shared/vision.js'
import {
  buildPreview,
  compatOverrideCount,
  hasAnyAdvanced,
  summarizeSections,
  visionModelCount,
} from '../src/shared/summary.js'
import { compatFieldsFor, COMPAT_FIELDS } from '../src/shared/capabilities.js'
import type { ProviderProfile } from '../src/shared/types.js'

describe('byte units', () => {
  it('converts 20 MiB to exactly the Harness default byte count', () => {
    expect(toBytes(20, 'MiB')).toBe(20_971_520)
    expect(toBytes(20, 'MiB')).toBe(IMAGE_LIMIT_DEFAULTS.maxRequestImageBytes)
  })

  it('converts each unit', () => {
    expect(toBytes(1, 'B')).toBe(1)
    expect(toBytes(1, 'KiB')).toBe(1024)
    expect(toBytes(1, 'MiB')).toBe(1_048_576)
    expect(toBytes(1, 'GiB')).toBe(1_073_741_824)
  })

  it('rejects values that are not representable as whole bytes', () => {
    expect(toBytes(Number.NaN, 'MiB')).toBeUndefined()
    expect(toBytes(-1, 'MiB')).toBeUndefined()
    expect(toBytes(Number.POSITIVE_INFINITY, 'MiB')).toBeUndefined()
  })

  it('picks the largest exact unit for display', () => {
    expect(fromBytes(20_971_520)).toEqual({ value: 20, unit: 'MiB' })
    expect(fromBytes(1_048_576)).toEqual({ value: 1, unit: 'MiB' })
    expect(fromBytes(1536)).toEqual({ value: 1536, unit: 'B' })
    expect(formatBytes(20_971_520)).toBe('20 MiB')
    expect(formatBytes(1024)).toBe('1 KiB')
  })
})

describe('image limits', () => {
  it('accepts the Harness defaults', () => {
    expect(validateImageLimit(IMAGE_LIMIT_DEFAULTS.maxRequestImageBytes)).toBeNull()
    expect(validateImageLimit(IMAGE_LIMIT_DEFAULTS.requestImagePixelBudget)).toBeNull()
    expect(validateImageLimit(IMAGE_LIMIT_DEFAULTS.requestImageMaxBytes)).toBeNull()
  })

  it('rejects zero, negative and non-integer counts', () => {
    expect(validateImageLimit(0)).toBe('not-positive-integer')
    expect(validateImageLimit(-1)).toBe('not-positive-integer')
    expect(validateImageLimit(1.5)).toBe('not-positive-integer')
    expect(validateImageLimit('1024')).toBe('not-positive-integer')
  })

  it('rejects counts beyond the safe-integer range', () => {
    expect(validateImageLimit(Number.MAX_SAFE_INTEGER + 2)).toBe('not-safe-integer')
  })

  it('renders a pixel budget as a square for sanity checking', () => {
    expect(describePixelBudget(4_194_304)).toBe('≈ 2048 × 2048')
  })
})

describe('modality declarations', () => {
  it('round-trips each of the three choices', () => {
    expect(toInputChoice(undefined)).toBe('inherit')
    expect(toInputChoice(['text'])).toBe('text')
    expect(toInputChoice(['text', 'image'])).toBe('text-image')

    expect(fromInputChoice('inherit')).toBeUndefined()
    expect(fromInputChoice('text')).toEqual(['text'])
    expect(fromInputChoice('text-image')).toEqual(['text', 'image'])
  })

  it('treats an empty stored list as inherit, as the Harness resolver does', () => {
    expect(toInputChoice([])).toBe('inherit')
  })

  it('round-trips through both directions', () => {
    for (const choice of ['inherit', 'text', 'text-image'] as const) {
      expect(toInputChoice(fromInputChoice(choice))).toBe(choice)
    }
  })

  it('validates modality lists', () => {
    expect(validateModalities(['text'])).toBeNull()
    expect(validateModalities(['text', 'image'])).toBeNull()
    expect(validateModalities([])).toBe('empty')
    expect(validateModalities(['audio'])).toBe('unknown-modality')
    expect(validateModalities('text')).toBe('not-array')
  })
})

describe('compat protocol awareness (section 38)', () => {
  it('offers no field without a known protocol', () => {
    expect(compatFieldsFor(undefined)).toEqual([])
    expect(compatFieldsFor('bedrock-converse-stream')).toEqual([])
  })

  it('never offers an OpenAI-only field to an Anthropic route', () => {
    const anthropic = compatFieldsFor('anthropic-messages').map((f) => f.key)
    expect(anthropic).not.toContain('supportsStore')
    expect(anthropic).not.toContain('thinkingFormat')
    expect(anthropic).not.toContain('maxTokensField')
    expect(anthropic).toContain('supportsTemperature')
    expect(anthropic).toContain('forceAdaptiveThinking')
  })

  it('never offers an Anthropic-only field to an OpenAI route', () => {
    for (const protocol of ['openai-completions', 'openai-responses']) {
      const keys = compatFieldsFor(protocol).map((f) => f.key)
      expect(keys).not.toContain('supportsTemperature')
      expect(keys).not.toContain('forceAdaptiveThinking')
      expect(keys).not.toContain('supportsStrictTools')
      expect(keys).not.toContain('allowEmptySignature')
    }
  })

  it('gives responses its own four fields plus the shared retention flag', () => {
    const keys = compatFieldsFor('openai-responses').map((f) => f.key)
    expect(keys.sort()).toEqual(
      ['supportsDeveloperRole', 'supportsLongCacheRetention', 'supportsMaxOutputTokens', 'supportsStrictMode'].sort(),
    )
  })

  it('covers all 26 fields across the three protocols', () => {
    const union = new Set<string>()
    for (const protocol of ['openai-completions', 'openai-responses', 'anthropic-messages']) {
      for (const field of compatFieldsFor(protocol)) union.add(field.key)
    }
    expect(union.size).toBe(COMPAT_FIELDS.length)
    expect(COMPAT_FIELDS).toHaveLength(26)
  })

  it('declares legal options for every enum field', () => {
    for (const field of COMPAT_FIELDS) {
      if (field.kind !== 'enum') continue
      expect(field.options, field.key).toBeDefined()
      expect(field.options!.length, field.key).toBeGreaterThan(0)
    }
  })
})

describe('summary', () => {
  const empty: ProviderProfile = { api: 'openai-completions', baseURL: 'https://x.test', models: [] }

  it('reports every section as default on a bare provider', () => {
    const sections = summarizeSections(empty)
    expect(sections.map((s) => s.status.kind)).toEqual(Array(8).fill('default'))
    expect(hasAnyAdvanced(empty)).toBe(false)
  })

  it('counts configured headers', () => {
    const profile: ProviderProfile = { ...empty, headers: { 'X-A': '1', 'X-B': '2' } }
    expect(summarizeSections(profile).find((s) => s.id === 'headers')?.status).toEqual({ kind: 'count', count: 2 })
  })

  it('reports a bounded retry policy with its budget', () => {
    const profile: ProviderProfile = { ...empty, retryPolicy: { mode: 'normal', maxRetries: 10 } }
    expect(summarizeSections(profile).find((s) => s.id === 'retry')?.status).toEqual({ kind: 'retries', count: 10 })
  })

  it('flags the unbounded retry policy distinctly', () => {
    const profile: ProviderProfile = { ...empty, retryPolicy: { mode: 'always', backoff: { initialDelayMs: 2000 } } }
    expect(summarizeSections(profile).find((s) => s.id === 'retry')?.status).toEqual({ kind: 'always' })
  })

  it('treats the Harness Default preset as default', () => {
    const profile: ProviderProfile = { ...empty, retryPolicy: { mode: 'normal', maxRetries: 5, retryableCodes: ['EMPTY_RESPONSE', 'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT'], backoff: { initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 } } }
    expect(summarizeSections(profile).find((s) => s.id === 'retry')?.status.kind).toBe('default')
  })

  it('counts image-capable models', () => {
    const profile: ProviderProfile = {
      ...empty,
      models: [
        { id: 'a', input: ['text', 'image'] },
        { id: 'b', input: ['text'] },
        { id: 'c' },
      ],
    }
    expect(visionModelCount(profile)).toBe(1)
  })

  it('counts compat overrides and ignores unknown compat keys', () => {
    const profile: ProviderProfile = { ...empty, compat: { supportsStore: true, futureFeature: true } }
    expect(compatOverrideCount(profile)).toBe(1)
    expect(summarizeSections(profile).find((s) => s.id === 'compatibility')?.status).toEqual({ kind: 'count', count: 1 })
  })

  it('reports a reasoning level verbatim', () => {
    const profile: ProviderProfile = { ...empty, reasoning: 'xhigh' }
    expect(summarizeSections(profile).find((s) => s.id === 'reasoning')?.status).toEqual({ kind: 'level', level: 'xhigh' })
  })

  it('counts models carrying a managed override', () => {
    const profile: ProviderProfile = {
      ...empty,
      models: [{ id: 'a', input: ['text'] }, { id: 'b' }, { id: 'c', reasoningEfforts: { low: 'low' } }],
    }
    expect(summarizeSections(profile).find((s) => s.id === 'models')?.status).toEqual({ kind: 'count', count: 2 })
  })
})

describe('preview (section 41)', () => {
  it('summarises rather than dumping YAML', () => {
    const profile: ProviderProfile = {
      api: 'openai-completions',
      baseURL: 'https://x.test',
      headers: { 'X-A': '1', 'X-B': '2', 'X-C': '3' },
      retryPolicy: { mode: 'normal', maxRetries: 10 },
      reasoning: 'high',
      compat: { supportsDeveloperRole: false },
      models: [{ id: 'a', input: ['text', 'image'] }, { id: 'b' }],
    }
    const lines = buildPreview(profile)
    const map = new Map(lines.map((line) => [line.key, line.value]))
    expect(map.get('headers')).toBe('3')
    expect(map.get('retry')).toBe('normal · 10')
    expect(map.get('reasoning')).toBe('high')
    expect(map.get('vision')).toBe('1')
    expect(map.get('compat.supportsDeveloperRole')).toBe('no')
    // No line ever contains a serialized object or a secret.
    for (const line of lines) {
      expect(line.value).not.toContain('{')
      expect(line.value).not.toContain('\n')
    }
  })

  it('omits every unset section instead of printing defaults', () => {
    const lines = buildPreview({ api: 'openai-completions', baseURL: 'https://x.test', models: [] })
    expect(lines).toEqual([])
  })
})
