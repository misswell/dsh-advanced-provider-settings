/**
 * The client's settings transport: one namespace handle over the shared mirror.
 *
 * Reads go through `ctx.configForms`, which derives every entry's form from the
 * ONE `settings.describe` mirror the shell holds — so this page and the native
 * Models page cannot disagree about what the document says, and a document
 * change pushed by the Host repaints both without any plumbing here.
 *
 * Writes deliberately go through `ctx.remote.settings` instead of
 * `ConfigForm.mutate`. The form answers a write with a boolean, which collapses
 * "you fenced a stale revision" into "the document refused this value"; the UI
 * has to say those apart, because only one of them is fixed by retrying. The
 * mirror is folded by hand from the write answer so the fresh values render
 * before the invalidation arrives.
 */
import type { ClientContext, SettingsScopeLike } from './contract.js';
/**
 * Bind one Host settings namespace for reading and writing.
 *
 * @param ctx - the client context; `configForms` and `remote.settings` are both
 *   declared in `inject`, so they are present by the time this runs.
 * @param namespace - Host plugin entry id owning the namespace.
 * @returns a scope whose snapshot is the form's own.
 */
export declare function bindNamespace<T>(ctx: ClientContext, namespace: string): SettingsScopeLike<T>;
