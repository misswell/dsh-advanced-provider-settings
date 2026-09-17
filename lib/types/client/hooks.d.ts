import type { ClientContext, SettingsScopeLike, SettingsSnapshotLike, Translate } from './contract.js';
import type { JsonValue, PluginSettings, ProviderNamespaceSection } from '../shared/types.js';
/** Route prefix the host half registers. */
export declare const RPC_PATH = "/dsh-advanced-provider-settings/rpc";
/**
 * The translate function for this plugin's copy, re-derived on locale change.
 *
 * The framework can synthesize a `t` prop for a registration that declares
 * `locale:`, but that mechanism resolves the namespace through the compile-time
 * `LocaleNamespaceMap` table and fails loud at render when the locale face is
 * not installed. Binding the namespace against the locale service gives the
 * same function with neither coupling, and subscribing to the service's
 * revision is what makes a language switch repaint this subtree.
 *
 * @param ctx - client context carrying the locale service.
 * @returns a stable-identity translate function for the plugin namespace.
 */
export declare function useTranslate(ctx: ClientContext): Translate;
/**
 * Subscribe to a bound settings namespace.
 *
 * `getSnapshot` returns a stable reference until a real change, which is what
 * `useSyncExternalStore` requires; calling `bind` per render would break that,
 * so callers bind once (see {@link useProviderScope}).
 *
 * @param scope - the bound scope, or undefined while the service is unavailable.
 * @returns the current snapshot.
 */
export declare function useSettingsSnapshot<T>(scope: SettingsScopeLike<T> | undefined): SettingsSnapshotLike<T>;
/**
 * Bind the `llm-pi-ai` namespace once per component lifetime.
 * @param ctx - the client context.
 * @returns the bound scope, or undefined when the service is absent.
 */
export declare function useProviderScope(ctx: ClientContext | undefined): SettingsScopeLike<ProviderNamespaceSection> | undefined;
/**
 * Bind this plugin's own namespace once per component lifetime.
 * @param ctx - the client context.
 * @returns the bound scope, or undefined when the service is absent.
 */
export declare function useOwnScope(ctx: ClientContext | undefined): SettingsScopeLike<PluginSettings> | undefined;
/** One RPC call's state. */
export interface RpcState<T> {
    data: T | undefined;
    loading: boolean;
    error: string | undefined;
}
/**
 * Same-origin RPC caller.
 *
 * Posts to this plugin's host route with a JSON body. The host side repeats the
 * origin and content-type checks the browser already enforces, so a refusal
 * here is a real answer rather than a transport accident.
 *
 * @returns a stable call function.
 */
export declare function useRpc(): <T>(op: string, payload?: Record<string, JsonValue>) => Promise<T | undefined>;
/**
 * Run an RPC once when a dependency key changes.
 * @param op - operation name.
 * @param payload - request payload.
 * @param enabled - whether to run at all.
 * @returns the call state.
 */
export declare function useRpcQuery<T>(op: string, payload: Record<string, JsonValue>, enabled?: boolean): RpcState<T> & {
    reload: () => void;
};
/**
 * Controlled text state that tolerates an intermittent external value.
 *
 * A settings snapshot can be replaced underneath the editor (another client, or
 * the write we just made). The draft keeps the user's text until they commit,
 * and adopts the incoming value only when it changes and nothing is dirty.
 *
 * @param external - the committed value.
 * @param serialize - how to render the committed value as text.
 * @returns the text, a setter, and a dirty flag.
 */
export declare function useTextDraft(external: string, serialize?: (text: string) => string): [string, (next: string) => void, boolean];
/**
 * Whether a settings field is explicitly overridden in the user layer.
 *
 * Presence, not value, is the signal: an override equal to the composition
 * default is still an override, and comparing values could not see it.
 *
 * @param rawUser - the snapshot's `user` layer.
 * @param path - path inside the namespace.
 * @returns whether the field is overridden.
 */
export declare function isOverridden(rawUser: unknown, path: readonly string[]): boolean;
/** Read a value at a path out of a resolved namespace section. */
export declare function valueAt(section: unknown, path: readonly string[]): JsonValue | undefined;
/** Number of entries in a record-shaped value. */
export declare function recordSize(value: unknown): number;
/** Cast a value to a plain record, or an empty one. */
export declare function asRecord(value: unknown): Record<string, string>;
