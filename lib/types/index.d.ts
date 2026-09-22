import { type WebServerLike } from './host/routes.js';
import { type SettingsServiceLike } from './host/settings.js';
/** Cordis plugin name; must equal the package name the bundle is registered under. */
export declare const name = "dsh-advanced-provider-settings";
/**
 * This plugin's settings, as its profile entry config.
 *
 * Every field the browser edits carries `.volatile()`; an entry with none gets
 * no namespace at all, and the browser half would find nothing to bind to.
 */
export declare const Config: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
    globalHeaders: import("@deepseek-ai/schemastery").default<NoInfer<import("@deepseek-ai/cosmokit").Dict<string, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<string, string>>, "volatile">;
    ui: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
        advancedExpanded: import("@deepseek-ai/schemastery").default<boolean, boolean, "plain">;
        acknowledgedAlwaysRetry: import("@deepseek-ai/schemastery").default<boolean, boolean, "plain">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        advancedExpanded: import("@deepseek-ai/schemastery").default<boolean, boolean, "plain">;
        acknowledgedAlwaysRetry: import("@deepseek-ai/schemastery").default<boolean, boolean, "plain">;
    }>>>, "volatile">;
    migration: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
        globalHeaders: import("@deepseek-ai/schemastery").default<"imported" | "ignored", "imported" | "ignored", "plain">;
        decidedAt: import("@deepseek-ai/schemastery").default<string, string, "plain">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        globalHeaders: import("@deepseek-ai/schemastery").default<"imported" | "ignored", "imported" | "ignored", "plain">;
        decidedAt: import("@deepseek-ai/schemastery").default<string, string, "plain">;
    }>>>, "volatile">;
}>>, Schemastery.ObjectT<NoInfer<{
    globalHeaders: import("@deepseek-ai/schemastery").default<NoInfer<import("@deepseek-ai/cosmokit").Dict<string, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<string, string>>, "volatile">;
    ui: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
        advancedExpanded: import("@deepseek-ai/schemastery").default<boolean, boolean, "plain">;
        acknowledgedAlwaysRetry: import("@deepseek-ai/schemastery").default<boolean, boolean, "plain">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        advancedExpanded: import("@deepseek-ai/schemastery").default<boolean, boolean, "plain">;
        acknowledgedAlwaysRetry: import("@deepseek-ai/schemastery").default<boolean, boolean, "plain">;
    }>>>, "volatile">;
    migration: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
        globalHeaders: import("@deepseek-ai/schemastery").default<"imported" | "ignored", "imported" | "ignored", "plain">;
        decidedAt: import("@deepseek-ai/schemastery").default<string, string, "plain">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        globalHeaders: import("@deepseek-ai/schemastery").default<"imported" | "ignored", "imported" | "ignored", "plain">;
        decidedAt: import("@deepseek-ai/schemastery").default<string, string, "plain">;
    }>>>, "volatile">;
}>>, "plain">;
/**
 * Services required before `apply` runs.
 *
 * `webServer` is deliberately absent: a headless composition has no web server,
 * and the header bridge is useful there on its own. The web routes are attached
 * through a child fiber instead — see `apply`.
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
    /** This plugin's own fiber, which owns the settings page policy. */
    fiber: unknown;
    /** Present only once the composition has provided the web server. */
    webServer?: WebServerLike;
    /** Resolve an optional service; undefined when the composition omits it. */
    get: (service: string) => unknown;
    /**
     * Open a child fiber that waits for services this plugin does not require.
     *
     * The child sees them as resolved properties; it is disposed with this fiber.
     */
    inject: (deps: readonly string[], callback: (child: HostContext) => void) => unknown;
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
 * @param rawConfig - this entry's resolved config, every field a live reader.
 */
export declare function apply(rawContext: unknown, rawConfig: unknown): void;
/** Namespaces this plugin touches, for tests and documentation. */
export declare const namespaces: {
    readonly own: "advanced-provider-settings";
    readonly providers: "llm-pi-ai";
};
