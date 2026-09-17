/**
 * Test Provider / Discover Models (spec sections 16, 43, 72).
 *
 * Discovery is the one probe that answers "do these headers actually work?"
 * without spending a completion, so it must run with the headers currently in
 * the FORM — including ones the user has not saved yet. A User-Agent whitelist,
 * an `x-opencode-session` gate, or an enterprise gateway that rejects unknown
 * clients are all cases where the draft header is the entire point.
 *
 * The headers reach the request through the same request-scoped bridge the
 * stream path uses; `LlmModelDiscoveryRequest` has no `headers` field, so the
 * bridge is the only route that exists.
 */
import { PROVIDER_NAMESPACE } from '../shared/capabilities.js'
import type { HeaderEntry } from '../shared/headers.js'
import { mergeHeaderLayers } from '../shared/headers.js'
import type { RequestHeaderContext } from './header-runtime.js'

/** The discovery request Harness accepts. */
export interface DiscoveryRequestShape {
  provider?: string
  baseURL?: string
  api?: string
  apiKey?: string
}

/** A discovered model, as the endpoint advertised it. */
export interface DiscoveredModel {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
}

/** What the Test Provider action reports. */
export interface DiscoveryOutcome {
  ok: boolean
  modelCount: number
  elapsedMs: number
  /** HTTP status when the failure carried one. */
  status?: number
  /** Harness error code, e.g. `DISCOVERY_FAILED`. */
  errorCode?: string
  /** Short, sanitized explanation safe to render. Never contains a header value. */
  message?: string
}

/** Body cap for a provider error message. */
const MAX_MESSAGE_CHARS = 240

/** The slice of `ctx.llm` this module needs. */
export interface LlmDiscoveryService {
  discoverModels: (settingsNs: string, request: DiscoveryRequestShape, signal?: AbortSignal) => Promise<DiscoveredModel[]>
}

/**
 * Merge the header layers a discovery attempt should carry, with the draft
 * provider headers winning over global ones — the same precedence the stream
 * path has, so the test predicts production.
 * @param globalHeaders - the stored global headers.
 * @param draftHeaders - the provider headers currently in the form.
 * @returns the headers to put in scope.
 */
export function discoveryHeaders(
  globalHeaders: readonly HeaderEntry[],
  draftHeaders: readonly HeaderEntry[],
): HeaderEntry[] {
  return mergeHeaderLayers([
    { source: 'global', headers: globalHeaders },
    { source: 'provider', headers: draftHeaders },
  ]).map((header) => ({ name: header.name, value: header.value }))
}

/**
 * Interrogate a provider endpoint with an explicit header set.
 *
 * @param options - the llm service, the header bridge, and the request.
 * @returns the outcome, never a rejection — the caller renders failures.
 */
export async function runDiscovery(options: {
  llm: LlmDiscoveryService
  run: <T>(context: RequestHeaderContext, body: () => T) => T
  providerId: string
  request: DiscoveryRequestShape
  headers: readonly HeaderEntry[]
  timeoutMs?: number
}): Promise<DiscoveryOutcome> {
  const context: RequestHeaderContext = {
    provider: options.providerId,
    model: '',
    headers: options.headers,
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 20_000
  const timer = setTimeout(() => { controller.abort() }, timeoutMs)
  const startedAt = Date.now()

  try {
    const models = await options.run(context, () =>
      options.llm.discoverModels(PROVIDER_NAMESPACE, options.request, controller.signal),
    )
    return {
      ok: true,
      modelCount: Array.isArray(models) ? models.length : 0,
      elapsedMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      modelCount: 0,
      elapsedMs: Date.now() - startedAt,
      ...failureFacts(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Extract machine-readable failure facts from a Harness error.
 *
 * Only the code, the numeric status and a length-capped message cross this
 * boundary. A provider's error body could echo a request header, so the text is
 * truncated and the caller is expected to treat it as untrusted display data.
 * @param error - whatever was thrown.
 * @returns facts safe to send to the browser.
 */
export function failureFacts(error: unknown): Pick<DiscoveryOutcome, 'status' | 'errorCode' | 'message'> {
  if (error === null || typeof error !== 'object') {
    return { message: 'provider request failed' }
  }
  const record = error as { code?: unknown; status?: unknown; message?: unknown }
  const facts: Pick<DiscoveryOutcome, 'status' | 'errorCode' | 'message'> = {}
  if (typeof record.code === 'string' && record.code.length > 0) facts.errorCode = record.code.slice(0, 64)
  if (typeof record.status === 'number' && Number.isFinite(record.status)) facts.status = record.status
  if (typeof record.message === 'string' && record.message.length > 0) {
    facts.message = sanitizeMessage(record.message)
  }
  return facts
}

/**
 * Reduce an arbitrary error message to something safe to render.
 * @param message - the raw message.
 * @returns a single-line, capped string.
 */
function sanitizeMessage(message: string): string {
  const singleLine = message.replace(/[\r\n]+/g, ' ').trim()
  if (singleLine.length <= MAX_MESSAGE_CHARS) return singleLine
  return `${singleLine.slice(0, MAX_MESSAGE_CHARS)}…`
}
