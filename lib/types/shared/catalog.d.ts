/**
 * Wire types for the `catalog-models` RPC.
 *
 * They live in `shared` rather than in the host module that produces them
 * because the browser half consumes the same shape, and the client bundle may
 * not import host code. Nothing here reads settings: the listing is the models
 * one route currently serves, which is what the per-model editor needs to key
 * `modelOverrides` by id at all.
 */
/** One model the route currently serves, as the page needs it. */
export interface CatalogModel {
    /** Model id, used verbatim as the `modelOverrides` dict key. */
    id: string;
    /** Display name, when the catalog gives one. */
    name?: string;
    /** Modalities the route declares for this model, when it declares any. */
    input?: string[];
}
/** Why a catalog listing came back empty. */
export type CatalogErrorCode = 
/** No provider id was supplied. */
'no-provider'
/** The running llm service has no catalog listing at all. */
 | 'service-unavailable'
/** The route is not registered with an adapter, so it serves no catalog. */
 | 'route-unresolved'
/** The adapter refused or failed while listing. */
 | 'listing-failed';
/** Outcome of one catalog listing. */
export interface CatalogListing {
    models: CatalogModel[];
    /** Set when the listing could not answer; `models` is then empty. */
    errorCode?: CatalogErrorCode;
    /** Short sanitized failure text, for diagnostics only. */
    detail?: string;
}
