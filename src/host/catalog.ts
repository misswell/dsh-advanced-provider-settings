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
import type { CatalogListing, CatalogModel } from '../shared/catalog.js'

/**
 * The slice of one model metadata row this module reads, typed loosely on
 * purpose: the values are re-validated below rather than trusted, so a future
 * DSH build that widens the row cannot widen what reaches the page.
 */
export interface LlmModelInfoLike {
  id?: unknown
  name?: unknown
  inputModalities?: unknown
}

/** Hard cap on models returned, so a runaway catalog cannot flood the page. */
export const MAX_CATALOG_MODELS = 500

/** Cap on any single model id or name that crosses to the page. */
const MAX_TEXT_CHARS = 200

/**
 * List the models one route currently serves.
 *
 * @param llm - the host's llm service slice.
 * @param providerId - route id to inspect.
 * @returns the sanitized catalog, never a rejection — the caller renders failures.
 */
export async function listCatalogModels(
  llm: { listModels?: (provider: string) => Promise<readonly LlmModelInfoLike[]> },
  providerId: string,
): Promise<CatalogListing> {
  if (providerId.length === 0) return { models: [], errorCode: 'no-provider' }
  if (typeof llm.listModels !== 'function') return { models: [], errorCode: 'service-unavailable' }

  try {
    const listed = await llm.listModels(providerId)
    const models = sanitizeCatalog(listed)
    if (models.length === 0) {
      // An empty answer is not an error by itself, but on this surface it has
      // one cause worth naming: a route with no adapter registered serves no
      // catalog, so no model id can be overridden.
      return { models, errorCode: 'route-unresolved' }
    }
    return { models }
  } catch (error) {
    return { models: [], errorCode: 'listing-failed', ...failureText(error) }
  }
}

/**
 * Keep only the shape the page understands, and cap what it can be made to
 * render.
 * @param listed - whatever the adapter returned.
 * @returns sanitized entries with unique, non-empty ids.
 */
function sanitizeCatalog(listed: readonly LlmModelInfoLike[] | undefined): CatalogModel[] {
  if (!Array.isArray(listed)) return []
  const models: CatalogModel[] = []
  const seen = new Set<string>()
  for (const entry of listed) {
    if (models.length >= MAX_CATALOG_MODELS) break
    const id = shortText(entry?.id)
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    const name = shortText(entry?.name)
    const input = Array.isArray(entry?.inputModalities)
      ? entry.inputModalities
        .filter((modality: unknown): modality is string => typeof modality === 'string')
        .slice(0, 8)
      : undefined
    models.push({
      id,
      ...(name === undefined ? {} : { name }),
      ...(input === undefined ? {} : { input }),
    })
  }
  return models
}

/** A trimmed, length-capped string, or undefined when there is none. */
function shortText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  return trimmed.length <= MAX_TEXT_CHARS ? trimmed : trimmed.slice(0, MAX_TEXT_CHARS)
}

/** Sanitized failure facts from a thrown value. */
function failureText(error: unknown): { detail?: string } {
  if (error === null || typeof error !== 'object') return {}
  const message = (error as { message?: unknown }).message
  if (typeof message !== 'string' || message.length === 0) return {}
  return { detail: message.replace(/[\r\n]+/g, ' ').slice(0, 240) }
}
