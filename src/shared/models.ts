/**
 * The per-model picker's projection: which models exist, on which channel, and
 * what is already set on each.
 *
 * Pure on purpose. The component that renders the picker needs an async catalog
 * listing and a settings snapshot to exist at all, which makes "does an
 * override the catalog no longer describes still show up" a question that is
 * expensive to ask through a render and free to ask here.
 *
 * Two channels exist, and the profile decides which one is in play:
 *
 *  - a non-empty `models` list REPLACES the served catalog — entries are
 *    addressed by index, and `modelOverrides` beside them is refused;
 *  - otherwise the route serves the installed catalog, and the only per-model
 *    channel is `modelOverrides.<modelId>`, keyed by an id the catalog must
 *    describe.
 */
import { MANAGED_MODEL_KEYS } from './capabilities.js'
import type { CatalogListing, CatalogModel } from './catalog.js'
import { overrideEntryCount } from './summary.js'
import type { ProviderProfile } from './types.js'

/** One selectable model, whichever channel supplies it. */
export interface ModelPickerRow {
  /** Stable key: the list index or the model id. */
  key: string
  /** Model id, or a placeholder for a listed entry that somehow has none. */
  id: string
  /** Position in `models`, or -1 on the override channel. */
  index: number
  /** Name the ROUTE declares for this model, when the catalog reports one. */
  catalogName: string | undefined
  /** Modalities in force for this model, for the picker's image mark. */
  declaredInput: readonly string[] | undefined
  /** Override channel only: what the CATALOG declares, for the inherit hint. */
  catalogInput: readonly string[] | undefined
  /** How many fields this row's entry already sets. */
  overrides: number
  /** Override channel only: whether the catalog describes this id. */
  inCatalog: boolean
}

/** Whether this profile edits listed entries rather than catalog overrides. */
export function usesModelList(profile: ProviderProfile): boolean {
  return Array.isArray(profile.models) && profile.models.length > 0
}

/**
 * Build the picker's rows.
 *
 * @param profile - the profile as read (or as drafted).
 * @param catalogModels - models the route serves, empty until the listing answers.
 * @returns the rows, catalog order first, then any override the catalog lost.
 */
export function buildModelPickerRows(
  profile: ProviderProfile,
  catalogModels: readonly CatalogModel[],
): ModelPickerRow[] {
  const listed = Array.isArray(profile.models) ? profile.models : []
  if (listed.length > 0) {
    return listed.map((model, index) => ({
      key: `models.${String(index)}`,
      id: model.id ?? `#${String(index)}`,
      index,
      catalogName: model.name,
      declaredInput: model.input,
      catalogInput: undefined,
      overrides: MANAGED_MODEL_KEYS.filter((field) => model[field] !== undefined).length,
      inCatalog: true,
    }))
  }

  const overrides = profile.modelOverrides ?? {}
  const rows: ModelPickerRow[] = []
  const seen = new Set<string>()
  for (const model of catalogModels) {
    seen.add(model.id)
    rows.push({
      key: `override.${model.id}`,
      id: model.id,
      index: -1,
      catalogName: model.name,
      declaredInput: overrides[model.id]?.input ?? model.input,
      catalogInput: model.input,
      overrides: overrideEntryCount(overrides[model.id]),
      inCatalog: true,
    })
  }
  // An override whose id the catalog no longer describes is still stored
  // configuration: Harness will refuse to validate it, and the user needs
  // somewhere to see and clear it rather than a silently shortened list.
  for (const [id, entry] of Object.entries(overrides)) {
    if (seen.has(id)) continue
    rows.push({
      key: `override.${id}`,
      id,
      index: -1,
      catalogName: undefined,
      declaredInput: entry?.input,
      catalogInput: undefined,
      overrides: overrideEntryCount(entry),
      inCatalog: false,
    })
  }
  return rows
}

/**
 * Narrow rows to a substring of the id or the catalog name.
 * @param rows - every row.
 * @param filter - what the user typed; blank keeps everything.
 * @returns the matching rows.
 */
export function filterModelRows(
  rows: readonly ModelPickerRow[],
  filter: string,
): ModelPickerRow[] {
  const needle = filter.trim().toLowerCase()
  if (needle.length === 0) return [...rows]
  return rows.filter((row) =>
    row.id.toLowerCase().includes(needle)
    || (row.catalogName ?? '').toLowerCase().includes(needle))
}

/**
 * Which override row the editor should show.
 *
 * The listing is asynchronous, so the first frame may hold nothing but the
 * models the user already configured. Falling back to the first row would then
 * swap the editor out from under them the moment the catalog arrived, so a row
 * that carries configuration wins over catalog order.
 *
 * @param rows - every override row.
 * @param selectedId - the id the user clicked, if any.
 * @returns the row to edit, or undefined when there are none.
 */
export function currentOverrideRow(
  rows: readonly ModelPickerRow[],
  selectedId: string | undefined,
): ModelPickerRow | undefined {
  return rows.find((row) => row.id === selectedId)
    ?? rows.find((row) => row.overrides > 0)
    ?? rows[0]
}

/** Why a catalog listing is unusable, in the terms the copy is written for. */
export interface CatalogFailure {
  code: string
  detail?: string
}

/**
 * Why the listing came back with nothing, if it did.
 *
 * Two layers can fail: the host op answers with a code, or the route itself is
 * unreachable and the transport degrades to "no data". Both mean the same thing
 * to the user here, so both are named rather than one silently showing an empty
 * picker.
 *
 * @param state - the query state as the card holds it.
 * @returns the failure, or undefined when the listing answered.
 */
export function catalogFailureOf(state: {
  data: CatalogListing | undefined
  error: string | undefined
}): CatalogFailure | undefined {
  if (state.data?.errorCode !== undefined) {
    return state.data.detail === undefined
      ? { code: state.data.errorCode }
      : { code: state.data.errorCode, detail: state.data.detail }
  }
  if (state.error !== undefined) return { code: 'service-unavailable' }
  return undefined
}
