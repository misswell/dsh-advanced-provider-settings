import type { CatalogListing, CatalogModel } from './catalog.js';
import type { ProviderProfile } from './types.js';
/** One selectable model, whichever channel supplies it. */
export interface ModelPickerRow {
    /** Stable key: the list index or the model id. */
    key: string;
    /** Model id, or a placeholder for a listed entry that somehow has none. */
    id: string;
    /** Position in `models`, or -1 on the override channel. */
    index: number;
    /** Name the ROUTE declares for this model, when the catalog reports one. */
    catalogName: string | undefined;
    /** Modalities in force for this model, for the picker's image mark. */
    declaredInput: readonly string[] | undefined;
    /** Override channel only: what the CATALOG declares, for the inherit hint. */
    catalogInput: readonly string[] | undefined;
    /** How many fields this row's entry already sets. */
    overrides: number;
    /** Override channel only: whether the catalog describes this id. */
    inCatalog: boolean;
}
/** Whether this profile edits listed entries rather than catalog overrides. */
export declare function usesModelList(profile: ProviderProfile): boolean;
/**
 * Build the picker's rows.
 *
 * @param profile - the profile as read (or as drafted).
 * @param catalogModels - models the route serves, empty until the listing answers.
 * @returns the rows, catalog order first, then any override the catalog lost.
 */
export declare function buildModelPickerRows(profile: ProviderProfile, catalogModels: readonly CatalogModel[]): ModelPickerRow[];
/**
 * Narrow rows to a substring of the id or the catalog name.
 * @param rows - every row.
 * @param filter - what the user typed; blank keeps everything.
 * @returns the matching rows.
 */
export declare function filterModelRows(rows: readonly ModelPickerRow[], filter: string): ModelPickerRow[];
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
export declare function currentOverrideRow(rows: readonly ModelPickerRow[], selectedId: string | undefined): ModelPickerRow | undefined;
/** Why a catalog listing is unusable, in the terms the copy is written for. */
export interface CatalogFailure {
    code: string;
    detail?: string;
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
export declare function catalogFailureOf(state: {
    data: CatalogListing | undefined;
    error: string | undefined;
}): CatalogFailure | undefined;
