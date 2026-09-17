import { type HeaderEntry } from '../shared/headers.js';
/** What one in-flight LLM request needs the transport to know. */
export interface RequestHeaderContext {
    /** Provider route the request belongs to. Diagnostics only — never a header. */
    provider: string;
    /** Model id. Diagnostics only. */
    model: string;
    /** Headers to merge, already validated. */
    headers: readonly HeaderEntry[];
}
/**
 * Owns this plugin instance's `AsyncLocalStorage` and the installed wrapper's
 * lifetime.
 */
export declare class HeaderRuntime {
    private readonly storage;
    /** Header applications observed, for diagnostics only. Never values. */
    private applied;
    /** Whether the wrapper is currently installed by this runtime. */
    private installed;
    /**
     * Install the fetch wrapper, refcounted across plugin instances.
     * @returns a disposer that removes this installer's reference.
     */
    install(): () => void;
    /**
     * Run one LLM request with its global headers in scope.
     *
     * @param context - provider/model identity and the validated headers.
     * @param body - the operation whose async continuations must see them.
     * @returns whatever `body` returns.
     */
    run<T>(context: RequestHeaderContext, body: () => T): T;
    /**
     * Wrap one adapter stream so every iteration step runs inside this runtime's
     * scope.
     *
     * Re-entering the scope around each `next()` is what makes the scope survive:
     * the adapter opens its HTTP request lazily on the first pull, and a plain
     * `storage.run(…, () => iterator)` would leave the later pulls outside the
     * context.
     *
     * @param context - the request's header context.
     * @param source - the adapter's async iterable.
     * @returns an equivalent iterable whose pulls are scoped.
     */
    scopedStream<T>(context: RequestHeaderContext, source: AsyncIterable<T>): AsyncIterable<T>;
    /** Current scope, for the wrapper and for tests. */
    peek(): RequestHeaderContext | undefined;
    /** Whether the wrapper is installed by this runtime. */
    get isInstalled(): boolean;
    /** How many requests had headers applied, for diagnostics. */
    get appliedCount(): number;
    /** Record one applied request. Called by the wrapper. */
    noteApplied(): void;
}
/**
 * Merge headers into a fetch call without clobbering what an earlier layer set.
 *
 * Reserved names overwrite (see the module doc: `user-agent` is otherwise
 * unreachable); every other name is only added when absent, which is what
 * yields `Provider > Global`.
 *
 * @param input - the first fetch argument.
 * @param init - the optional second fetch argument.
 * @param headers - validated headers to merge.
 * @returns arguments for the underlying fetch.
 */
export declare function withHeaders(input: RequestInfo | URL, init: RequestInit | undefined, headers: readonly HeaderEntry[]): {
    input: RequestInfo | URL;
    init?: RequestInit;
};
