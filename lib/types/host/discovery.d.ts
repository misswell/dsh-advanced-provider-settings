import type { HeaderEntry } from '../shared/headers.js';
import type { RequestHeaderContext } from './header-runtime.js';
/** The discovery request Harness accepts. */
export interface DiscoveryRequestShape {
    provider?: string;
    baseURL?: string;
    api?: string;
    apiKey?: string;
}
/** A discovered model, as the endpoint advertised it. */
export interface DiscoveredModel {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
}
/** What the Test Provider action reports. */
export interface DiscoveryOutcome {
    ok: boolean;
    modelCount: number;
    elapsedMs: number;
    /** HTTP status when the failure carried one. */
    status?: number;
    /** Harness error code, e.g. `DISCOVERY_FAILED`. */
    errorCode?: string;
    /** Short, sanitized explanation safe to render. Never contains a header value. */
    message?: string;
}
/** The slice of `ctx.llm` this module needs. */
export interface LlmDiscoveryService {
    discoverModels: (settingsNs: string, request: DiscoveryRequestShape, signal?: AbortSignal) => Promise<DiscoveredModel[]>;
}
/**
 * Merge the header layers a discovery attempt should carry, with the draft
 * provider headers winning over global ones — the same precedence the stream
 * path has, so the test predicts production.
 * @param globalHeaders - the stored global headers.
 * @param draftHeaders - the provider headers currently in the form.
 * @returns the headers to put in scope.
 */
export declare function discoveryHeaders(globalHeaders: readonly HeaderEntry[], draftHeaders: readonly HeaderEntry[]): HeaderEntry[];
/**
 * Interrogate a provider endpoint with an explicit header set.
 *
 * @param options - the llm service, the header bridge, and the request.
 * @returns the outcome, never a rejection — the caller renders failures.
 */
export declare function runDiscovery(options: {
    llm: LlmDiscoveryService;
    run: <T>(context: RequestHeaderContext, body: () => T) => T;
    providerId: string;
    request: DiscoveryRequestShape;
    headers: readonly HeaderEntry[];
    timeoutMs?: number;
}): Promise<DiscoveryOutcome>;
/**
 * Extract machine-readable failure facts from a Harness error.
 *
 * Only the code, the numeric status and a length-capped message cross this
 * boundary. A provider's error body could echo a request header, so the text is
 * truncated and the caller is expected to treat it as untrusted display data.
 * @param error - whatever was thrown.
 * @returns facts safe to send to the browser.
 */
export declare function failureFacts(error: unknown): Pick<DiscoveryOutcome, 'status' | 'errorCode' | 'message'>;
