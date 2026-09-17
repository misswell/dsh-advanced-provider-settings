import { type SettingsServiceLike } from './host/settings.js';
/** Cordis plugin name; must equal the package name the bundle is registered under. */
export declare const name = "dsh-advanced-provider-settings";
/**
 * Services required before `apply` runs.
 *
 * `webServer` is deliberately absent: a headless composition has no web server,
 * and the header bridge is useful there on its own. The web routes are attached
 * opportunistically instead.
 */
export declare const inject: string[];
/** One discovered model, as the adapter reports it. */
export interface DiscoveredModelLike {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
}
/** The slice of the LLM service the discovery probe needs. */
export interface LlmServiceLike {
    discoverModels: (settingsNs: string, request: {
        provider?: string;
        baseURL?: string;
        api?: string;
        apiKey?: string;
    }, signal?: AbortSignal) => Promise<DiscoveredModelLike[]>;
}
/** The subset of the cordis context this plugin uses. */
export interface HostContext {
    settings: SettingsServiceLike;
    llm: LlmServiceLike;
    logger: {
        warn: (message: string, ...args: unknown[]) => void;
    };
    /** Resolve an optional service; undefined when the composition omits it. */
    get: (service: string) => unknown;
    /** Register a teardown for the calling fiber. */
    effect: (body: () => void | (() => void), label?: string) => void;
    /** Subscribe to a waterfall event; returns a disposer. */
    on: (event: string, handler: (...args: never[]) => unknown) => unknown;
}
/**
 * Mount the host half.
 *
 * @param rawContext - the plugin's host context. Everything registered here is
 *   torn down with the fiber, including the `fetch` wrapper when this plugin is
 *   the last holder.
 */
export declare function apply(rawContext: unknown): void;
/** Namespaces this plugin touches, for tests and documentation. */
export declare const namespaces: {
    readonly own: "dsh-advanced-provider-settings";
    readonly providers: "llm-pi-ai";
};
