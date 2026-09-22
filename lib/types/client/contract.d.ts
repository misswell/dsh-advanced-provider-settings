/**
 * Structural contract for the browser half.
 *
 * The client bundle may only `require` the nine platform modules the web shell
 * seeds (`react`, `react/jsx-runtime`, `@deepseek-ai/cordis`,
 * `dsh-client-store`, `dsh-client-ui-slots`, `-primitives`, `-dockkit`, …).
 * `dsh-client-ui-settings` and `dsh-client-locale` are NOT requirable, so their
 * cordis services are described structurally here instead of imported. Type-only
 * imports are fine — they are erased before the bundle is built.
 *
 * The `import type` lines below exist for one reason: they load the packages'
 * `declare module '@deepseek-ai/dsh-client-ui-slots'` augmentations into the
 * program, which is what types `PropsRuntime<'settings.models.provider-card'>`
 * and its owner props.
 */
import type { ProviderDirectoryEntry } from '@deepseek-ai/dsh-client-ui-settings-models/client';
/** Re-exported so components can name the row shape without a runtime import. */
export type { ProviderDirectoryEntry };
/**
 * The settings wire types are the SHARED ones, not a second declaration: the
 * same `SettingsPathOp` the host validates must be the one the client queues,
 * and duplicating the shape here is how the two drift.
 */
import type { SettingsPathOp } from '../shared/types.js';
export type { JsonValue, SettingsPathOp } from '../shared/types.js';
/** Sync state of one bound settings namespace. */
export interface SettingsSnapshotLike<T> {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;
    /** Composition layer the host resolved the value over. */
    base: unknown;
    /** Raw user layer; a field's PRESENCE here is what marks it overridden. */
    user: unknown;
    /** Namespace revision fencing the next write. */
    revision: number | undefined;
    writable: boolean;
    mode: 'host' | 'memory';
}
/**
 * Outcome of one namespace write.
 *
 * The transport answers rather than throwing, because the Host distinguishes
 * "you read a stale revision" from "the document refuses this value" and the UI
 * has to say which one happened — a thrown error would flatten both into one
 * message and send the user back through the same write.
 */
export type WriteResult = {
    kind: 'written';
} | {
    kind: 'conflict';
    message: string;
} | {
    kind: 'refused';
    message: string;
};
/** Reactive handle over one namespace, as {@link bindNamespace} returns it. */
export interface SettingsScopeLike<T> {
    getSnapshot: () => SettingsSnapshotLike<T>;
    subscribe: (listener: () => void) => () => void;
    mutate: (ops: readonly SettingsPathOp[], expectedRevision?: number) => Promise<WriteResult>;
}
/** One namespace as the shared describe mirror reports it. */
export interface SettingsNamespaceViewLike {
    ns: string;
    revision: number;
    value?: unknown;
    user?: unknown;
}
/**
 * The settings transport: per-entry forms over the shared describe mirror, plus
 * the Remote writes those forms fold their answers through.
 *
 * `configForms` replaces the pre-0.1.7 `settingsScope` service. It is one shared
 * mirror rather than a binding per caller, so the plugin's own page and the
 * Models page can never disagree about what the document holds.
 */
export interface ConfigFormsLike {
    /** Values and write queue of one Host plugin entry, keyed by its entry id. */
    get: <T>(entryId: string) => SettingsFormLike<T>;
    /** The shared mirror face, used to fold a write's answer in. */
    describe: () => SettingsDescribeFaceLike;
    /** Keep a registration alive while the Host serves any of these namespaces. */
    whileServed: (namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void) => () => void;
}
/** The framework's per-entry form, of which only reads are used directly. */
export interface SettingsFormLike<T> {
    getSnapshot: () => SettingsFormSnapshotLike<T>;
    subscribe: (listener: () => void) => () => void;
}
/** The framework's snapshot shape, mapped onto {@link SettingsSnapshotLike}. */
export interface SettingsFormSnapshotLike<T> {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;
    base: unknown;
    user: unknown;
    revision: number | undefined;
    writable: boolean;
    mode: 'host' | 'memory';
}
/** The fold-a-write-answer face of the shared mirror. */
export interface SettingsDescribeFaceLike {
    acceptView: (view: SettingsNamespaceViewLike) => void;
}
/** The `settings` Remote namespace as this plugin calls it. */
export interface RemoteSettingsLike {
    mutate: (ns: string, ops: readonly SettingsPathOp[], expectedRevision: number | undefined) => Promise<RemoteResponse<SettingsNamespaceViewLike>>;
}
/** One Remote answer: a value, or a classified failure. */
export type RemoteResponse<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
    };
};
/**
 * Register options, as the slot core documents them.
 *
 * `name` is the TARGET SLOT KEY — the entry contributes *into* that slot. It is
 * not an entry or plugin name: the core looks the key up in its declaration
 * table and throws `registering into an undeclared slot` when it misses, so a
 * descriptive name here is a load-time failure rather than a label.
 *
 * Kind shape fields: keyed takes `key`, list takes `id`/`order`/`label`, chain
 * takes `select`. Every kind accepts `priority`, the cell shadowing rank.
 */
export interface SlotRegisterOptions {
    name: string;
    /** Keyed slots: the dispatch key. */
    key?: string;
    /** List slots: the cell id. */
    id?: string;
    /** List slots: nav/row position. */
    order?: number;
    /** List slots: display text, or a thunk re-read per projection. */
    label?: string | (() => string);
    /** Cell shadowing rank; ascending, lowest renders, ties throw. */
    priority?: number;
    /** Registrant identity for diagnostics. */
    registrant?: string;
}
/** The slot registry the shell provides. */
export interface SlotsLike {
    /**
     * Run a registration once the named slot exists, and again after each
     * collapse. Returns the disposer ending that watch — which is what
     * {@link ConfigFormsLike.whileServed} takes a registration to return.
     */
    inject: (key: string, body: () => unknown) => () => void;
    /** Contribute one entry. Returns an idempotent disposer. */
    register: (options: SlotRegisterOptions, component: unknown) => () => void;
}
/** Immutable locale state published on every change. */
export interface LocaleSnapshotLike {
    /** Active locale id. */
    active: string;
    /** Monotonic change counter; bumps on a language switch AND on registration. */
    revision: number;
}
/** The locale registry the shell provides as `ctx.locale`. */
export interface LocaleLike {
    /**
     * Register one namespace's dictionaries, every shipped locale in one call.
     * Returns an idempotent disposer. Any namespace string is accepted at
     * runtime; only the compile-time key union is restricted.
     */
    register: (namespace: string, dictionaries: {
        zh: Record<string, string>;
        en: Record<string, string>;
    }) => () => void;
    /** Namespace-bound translate with stable identity. */
    bind: (namespace: string) => Translate;
    /** Current immutable snapshot. */
    getLocale: () => LocaleSnapshotLike;
    /** Notified on every snapshot change. */
    subscribe: (listener: () => void) => () => void;
}
/** The client context this plugin consumes. */
export interface ClientContext {
    slots: SlotsLike;
    /** Per-entry settings forms over the shared describe mirror. */
    configForms: ConfigFormsLike;
    /** Host Remote namespaces; only `settings` writes are issued. */
    remote: {
        settings: RemoteSettingsLike;
    };
    locale: LocaleLike;
    /** Register teardown for the calling fiber; the label is for diagnostics. */
    effect: (body: () => void | (() => void), label?: string) => void;
}
/**
 * Translate function shape.
 *
 * Deliberately NOT taken from the framework's `locale:` declaration. That
 * declaration synthesizes the `t` prop through the namespace table in
 * `LocaleNamespaceMap`, which this plugin's namespace is not merged into, and
 * the synthesis "fails loud" at render when the locale face is absent. Binding
 * the namespace directly is the same function with none of that coupling.
 */
export type Translate = (key: string, params?: Record<string, string | number>) => string;
/** Owner props of the provider-card seat. */
export interface ProviderCardOwnerProps {
    provider: ProviderDirectoryEntry;
    configured: boolean;
    keyConfigured: boolean;
}
/** Owner props of the Models footer seat (the section supplies nothing). */
export interface FooterOwnerProps {
    children?: never;
}
/** Owner props of a settings page contribution. */
export interface SettingsSectionOwnerProps {
    close: () => void;
}
/** Everything the plugin needs to reach on the client, resolved once. */
export declare const CLIENT_NAMESPACE = "llm-pi-ai";
