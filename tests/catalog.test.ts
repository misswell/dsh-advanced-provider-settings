/**
 * The per-model channel's two halves: the host listing that supplies model ids,
 * and the projection that turns a profile plus that listing into a picker.
 *
 * The rule under test is the granularity boundary of this DSH build: a route
 * with a `models` list is edited in place, a route without one is edited through
 * `modelOverrides.<modelId>`, and an id the catalog does not describe is refused
 * by Harness — so the UI has to know about it before the user meets the write
 * rejection.
 */
import { describe, expect, it } from 'vitest'
import { listCatalogModels, MAX_CATALOG_MODELS } from '../src/host/catalog.js'
import {
  buildModelPickerRows,
  catalogFailureOf,
  currentOverrideRow,
  filterModelRows,
  usesModelList,
} from '../src/shared/models.js'
import type { CatalogListing } from '../src/shared/catalog.js'
import type { ProviderProfile } from '../src/shared/types.js'

describe('listCatalogModels', () => {
  it('returns the ids, names and modalities a route serves', async () => {
    const listing = await listCatalogModels({
      listModels: async () => [
        { id: 'fast', name: 'Fast', inputModalities: ['text'] },
        { id: 'vision', name: 'Vision', inputModalities: ['text', 'image'] },
      ],
    }, 'gateway')

    expect(listing).toEqual({
      models: [
        { id: 'fast', name: 'Fast', input: ['text'] },
        { id: 'vision', name: 'Vision', input: ['text', 'image'] },
      ],
    })
  })

  it('answers service-unavailable rather than throwing when the host cannot list', async () => {
    expect(await listCatalogModels({}, 'gateway')).toEqual({ models: [], errorCode: 'service-unavailable' })
  })

  it('names a route that serves no catalog as the reason the list is empty', async () => {
    // An unregistered route is the common case: the adapter is not mounted, so
    // `listModels` throws rather than answering with an empty list.
    const listing = await listCatalogModels({
      listModels: async () => { throw new Error('llm: no adapter for provider "gateway"') },
    }, 'gateway')
    expect(listing.models).toEqual([])
    expect(listing.errorCode).toBe('listing-failed')
    expect(listing.detail).toContain('no adapter')
  })

  it('refuses an empty provider id', async () => {
    expect(await listCatalogModels({ listModels: async () => [] }, '')).toEqual({ models: [], errorCode: 'no-provider' })
  })

  it('treats an empty answer as a route with no catalog', async () => {
    expect(await listCatalogModels({ listModels: async () => [] }, 'gateway')).toEqual({
      models: [],
      errorCode: 'route-unresolved',
    })
  })

  it('sanitizes provider-authored rows before they reach the page', async () => {
    const listing = await listCatalogModels({
      listModels: async () => [
        { id: '  padded  ', name: 'x'.repeat(400), inputModalities: ['text', 7, 'image'] },
        { id: 'padded' },
        { id: '' },
        { id: 'padded' },
        { id: 'no-modalities' },
      ],
    }, 'gateway')

    expect(listing.models.map((model) => model.id)).toEqual(['padded', 'no-modalities'])
    expect(listing.models[0]!.name!.length).toBe(200)
    // A non-string modality is dropped rather than rendered.
    expect(listing.models[0]!.input).toEqual(['text', 'image'])
  })

  it('caps how many models one listing can hand the page', async () => {
    const many = Array.from({ length: MAX_CATALOG_MODELS + 25 }, (_, index) => ({ id: `m${String(index)}` }))
    const listing = await listCatalogModels({ listModels: async () => many }, 'gateway')
    expect(listing.models.length).toBe(MAX_CATALOG_MODELS)
  })
})

describe('buildModelPickerRows', () => {
  const listed: ProviderProfile = {
    models: [
      { id: 'fast' },
      { id: 'vision', input: ['text', 'image'] },
      { id: 'tuned', reasoningEfforts: { low: 'low' }, compat: { supportsStore: true } },
    ],
  }

  it('addresses a listed profile by index and ignores the catalog entirely', () => {
    expect(usesModelList(listed)).toBe(true)
    const rows = buildModelPickerRows(listed, [{ id: 'catalog-only' }])
    expect(rows.map((row) => [row.id, row.index, row.overrides])).toEqual([
      ['fast', 0, 0],
      ['vision', 1, 1],
      ['tuned', 2, 2],
    ])
    expect(rows.every((row) => row.inCatalog)).toBe(true)
  })

  it('treats an EMPTY models list as a catalog route', () => {
    // Harness reads `configured.length > 0`, so `models: []` still serves the
    // installed catalog and still accepts overrides.
    expect(usesModelList({ models: [] })).toBe(false)
    const rows = buildModelPickerRows({ models: [] }, [{ id: 'catalog-model' }])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.inCatalog).toBe(true)
  })

  it('keys catalog rows by model id and counts their overrides', () => {
    const profile: ProviderProfile = {
      modelOverrides: { vision: { input: ['text', 'image'], maxTokens: 4096 } },
    }
    const rows = buildModelPickerRows(profile, [
      { id: 'fast', name: 'Fast', input: ['text'] },
      { id: 'vision', name: 'Vision', input: ['text'] },
    ])

    expect(rows.map((row) => row.key)).toEqual(['override.fast', 'override.vision'])
    expect(rows[0]).toMatchObject({ index: -1, inCatalog: true, overrides: 0, catalogName: 'Fast' })
    // The override wins over the catalog for the mark, and the catalog value is
    // kept separately so the row can say what it is overriding.
    expect(rows[1]).toMatchObject({ overrides: 2, declaredInput: ['text', 'image'], catalogInput: ['text'] })
  })

  it('keeps an override the catalog no longer describes, and marks it', () => {
    const rows = buildModelPickerRows(
      { modelOverrides: { vanished: { maxTokens: 1 } } },
      [{ id: 'present' }],
    )
    expect(rows.map((row) => [row.id, row.inCatalog])).toEqual([
      ['present', true],
      ['vanished', false],
    ])
  })

  it('shows nothing for a route with no catalog and no overrides', () => {
    expect(buildModelPickerRows({}, [])).toEqual([])
  })
})

describe('filterModelRows', () => {
  const rows = buildModelPickerRows({ modelOverrides: { 'lost-model': { name: 'Lost' } } }, [
    { id: 'opencode.ai/deepseek-v4.1-flash', name: 'DeepSeek Flash' },
  ])

  it('matches a dotted id and a display name', () => {
    expect(filterModelRows(rows, 'v4.1').map((row) => row.id)).toEqual(['opencode.ai/deepseek-v4.1-flash'])
    expect(filterModelRows(rows, 'flash').map((row) => row.id)).toEqual(['opencode.ai/deepseek-v4.1-flash'])
    expect(filterModelRows(rows, 'LOST').map((row) => row.id)).toEqual(['lost-model'])
  })

  it('returns every row for a blank filter', () => {
    expect(filterModelRows(rows, '  ')).toHaveLength(2)
  })
})

describe('currentOverrideRow', () => {
  const rows = buildModelPickerRows({ modelOverrides: { 'catalog-model': { maxTokens: 4096 } } }, [
    { id: 'a' },
    { id: 'catalog-model' },
    { id: 'b' },
  ])

  it('honours the clicked id', () => {
    expect(currentOverrideRow(rows, 'b')?.id).toBe('b')
  })

  it('opens on a configured model rather than catalog order', () => {
    // The listing arrives after the first frame; picking row 0 would swap the
    // editor away from the override the user opened the card to see.
    expect(currentOverrideRow(rows, undefined)?.id).toBe('catalog-model')
  })

  it('falls back to the first row when nothing is configured', () => {
    expect(currentOverrideRow(buildModelPickerRows({}, [{ id: 'a' }, { id: 'b' }]), undefined)?.id).toBe('a')
  })

  it('answers nothing for an empty list', () => {
    expect(currentOverrideRow([], 'anything')).toBeUndefined()
  })
})

describe('catalogFailureOf', () => {
  it('passes a host code through with its detail', () => {
    const state = { data: { models: [], errorCode: 'listing-failed', detail: 'boom' } as CatalogListing, error: undefined }
    expect(catalogFailureOf(state)).toEqual({ code: 'listing-failed', detail: 'boom' })
  })

  it('names an unreachable route as service-unavailable', () => {
    expect(catalogFailureOf({ data: undefined, error: 'unavailable' })).toEqual({ code: 'service-unavailable' })
  })

  it('reports nothing when the listing answered', () => {
    expect(catalogFailureOf({ data: { models: [{ id: 'a' }] }, error: undefined })).toBeUndefined()
  })
})
