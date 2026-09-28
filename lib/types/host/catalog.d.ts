/**
 * Catalog listing: the model ids one route serves right now.
 *
 * The per-model channel on a catalog route is keyed by model id
 * (`modelOverrides.<id>`), and Harness refuses an id the installed catalog does
 * not describe. So the browser half cannot render that editor at all without
 * first asking the host which ids exist — and the answer is host-only state:
 * the installed pi-ai catalog merged with every configuration layer, reachable
 * as `llm.listModels(provider)`.
 *
 * This is a read, on the same terms as the discovery probe: nothing here writes
 * settings or reads a credential. The reply is sanitized and capped before it
 * crosses to the page, because a catalog entry's name is provider-authored text
 * and the page is a rendering surface for it.
 */
import type { CatalogListing } from '../shared/catalog.js';
/**
 * The slice of one model metadata row this module reads, typed loosely on
 * purpose: the values are re-validated below rather than trusted, so a future
 * DSH build that widens the row cannot widen what reaches the page.
 */
export interface LlmModelInfoLike {
    id?: unknown;
    name?: unknown;
    inputModalities?: unknown;
}
/** Hard cap on models returned, so a runaway catalog cannot flood the page. */
export declare const MAX_CATALOG_MODELS = 500;
/**
 * List the models one route currently serves.
 *
 * @param llm - the host's llm service slice.
 * @param providerId - route id to inspect.
 * @returns the sanitized catalog, never a rejection — the caller renders failures.
 */
export declare function listCatalogModels(llm: {
    listModels?: (provider: string) => Promise<readonly LlmModelInfoLike[]>;
}, providerId: string): Promise<CatalogListing>;
