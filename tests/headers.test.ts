/**
 * Header semantics: precedence, case-insensitive override, injection
 * rejection, sensitivity, masking (spec sections 13, 18, 19, 65).
 */
import { describe, expect, it } from 'vitest'
import {
  displayHeaderValue,
  effectiveHeaders,
  headerEntriesOf,
  isSensitiveHeader,
  maskHeaderValue,
  mergeHeaderLayers,
  validateHeader,
  validateHeaderRecord,
  type HeaderLayer,
} from '../src/shared/headers.js'

const harness: HeaderLayer = { source: 'harness', headers: [{ name: 'user-agent', value: 'deepseek-harness/1' }] }
const global: HeaderLayer = { source: 'global', headers: [{ name: 'X-Client', value: 'dsh' }] }
const provider: HeaderLayer = { source: 'provider', headers: [{ name: 'X-Provider', value: 'A' }] }

describe('validateHeader', () => {
  it('accepts ordinary field names and values', () => {
    expect(validateHeader('X-Client-Name', 'dsh')).toEqual({ ok: true })
    expect(validateHeader('user-agent', 'claude-cli/2.1.161')).toEqual({ ok: true })
    expect(validateHeader('A!#$%&\'*+-.^_`|~', 'v')).toEqual({ ok: true })
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(validateHeader('', 'v')).toEqual({ ok: false, code: 'empty-name' })
    expect(validateHeader('   ', 'v')).toEqual({ ok: false, code: 'empty-name' })
  })

  it('rejects names outside the token grammar', () => {
    expect(validateHeader('X Client', 'v')).toEqual({ ok: false, code: 'invalid-name' })
    expect(validateHeader('X:Client', 'v')).toEqual({ ok: false, code: 'invalid-name' })
    expect(validateHeader('X-Client\u00e9', 'v')).toEqual({ ok: false, code: 'invalid-name' })
    expect(validateHeader('X(Client)', 'v')).toEqual({ ok: false, code: 'invalid-name' })
  })

  it('rejects CRLF injection in name or value', () => {
    expect(validateHeader('X-Evil\r\nX-Steal', 'v')).toEqual({ ok: false, code: 'crlf' })
    expect(validateHeader('X-Evil', 'v\r\nX-Steal: 1')).toEqual({ ok: false, code: 'crlf' })
    expect(validateHeader('X-Evil', 'v\nX-Steal: 1')).toEqual({ ok: false, code: 'crlf' })
    expect(validateHeader('X-Evil', 'v\rX-Steal: 1')).toEqual({ ok: false, code: 'crlf' })
  })

  it('rejects an empty value', () => {
    expect(validateHeader('X-Client', '')).toEqual({ ok: false, code: 'empty-value' })
  })
})

describe('mergeHeaderLayers', () => {
  it('applies provider over global over harness', () => {
    const merged = mergeHeaderLayers([
      harness,
      { source: 'global', headers: [{ name: 'X-Same', value: 'global' }] },
      { source: 'provider', headers: [{ name: 'X-Same', value: 'provider' }] },
    ])
    expect(merged).toHaveLength(2)
    expect(merged.find((h) => h.name === 'X-Same')?.value).toBe('provider')
    expect(merged.find((h) => h.name === 'X-Same')?.source).toBe('provider')
  })

  it('overrides case-insensitively and keeps exactly one spelling', () => {
    const merged = mergeHeaderLayers([
      { source: 'global', headers: [{ name: 'User-Agent', value: 'A' }] },
      { source: 'provider', headers: [{ name: 'user-agent', value: 'B' }] },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ name: 'user-agent', value: 'B', source: 'provider' })
  })

  it('keeps distinct names that differ beyond case', () => {
    const merged = mergeHeaderLayers([
      { source: 'global', headers: [{ name: 'X-A', value: '1' }] },
      { source: 'global', headers: [{ name: 'X-B', value: '2' }] },
    ])
    expect(merged.map((h) => h.name)).toEqual(['X-A', 'X-B'])
  })

  it('merges layers supplied in one call and preserves first-seen order', () => {
    const merged = mergeHeaderLayers([harness, global, provider])
    expect(merged.map((h) => h.name)).toEqual(['user-agent', 'X-Client', 'X-Provider'])
  })

  it('treats an empty header set as no contribution', () => {
    expect(mergeHeaderLayers([{ source: 'global', headers: [] }])).toEqual([])
  })

  it('skips blank names rather than emitting an invalid field', () => {
    const merged = mergeHeaderLayers([{ source: 'global', headers: [{ name: '  ', value: 'x' }] }])
    expect(merged).toEqual([])
  })
})

describe('effectiveHeaders', () => {
  it('marks Harness-reserved names and reports the winning source', () => {
    const effective = effectiveHeaders(
      [
        { source: 'harness', headers: [{ name: 'user-agent', value: 'deepseek-harness/1' }] },
        { source: 'provider', headers: [{ name: 'User-Agent', value: 'claude-cli/2.1.161' }] },
        global,
      ],
      ['user-agent'],
    )
    const ua = effective.find((h) => h.name.toLowerCase() === 'user-agent')
    expect(ua).toMatchObject({ source: 'provider', reserved: true, value: 'claude-cli/2.1.161' })
    expect(effective).toHaveLength(2)
  })

  it('does not mark unreserved names', () => {
    const effective = effectiveHeaders([global], ['user-agent'])
    expect(effective[0]?.reserved).toBe(false)
  })
})

describe('headerEntriesOf', () => {
  it('returns nothing for an absent record', () => {
    expect(headerEntriesOf(undefined)).toEqual([])
  })

  it('keeps last-wins for duplicate names within one layer, case-insensitively', () => {
    const entries = headerEntriesOf({ 'X-A': '1', 'x-a': '2' })
    expect(entries).toEqual([{ name: 'x-a', value: '2' }])
  })

  it('drops non-string values instead of stringifying objects', () => {
    expect(headerEntriesOf({ 'X-A': '1', 'X-B': 2, 'X-C': { a: 1 } })).toEqual([{ name: 'X-A', value: '1' }])
  })
})

describe('sensitivity and masking', () => {
  it('classifies credential-bearing names', () => {
    for (const name of ['Authorization', 'authorization', 'Proxy-Authorization', 'x-api-key', 'API-KEY', 'Cookie', 'X-Auth-Token', 'X-Secret', 'My-Token']) {
      expect(isSensitiveHeader(name), name).toBe(true)
    }
    for (const name of ['User-Agent', 'X-Client-Name', 'Accept', 'Content-Type']) {
      expect(isSensitiveHeader(name), name).toBe(false)
    }
  })

  it('masks a bearer token while keeping the scheme and a short tail', () => {
    expect(maskHeaderValue('Bearer sk-abcdef12345691ab')).toBe('Bearer ****91ab')
    expect(maskHeaderValue('sk-abcdef12345691ab')).toBe('****91ab')
    expect(maskHeaderValue('Bearer short')).toBe('Bearer ****')
    expect(maskHeaderValue('')).toBe('****')
  })

  it('masks only sensitive values for display', () => {
    expect(displayHeaderValue('Authorization', 'Bearer sk-abcdef12345691ab')).toBe('Bearer ****91ab')
    expect(displayHeaderValue('X-Client-Name', 'dsh')).toBe('dsh')
  })
})

describe('validateHeaderRecord', () => {
  it('reports every offending field and nothing else', () => {
    const problems = validateHeaderRecord({
      'X-Good': 'ok',
      'X Bad': 'ok',
      'X-CRLF': 'a\r\nb',
      'X-Empty': '',
    })
    expect(problems).toEqual([
      { name: 'X Bad', code: 'invalid-name' },
      { name: 'X-CRLF', code: 'crlf' },
      { name: 'X-Empty', code: 'empty-value' },
    ])
  })

  it('accepts an absent record', () => {
    expect(validateHeaderRecord(undefined)).toEqual([])
  })
})
