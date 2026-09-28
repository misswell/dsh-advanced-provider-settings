/**
 * Config preservation and minimal patch (spec sections 44-48, 70, 73).
 *
 * These are the release-gate tests for the promise "your YAML is not
 * rewritten": unknown fields, future compat keys and foreign sibling headers
 * must survive a save, and "Harness Default" must emit `unset` rather than the
 * current default value.
 */
import { describe, expect, it } from 'vitest'
import {
  applyOps,
  diffGlobalHeaders,
  diffManagedModelFields,
  diffManagedModelOverride,
  diffManagedModelOverrides,
  diffManagedProviderConfig,
  diffManagedProviderFields,
  diffStringRecord,
  jsonEqual,
  resetAllAdvanced,
  resetProviderFields,
  resetSections,
  setOrUnset,
} from '../src/shared/patch.js'
import type { ProviderProfile } from '../src/shared/types.js'

describe('jsonEqual', () => {
  it('ignores key order', () => {
    expect(jsonEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })

  it('distinguishes a missing key from an undefined-valued key', () => {
    expect(jsonEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
  })

  it('compares arrays element-wise', () => {
    expect(jsonEqual(['text', 'image'], ['text', 'image'])).toBe(true)
    expect(jsonEqual(['text', 'image'], ['image', 'text'])).toBe(false)
    expect(jsonEqual(['text'], ['text', 'image'])).toBe(false)
  })

  it('does not treat null as an object', () => {
    expect(jsonEqual(null, {})).toBe(false)
    expect(jsonEqual(null, null)).toBe(true)
  })
})

describe('setOrUnset', () => {
  it('emits nothing when the value is unchanged', () => {
    expect(setOrUnset(['a'], 5, 5)).toEqual([])
  })

  it('emits a set when a value appears', () => {
    expect(setOrUnset(['a', 'b'], undefined, 5)).toEqual([{ op: 'set', path: ['a', 'b'], value: 5 }])
  })

  it('emits an unset when a value disappears, so the field re-inherits', () => {
    expect(setOrUnset(['a'], 5, undefined)).toEqual([{ op: 'unset', path: ['a'] }])
  })

  it('emits nothing when both sides are absent', () => {
    expect(setOrUnset(['a'], undefined, undefined)).toEqual([])
  })

  it('does not mutate the supplied path array', () => {
    const path = ['a', 'b']
    setOrUnset(path, undefined, 1)
    expect(path).toEqual(['a', 'b'])
  })
})

describe('diffManagedProviderFields', () => {
  const before: ProviderProfile = {
    api: 'openai-completions',
    baseURL: 'https://example.test/v1',
    apiKeyEnv: 'EXAMPLE_API_KEY',
    displayName: 'Example',
    retryPolicy: { mode: 'normal', maxRetries: 5 },
    compat: { supportsDeveloperRole: false, futureFeature: true },
    unknownField: 'abc',
  }

  it('names only the field the user changed', () => {
    const after: ProviderProfile = { ...before, retryPolicy: { mode: 'normal', maxRetries: 10 } }
    const ops = diffManagedProviderFields('example', before, after)
    expect(ops).toEqual([
      {
        op: 'set',
        path: ['providers', 'example', 'retryPolicy'],
        value: { mode: 'normal', maxRetries: 10 },
      },
    ])
  })

  it('never names identity, endpoint or credential keys', () => {
    const after: ProviderProfile = { ...before, baseURL: 'https://other.test/v1' }
    const ops = diffManagedProviderFields('example', before, after)
    expect(ops).toEqual([])
    for (const op of ops) {
      for (const key of op.path) {
        expect(['id', 'name', 'api', 'baseURL', 'apiKeyEnv', 'displayName']).not.toContain(key)
      }
    }
  })

  it('emits unset when a managed field returns to Harness Default', () => {
    const after: ProviderProfile = { ...before }
    delete after.retryPolicy
    const ops = diffManagedProviderFields('example', before, after)
    expect(ops).toEqual([{ op: 'unset', path: ['providers', 'example', 'retryPolicy'] }])
  })

  it('preserves unknown fields because it never names them', () => {
    const after: ProviderProfile = { ...before, retryPolicy: { mode: 'normal', maxRetries: 10 } }
    const ops = diffManagedProviderFields('example', before, after)
    const patched = applyOps({ providers: { example: before } }, ops)
    const profile = (patched.providers as Record<string, ProviderProfile>)['example']!
    expect(profile.unknownField).toBe('abc')
    expect(profile.compat).toEqual({ supportsDeveloperRole: false, futureFeature: true })
    expect(profile.retryPolicy).toEqual({ mode: 'normal', maxRetries: 10 })
  })
})

describe('diffManagedModelFields', () => {
  it('addresses the model by index and the field by name', () => {
    const ops = diffManagedModelFields('example', 2, { id: 'm', input: ['text'] }, { id: 'm', input: ['text', 'image'] })
    expect(ops).toEqual([
      { op: 'set', path: ['providers', 'example', 'models', '2', 'input'], value: ['text', 'image'] },
    ])
  })

  it('emits unset for Inherit, removing the override', () => {
    const ops = diffManagedModelFields('example', 0, { id: 'm', input: ['text', 'image'] }, { id: 'm' })
    expect(ops).toEqual([{ op: 'unset', path: ['providers', 'example', 'models', '0', 'input'] }])
  })

  it('never writes model id, context window or max tokens', () => {
    const ops = diffManagedModelFields(
      'example',
      0,
      { id: 'a', contextWindow: 1000, maxTokens: 100 },
      { id: 'b', contextWindow: 2000, maxTokens: 200 },
    )
    expect(ops).toEqual([])
  })

  it('writes a per-model compat override and unsets it again on Inherit', () => {
    const set = diffManagedModelFields('example', 0, { id: 'm' }, { id: 'm', compat: { supportsStore: false } })
    expect(set).toEqual([
      { op: 'set', path: ['providers', 'example', 'models', '0', 'compat'], value: { supportsStore: false } },
    ])
    const unset = diffManagedModelFields(
      'example',
      0,
      { id: 'm', compat: { supportsStore: false } },
      { id: 'm' },
    )
    expect(unset).toEqual([{ op: 'unset', path: ['providers', 'example', 'models', '0', 'compat'] }])
  })

  it('carries per-model compat through the whole-config diff a save uses', () => {
    const before: ProviderProfile = { models: [{ id: 'm' }] }
    const after: ProviderProfile = { models: [{ id: 'm', compat: { thinkingFormat: 'deepseek' } }] }
    const patched = applyOps({ providers: { example: before } }, diffManagedProviderConfig('example', before, after))
    const profile = (patched.providers as Record<string, ProviderProfile>)['example']!
    expect(profile.models?.[0]?.compat).toEqual({ thinkingFormat: 'deepseek' })
  })
})

describe('resetProviderFields / resetAllAdvanced', () => {
  const profile: ProviderProfile = {
    api: 'openai-responses',
    baseURL: 'https://example.test/v1',
    apiKeyEnv: 'EXAMPLE_API_KEY',
    displayName: 'Example',
    headers: { 'X-A': '1' },
    reasoning: 'high',
    timeoutMs: 120_000,
    retryPolicy: { mode: 'always' },
    compat: { supportsStore: true },
    models: [
      { id: 'm1', name: 'm1', contextWindow: 100, maxTokens: 10, input: ['text', 'image'], reasoningEfforts: { low: 'low' }, compat: { supportsStore: false } },
      { id: 'm2', name: 'm2' },
    ],
    unknownTop: { nested: true },
  }

  it('resets only the named section', () => {
    const ops = resetProviderFields('example', profile, ['retryPolicy'])
    expect(ops).toEqual([{ op: 'unset', path: ['providers', 'example', 'retryPolicy'] }])
  })

  it('skips absent fields rather than emitting useless unsets', () => {
    const ops = resetProviderFields('example', profile, ['transport', 'cacheRetention'])
    expect(ops).toEqual([])
  })

  it('resets every managed key, provider and model, and nothing else', () => {
    const ops = resetAllAdvanced('example', profile)
    const paths = ops.map((op) => op.path.join('.'))
    expect(paths).toContain('providers.example.headers')
    expect(paths).toContain('providers.example.reasoning')
    expect(paths).toContain('providers.example.timeoutMs')
    expect(paths).toContain('providers.example.retryPolicy')
    expect(paths).toContain('providers.example.compat')
    expect(paths).toContain('providers.example.models.0.input')
    expect(paths).toContain('providers.example.models.0.reasoningEfforts')
    expect(paths).toContain('providers.example.models.0.compat')

    for (const path of paths) {
      expect(path).not.toContain('baseURL')
      expect(path).not.toContain('apiKeyEnv')
      expect(path).not.toContain('displayName')
      expect(path).not.toContain('contextWindow')
      expect(path).not.toContain('maxTokens')
      expect(path).not.toMatch(/models\.\d+\.id$/)
      expect(path).not.toMatch(/models\.\d+\.name$/)
    }
  })

  it('leaves unknown provider fields intact after a reset', () => {
    const patched = applyOps({ providers: { example: profile } }, resetAllAdvanced('example', profile))
    const result = (patched.providers as Record<string, ProviderProfile>)['example']!
    expect(result.unknownTop).toEqual({ nested: true })
    expect(result.baseURL).toBe('https://example.test/v1')
    expect(result.apiKeyEnv).toBe('EXAMPLE_API_KEY')
    expect(result.models?.[0]).toEqual({ id: 'm1', name: 'm1', contextWindow: 100, maxTokens: 10 })
    expect(result.headers).toBeUndefined()
    expect(result.retryPolicy).toBeUndefined()
  })
})

describe('the modelOverrides channel', () => {
  /** The shape Harness accepts: catalog ids only, no `id` key inside. */
  const before: ProviderProfile = {
    modelOverrides: {
      vision: { input: ['text'], maxTokens: 4096, unknownFuture: 'kept' },
    },
  }

  it('sets one field without naming its siblings', () => {
    const ops = diffManagedModelOverride(
      'example',
      'vision',
      before.modelOverrides?.['vision'],
      { ...before.modelOverrides?.['vision'], contextWindow: 200_000 },
    )
    expect(ops).toEqual([
      { op: 'set', path: ['providers', 'example', 'modelOverrides', 'vision', 'contextWindow'], value: 200_000 },
    ])
  })

  it('unsets a field cleared back to inherit, leaving the rest of the entry', () => {
    const ops = diffManagedModelOverride(
      'example',
      'vision',
      before.modelOverrides?.['vision'],
      { input: ['text'], maxTokens: 4096, unknownFuture: 'kept' },
    )
    expect(ops).toEqual([])
  })

  it('removes the whole entry once the last field goes, rather than leaving {}', () => {
    // An empty entry would read as "overridden" in the picker while changing
    // nothing, so the key itself has to go.
    const ops = diffManagedModelOverride('example', 'vision', { maxTokens: 4096 }, undefined)
    expect(ops).toEqual([
      { op: 'unset', path: ['providers', 'example', 'modelOverrides', 'vision', 'maxTokens'] },
      { op: 'unset', path: ['providers', 'example', 'modelOverrides', 'vision'] },
    ])
  })

  it('never names a model that neither side has', () => {
    // An untouched picker row must not write anything, or merely visiting a
    // route would litter its YAML with unset paths.
    expect(diffManagedModelOverride('example', 'fresh', undefined, undefined)).toEqual([])
  })

  it('drops the mapping itself when the last model override is cleared', () => {
    const ops = diffManagedModelOverrides('example', before.modelOverrides, undefined)
    expect(ops).toContainEqual({ op: 'unset', path: ['providers', 'example', 'modelOverrides'] })
  })

  it('keeps a foreign field inside an entry the user edited', () => {
    const patched = applyOps(
      { providers: { example: before } },
      diffManagedModelOverrides('example', before.modelOverrides, {
        vision: { input: ['text'], maxTokens: 8192, unknownFuture: 'kept' },
      }),
    )
    const profile = (patched.providers as Record<string, ProviderProfile>)['example']!
    expect(profile.modelOverrides?.['vision']).toEqual({
      input: ['text'],
      maxTokens: 8192,
      unknownFuture: 'kept',
    })
  })

  it('is diffed on the override channel by diffManagedProviderConfig too', () => {
    const after: ProviderProfile = {
      modelOverrides: { vision: { input: ['text'], maxTokens: 8192, unknownFuture: 'kept' } },
    }
    const ops = diffManagedProviderConfig('example', before, after)
    expect(ops).toEqual([
      { op: 'set', path: ['providers', 'example', 'modelOverrides', 'vision', 'maxTokens'], value: 8192 },
    ])
  })
})

describe('resetSections', () => {
  const profile: ProviderProfile = {
    timeoutMs: 120_000,
    streamIdleTimeoutMs: 30_000,
    websocketConnectTimeoutMs: 10_000,
    retryPolicy: { mode: 'always' },
    models: [
      { id: 'm1', name: 'm1', contextWindow: 100, maxTokens: 10, input: ['text'], reasoningEfforts: { low: 'low' } },
    ],
    modelOverrides: { vision: { maxTokens: 4096 } },
  }

  it('clears a section whose id is not a field name, field by field', () => {
    // `timeout` is the UI's word for three provider keys; treating the id as a
    // key would unset a non-existent `timeout` and leave all three behind.
    const ops = resetSections('example', profile, ['timeout'])
    expect(ops).toEqual([
      { op: 'unset', path: ['providers', 'example', 'timeoutMs'] },
      { op: 'unset', path: ['providers', 'example', 'streamIdleTimeoutMs'] },
      { op: 'unset', path: ['providers', 'example', 'websocketConnectTimeoutMs'] },
    ])
  })

  it('clears both per-model channels of the models section and never the list itself', () => {
    const ops = resetSections('example', profile, ['models'])
    const paths = ops.map((op) => op.path.join('.'))
    expect(paths).toContain('providers.example.models.0.input')
    expect(paths).toContain('providers.example.models.0.reasoningEfforts')
    expect(paths).toContain('providers.example.modelOverrides.vision.maxTokens')
    expect(paths).toContain('providers.example.modelOverrides.vision')
    expect(paths).toContain('providers.example.modelOverrides')
    // The list and everything the Models page owns must survive.
    expect(paths).not.toContain('providers.example.models')
    expect(paths.join('\n')).not.toMatch(/models\.0\.(id|name|contextWindow|maxTokens)$/)
  })

  it('touches nothing outside the named sections', () => {
    const patched = applyOps({ providers: { example: profile } }, resetSections('example', profile, ['models']))
    const result = (patched.providers as Record<string, ProviderProfile>)['example']!
    expect(result.timeoutMs).toBe(120_000)
    expect(result.retryPolicy).toEqual({ mode: 'always' })
    expect(result.models).toEqual([{ id: 'm1', name: 'm1', contextWindow: 100, maxTokens: 10 }])
    expect(result.modelOverrides).toBeUndefined()
  })

  it('clears model overrides under Reset All without naming a listed model window', () => {
    const ops = resetAllAdvanced('example', profile)
    const paths = ops.map((op) => op.path.join('.'))
    expect(paths).toContain('providers.example.modelOverrides.vision')
    for (const path of paths) {
      if (!path.startsWith('providers.example.models.')) continue
      expect(path).not.toMatch(/contextWindow|maxTokens/)
    }
  })
})

describe('diffStringRecord', () => {
  it('emits a set for a new key and an unset for a removed one', () => {
    const ops = diffStringRecord(['globalHeaders'], { 'X-Old': 'a' }, { 'X-New': 'b' })
    expect(ops).toEqual([
      { op: 'unset', path: ['globalHeaders', 'X-Old'] },
      { op: 'set', path: ['globalHeaders', 'X-New'], value: 'b' },
    ])
  })

  it('leaves untouched keys unnamed, so a foreign sibling survives', () => {
    const ops = diffStringRecord(['globalHeaders'], { 'X-Mine': '1', 'X-Theirs': '2' }, { 'X-Mine': '9', 'X-Theirs': '2' })
    expect(ops).toEqual([{ op: 'set', path: ['globalHeaders', 'X-Mine'], value: '9' }])
  })

  it('renames a header case-insensitively without leaving a stale sibling', () => {
    const ops = diffStringRecord(['globalHeaders'], { 'X-A': '1' }, { 'x-a': '1' })
    // Case is a real key change, and both operations are emitted so the mapping
    // converges on exactly one spelling.
    expect(ops).toEqual([
      { op: 'unset', path: ['globalHeaders', 'X-A'] },
      { op: 'set', path: ['globalHeaders', 'x-a'], value: '1' },
    ])
  })

  it('is a no-op when nothing changed', () => {
    expect(diffStringRecord(['globalHeaders'], { 'X-A': '1' }, { 'X-A': '1' })).toEqual([])
  })

  it('treats an absent mapping as empty', () => {
    expect(diffStringRecord(['globalHeaders'], undefined, { 'X-A': '1' })).toEqual([
      { op: 'set', path: ['globalHeaders', 'X-A'], value: '1' },
    ])
  })
})

describe('diffGlobalHeaders', () => {
  it('is a thin wrapper over the record diff on the plugin namespace', () => {
    expect(diffGlobalHeaders({ 'X-A': '1' }, { 'X-A': '2' })).toEqual([
      { op: 'set', path: ['globalHeaders', 'X-A'], value: '2' },
    ])
  })
})

describe('end-to-end YAML roundtrip semantics (section 73)', () => {
  const original: ProviderProfile = {
    displayName: 'Gateway',
    api: 'openai-completions',
    baseURL: 'https://gw.test/v1',
    apiKeyEnv: 'GW_API_KEY',
    models: [
      { id: 'a', name: 'A', contextWindow: 128_000, maxTokens: 4096 },
      { id: 'b', name: 'B', input: ['text'], reasoningEfforts: { low: 'low' } },
    ],
    compat: { supportsDeveloperRole: false, futureFeature: true },
    headers: { 'X-Keep': 'yes' },
    unknownFuture: { deep: [{ x: 1 }] },
  }

  it('changes only retryPolicy and leaves every other semantic value identical', () => {
    const after: ProviderProfile = { ...original, retryPolicy: { mode: 'normal', maxRetries: 10 } }
    const ops = diffManagedProviderFields('gw', original, after)
    const patched = applyOps({ providers: { gw: original } }, ops)
    const result = (patched.providers as Record<string, ProviderProfile>)['gw']!

    const { retryPolicy, ...restOriginal } = original
    const { retryPolicy: afterRetry, ...restResult } = result
    expect(retryPolicy).toBeUndefined()
    expect(afterRetry).toEqual({ mode: 'normal', maxRetries: 10 })
    expect(jsonEqual(restResult, restOriginal)).toBe(true)
    expect(result.unknownFuture).toEqual({ deep: [{ x: 1 }] })
    expect(result.compat).toEqual({ supportsDeveloperRole: false, futureFeature: true })
  })

  it('round-trips a model input edit without disturbing other models', () => {
    const after: ProviderProfile = {
      ...original,
      models: [
        { ...original.models![0]! },
        { ...original.models![1]!, input: ['text', 'image'] },
      ],
    }
    const ops = diffManagedModelFields('gw', 1, original.models![1], after.models![1]!)
    const patched = applyOps({ providers: { gw: original } }, ops)
    const result = (patched.providers as Record<string, ProviderProfile>)['gw']!
    expect(result.models?.[0]).toEqual(original.models![0])
    expect(result.models?.[1]).toEqual({
      id: 'b',
      name: 'B',
      input: ['text', 'image'],
      reasoningEfforts: { low: 'low' },
    })
  })
})
