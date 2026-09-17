import type { ProviderModelEntry, ProviderProfile, SettingsPathOp } from './types.js';
/**
 * Deep JSON equality with key-order independence.
 * @param a - first value.
 * @param b - second value.
 * @returns whether the two are structurally identical.
 */
export declare function jsonEqual(a: unknown, b: unknown): boolean;
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
export declare function setOrUnset(path: readonly string[], before: unknown, after: unknown): SettingsPathOp[];
/**
 * Diff every provider-level key this plugin manages.
 * @param providerId - route id.
 * @param before - profile as read.
 * @param after - profile as edited.
 * @returns the minimal operations, in table order.
 */
export declare function diffManagedProviderFields(providerId: string, before: ProviderProfile, after: ProviderProfile): SettingsPathOp[];
/**
 * Diff one model entry's plugin-managed keys.
 * @param providerId - route id.
 * @param modelIndex - position in the `models` array.
 * @param before - entry as read, or undefined when the index is new.
 * @param after - entry as edited.
 * @returns the minimal operations.
 */
export declare function diffManagedModelFields(providerId: string, modelIndex: number, before: ProviderModelEntry | undefined, after: ProviderModelEntry | undefined): SettingsPathOp[];
/**
 * Reset one section: unset every present key of that section.
 * @param providerId - route id.
 * @param profile - profile as read.
 * @param fields - the section's provider-level fields.
 * @returns operations removing only those keys.
 */
export declare function resetProviderFields(providerId: string, profile: ProviderProfile, fields: readonly string[], 
/** Model list to clear alongside, when the section owns per-model fields. */
models?: readonly ProviderModelEntry[]): SettingsPathOp[];
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
export declare function resetAllAdvanced(providerId: string, profile: ProviderProfile): SettingsPathOp[];
/**
 * Diff a flat string mapping (headers) key by key, so a sibling key another
 * writer added is never dropped and a removed key is explicitly unset.
 * @param basePath - path of the mapping itself.
 * @param before - mapping as read, or undefined when absent.
 * @param after - mapping as edited.
 * @returns operations, `unset` first so a rename lands cleanly.
 */
export declare function diffStringRecord(basePath: readonly string[], before: Record<string, string> | undefined, after: Record<string, string>): SettingsPathOp[];
/**
 * Whether an operation list would change nothing.
 * @param ops - candidate operations.
 * @returns whether the list is empty.
 */
export declare function isNoop(ops: readonly SettingsPathOp[]): boolean;
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
export declare function diffManagedProviderConfig(providerId: string, before: ProviderProfile, after: ProviderProfile): SettingsPathOp[];
/**
 * Apply operations to a detached object, for previews and tests.
 * @param root - object to copy and edit.
 * @param ops - operations to apply in order.
 * @returns the edited copy.
 */
export declare function applyOps<T extends Record<string, unknown>>(root: T, ops: readonly SettingsPathOp[]): T;
/**
 * Diff the plugin's own global-header mapping.
 * @param before - mapping as read, or undefined when absent.
 * @param after - mapping as edited.
 * @returns operations against the plugin namespace's `globalHeaders`.
 */
export declare function diffGlobalHeaders(before: Record<string, string> | undefined, after: Record<string, string>): SettingsPathOp[];
