/**
 * Minimal-patch computation.
 *
 * The spec forbids the read-everything / clone / mutate / write-everything
 * cycle (section 44). Instead every save is a list of path-addressed `set` and
 * `unset` operations against the user layer the client actually read:
 *
 *   - a key the user did not touch is never named, so unknown fields written by
 *     other plugins, or by a newer DSH version, survive by construction;
 *   - choosing "Harness Default" emits `unset`, so the field re-inherits —
 *     including defaults a future Harness release changes (section 46);
 *   - "Reset Section" unsets only that section's managed keys (section 47).
 *
 * Everything here is pure, so the preservation guarantees are unit-testable
 * without a running Harness (sections 70, 73).
 */
import { MANAGED_MODEL_KEYS, MANAGED_PROVIDER_KEYS } from './capabilities.js'
import type { ProviderModelEntry, ProviderProfile, SettingsPathOp } from './types.js'
import { modelFieldPath, providerFieldPath } from './types.js'

/**
 * Deep JSON equality with key-order independence.
 * @param a - first value.
 * @param b - second value.
 * @returns whether the two are structurally identical.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((value, index) => jsonEqual(value, b[index]))
  }
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const aKeys = Object.keys(aRecord)
  const bKeys = Object.keys(bRecord)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => Object.hasOwn(bRecord, key) && jsonEqual(aRecord[key], bRecord[key]))
}

/**
 * Emit the operations that move one path from `before` to `after`.
 *
 * `undefined` on either side carries meaning: `after === undefined` means
 * "inherit again" and emits `unset`; `before === undefined` means the key was
 * absent and a defined `after` emits a plain `set`.
 *
 * @param path - absolute settings path.
 * @param before - value as read from the user layer.
 * @param after - value the user chose.
 * @returns zero or one operation.
 */
export function setOrUnset(path: readonly string[], before: unknown, after: unknown): SettingsPathOp[] {
  if (after === undefined) {
    return before === undefined ? [] : [{ op: 'unset', path: [...path] }]
  }
  if (before !== undefined && jsonEqual(before, after)) return []
  return [{ op: 'set', path: [...path], value: after }]
}

/**
 * Diff every provider-level key this plugin manages.
 * @param providerId - route id.
 * @param before - profile as read.
 * @param after - profile as edited.
 * @returns the minimal operations, in table order.
 */
export function diffManagedProviderFields(
  providerId: string,
  before: ProviderProfile,
  after: ProviderProfile,
): SettingsPathOp[] {
  const ops: SettingsPathOp[] = []
  for (const field of MANAGED_PROVIDER_KEYS) {
    ops.push(...setOrUnset(providerFieldPath(providerId, field), before[field], after[field]))
  }
  return ops
}

/**
 * Diff one model entry's plugin-managed keys.
 * @param providerId - route id.
 * @param modelIndex - position in the `models` array.
 * @param before - entry as read, or undefined when the index is new.
 * @param after - entry as edited.
 * @returns the minimal operations.
 */
export function diffManagedModelFields(
  providerId: string,
  modelIndex: number,
  before: ProviderModelEntry | undefined,
  after: ProviderModelEntry | undefined,
): SettingsPathOp[] {
  const ops: SettingsPathOp[] = []
  for (const field of MANAGED_MODEL_KEYS) {
    ops.push(
      ...setOrUnset(modelFieldPath(providerId, modelIndex, field), before?.[field], after?.[field]),
    )
  }
  return ops
}

/**
 * Reset one section: unset every present key of that section.
 * @param providerId - route id.
 * @param profile - profile as read.
 * @param fields - the section's provider-level fields.
 * @returns operations removing only those keys.
 */
export function resetProviderFields(
  providerId: string,
  profile: ProviderProfile,
  fields: readonly string[],
  /** Model list to clear alongside, when the section owns per-model fields. */
  models?: readonly ProviderModelEntry[],
): SettingsPathOp[] {
  const ops: SettingsPathOp[] = []
  for (const field of fields) {
    if (profile[field] !== undefined) ops.push({ op: 'unset', path: providerFieldPath(providerId, field) })
  }
  if (models !== undefined) {
    models.forEach((model, index) => {
      for (const field of MANAGED_MODEL_KEYS) {
        if (model[field] !== undefined) ops.push({ op: 'unset', path: modelFieldPath(providerId, index, field) })
      }
    })
  }
  return ops
}

/**
 * Reset every advanced setting on a provider, including per-model extras.
 *
 * Deliberately narrow: identity, endpoint, credential reference, model ids,
 * context windows and max tokens are never named, so Reset All cannot damage a
 * working route (spec section 48).
 *
 * @param providerId - route id.
 * @param profile - profile as read.
 * @returns operations removing only plugin-managed keys.
 */
export function resetAllAdvanced(providerId: string, profile: ProviderProfile): SettingsPathOp[] {
  const ops = resetProviderFields(providerId, profile, MANAGED_PROVIDER_KEYS)
  const models = Array.isArray(profile.models) ? profile.models : []
  models.forEach((model, index) => {
    for (const field of MANAGED_MODEL_KEYS) {
      if (model[field] !== undefined) {
        ops.push({ op: 'unset', path: modelFieldPath(providerId, index, field) })
      }
    }
  })
  return ops
}

/**
 * Diff a flat string mapping (headers) key by key, so a sibling key another
 * writer added is never dropped and a removed key is explicitly unset.
 * @param basePath - path of the mapping itself.
 * @param before - mapping as read, or undefined when absent.
 * @param after - mapping as edited.
 * @returns operations, `unset` first so a rename lands cleanly.
 */
export function diffStringRecord(
  basePath: readonly string[],
  before: Record<string, string> | undefined,
  after: Record<string, string>,
): SettingsPathOp[] {
  const beforeRecord = before ?? {}
  const unsets: SettingsPathOp[] = []
  const sets: SettingsPathOp[] = []

  for (const name of Object.keys(beforeRecord)) {
    if (!Object.hasOwn(after, name)) unsets.push({ op: 'unset', path: [...basePath, name] })
  }
  for (const [name, value] of Object.entries(after)) {
    if (beforeRecord[name] === value) continue
    sets.push({ op: 'set', path: [...basePath, name], value })
  }
  return [...unsets, ...sets]
}

/**
 * Whether an operation list would change nothing.
 * @param ops - candidate operations.
 * @returns whether the list is empty.
 */
export function isNoop(ops: readonly SettingsPathOp[]): boolean {
  return ops.length === 0
}

/**
 * Diff every field this plugin manages for one provider, models included.
 *
 * This is the single entry point a save uses. Splitting provider and model
 * diffs at the call site is how one of them ends up forgotten, and a forgotten
 * model diff silently discards the user's edit.
 *
 * A model list that changed LENGTH is left alone: index-addressed edits would
 * otherwise land on the wrong rows after a reorder, and adding or removing
 * models belongs to the Models page rather than to this editor.
 *
 * @param providerId - route id.
 * @param before - profile as read from the settings document.
 * @param after - profile as edited.
 * @returns ordered operations describing only the change.
 */
export function diffManagedProviderConfig(
  providerId: string,
  before: ProviderProfile,
  after: ProviderProfile,
): SettingsPathOp[] {
  const ops = diffManagedProviderFields(providerId, before, after)
  const beforeModels = Array.isArray(before.models) ? before.models : []
  const afterModels = Array.isArray(after.models) ? after.models : []
  if (beforeModels.length !== afterModels.length) return ops
  for (let index = 0; index < afterModels.length; index += 1) {
    ops.push(...diffManagedModelFields(providerId, index, beforeModels[index], afterModels[index]))
  }
  return ops
}

/**
 * Apply operations to a detached object, for previews and tests.
 * @param root - object to copy and edit.
 * @param ops - operations to apply in order.
 * @returns the edited copy.
 */
export function applyOps<T extends Record<string, unknown>>(root: T, ops: readonly SettingsPathOp[]): T {
  const draft = structuredClone(root) as Record<string, unknown>
  for (const op of ops) {
    if (op.op === 'unset') {
      deleteAt(draft, op.path, 0)
      continue
    }
    setAt(draft, op.path, 0, op.value)
  }
  return draft as T
}

/** Whether a container is index-addressable (an array) rather than a mapping. */
function isIndexed(node: unknown): node is unknown[] {
  return Array.isArray(node)
}

/** Recursively write a value at a path, materializing missing containers. */
function setAt(container: unknown, path: readonly string[], index: number, value: unknown): void {
  const key = path[index]
  if (key === undefined) return
  const last = index === path.length - 1

  if (isIndexed(container)) {
    const at = Number(key)
    if (!Number.isInteger(at) || at < 0) return
    if (last) {
      container[at] = value
      return
    }
    // An array position must stay an array when descended into; replacing it
    // with an object would silently destroy the `models` list.
    if (container[at] === undefined || container[at] === null) {
      container[at] = isNumericKey(path[index + 1]) ? [] : {}
    }
    setAt(container[at], path, index + 1, value)
    return
  }

  if (typeof container !== 'object' || container === null) return
  const record = container as Record<string, unknown>
  if (last) {
    record[key] = value
    return
  }
  const next = record[key]
  if (next === undefined || next === null) {
    record[key] = isNumericKey(path[index + 1]) ? [] : {}
  } else if (typeof next !== 'object') {
    record[key] = isNumericKey(path[index + 1]) ? [] : {}
  }
  setAt(record[key], path, index + 1, value)
}

/** Recursively delete a key at a path, tolerating an absent path. */
function deleteAt(container: unknown, path: readonly string[], index: number): void {
  const key = path[index]
  if (key === undefined) return
  const last = index === path.length - 1

  if (isIndexed(container)) {
    const at = Number(key)
    if (!Number.isInteger(at) || at < 0 || at >= container.length) return
    if (last) {
      delete container[at]
      return
    }
    deleteAt(container[at], path, index + 1)
    return
  }

  if (typeof container !== 'object' || container === null) return
  const record = container as Record<string, unknown>
  if (last) {
    delete record[key]
    return
  }
  deleteAt(record[key], path, index + 1)
}

/** Whether a path segment addresses an array position. */
function isNumericKey(key: string | undefined): boolean {
  return key !== undefined && /^\d+$/.test(key)
}

/**
 * Diff the plugin's own global-header mapping.
 * @param before - mapping as read, or undefined when absent.
 * @param after - mapping as edited.
 * @returns operations against the plugin namespace's `globalHeaders`.
 */
export function diffGlobalHeaders(
  before: Record<string, string> | undefined,
  after: Record<string, string>,
): SettingsPathOp[] {
  return diffStringRecord(['globalHeaders'], before, after)
}
