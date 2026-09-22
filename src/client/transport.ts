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
import type {
  ClientContext,
  SettingsPathOp,
  SettingsScopeLike,
  WriteResult,
} from './contract.js'

/** Namespace of the failure code the Host answers with for a stale revision. */
const CONFLICT_CODE = 'settings/conflict'

/**
 * Bind one Host settings namespace for reading and writing.
 *
 * @param ctx - the client context; `configForms` and `remote.settings` are both
 *   declared in `inject`, so they are present by the time this runs.
 * @param namespace - Host plugin entry id owning the namespace.
 * @returns a scope whose snapshot is the form's own.
 */
export function bindNamespace<T>(ctx: ClientContext, namespace: string): SettingsScopeLike<T> {
  const form = ctx.configForms.get<T>(namespace)
  const mirror = ctx.configForms.describe()

  // The Host fences one revision per write, so two saves issued from this page
  // in the same tick would otherwise make the second one conflict with the
  // first. Serialization is the transport's job, not each editor's.
  let tail: Promise<unknown> = Promise.resolve()

  const mutate = (
    ops: readonly SettingsPathOp[],
    expectedRevision?: number,
  ): Promise<WriteResult> => {
    const queued = tail.then(async (): Promise<WriteResult> => {
      const fence = expectedRevision ?? form.getSnapshot().revision
      const response = await ctx.remote.settings.mutate(namespace, cloned(ops), fence)
      if (!response.ok) {
        return response.error.code === CONFLICT_CODE
          ? { kind: 'conflict', message: response.error.message }
          : { kind: 'refused', message: response.error.message }
      }
      mirror.acceptView(response.value)
      return { kind: 'written' }
    })
    tail = queued.catch(() => undefined)
    return queued
  }

  return {
    getSnapshot: () => form.getSnapshot(),
    subscribe: (listener) => form.subscribe(listener),
    mutate,
  }
}

/** Copy the operations so a later draft edit cannot rewrite a queued write. */
function cloned(ops: readonly SettingsPathOp[]): SettingsPathOp[] {
  return ops.map((op) => (op.op === 'set'
    ? { op: 'set', path: [...op.path], value: op.value }
    : { op: 'unset', path: [...op.path] }))
}
