import { type LlmDiscoveryService } from './discovery.js';
import type { RequestHeaderContext } from './header-runtime.js';
import type { readProviderSection } from './provider-config.js';
import type { PluginSettings } from '../shared/types.js';
/** Route prefix owned by this plugin. */
export declare const ROUTE_PREFIX = "/dsh-advanced-provider-settings";
/** Everything the route layer reads from the host, injected for testability. */
export interface RouteDeps {
    pluginVersion: string;
    getOwnSettings: () => PluginSettings | undefined;
    getProviderSection: () => ReturnType<typeof readProviderSection>;
    namespaces: () => readonly string[];
    writable: boolean;
    revisionSupported: boolean;
    headerRuntimeActive: boolean;
    headerRuntimeApplied: () => number;
    routesRegistered: () => boolean;
    legacyValue: () => unknown;
    llm: LlmDiscoveryService;
    runWithHeaders: <T>(context: RequestHeaderContext, body: () => T) => T;
}
/** The RPC envelope the browser half sends. */
interface RpcRequest {
    op?: unknown;
    payload?: unknown;
}
/** The RPC envelope returned. */
interface RpcResponse {
    ok: boolean;
    error?: string;
    code?: string;
    result?: unknown;
}
/**
 * Build the request handler for one plugin installation.
 * @param deps - host facts and services the handlers need.
 * @returns an async Node request handler.
 */
export declare function createRpcHandler(deps: RouteDeps): (req: HttpRequestLike, res: HttpResponseLike) => Promise<void>;
/**
 * Dispatch one RPC operation.
 * @param deps - host facts and services.
 * @param request - the parsed envelope.
 * @returns the envelope to send.
 */
export declare function dispatch(deps: RouteDeps, request: RpcRequest): Promise<RpcResponse>;
/** Minimal Node request shape, so tests need no socket. */
export interface HttpRequestLike {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    socket?: {
        remoteAddress?: string;
    };
    on: (event: string, listener: (...args: never[]) => void) => void;
    destroy: () => void;
}
/** Minimal Node response shape. */
export interface HttpResponseLike {
    writeHead: (status: number, headers: Record<string, string>) => void;
    end: (body?: string) => void;
}
/** The web-server registration surface this plugin uses. */
export interface WebServerLike {
    register: (options: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: HttpRequestLike, res: HttpResponseLike) => void | Promise<void>;
    }) => () => void;
}
/**
 * Register the routes and return a disposer.
 * @param webServer - the host web-server registry.
 * @param deps - handler dependencies.
 * @param onRegistered - called with whether registration succeeded, for diagnostics.
 * @returns a disposer that unregisters the routes.
 */
export declare function registerRoutes(webServer: WebServerLike, deps: RouteDeps, onRegistered: (registered: boolean) => void): () => void;
/** Namespace this plugin reads provider configuration from. */
export declare const READ_NAMESPACE = "llm-pi-ai";
export {};
