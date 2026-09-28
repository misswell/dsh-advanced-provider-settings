import { type AdvancedSectionId } from './summary.js';
import type { ProviderModelEntry, ProviderModelOverride, ProviderProfile, SettingsPathOp } from './types.js';
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
export declare function resetProviderFields(providerId: string, profile: ProviderProfile, fields: readonly string[]): SettingsPathOp[];
/**
 * Reset the per-model channel of one route: the managed keys of every `models`
 * entry, and every `modelOverrides` entry in full.
 *
 * The two channels are deliberately asymmetric. A `models` entry belongs to the
 * Models page, so only this plugin's three advanced keys are named and the
 * identity/capacity fields the page owns survive. A `modelOverrides` entry
 * exists only because this editor created it, so the whole entry goes.
 *
 * @param providerId - route id.
 * @param profile - profile as read.
 * @returns operations removing only per-model advanced configuration.
 */
export declare function resetModelFields(providerId: string, profile: ProviderProfile): SettingsPathOp[];
/**
 * Diff one `modelOverrides` entry, and drop the entry itself once it holds
 * nothing.
 *
 * An entry left as `{}` is schema-legal but is not configuration: it would show
 * as an override in the picker while changing nothing. So the last field
 * removed also removes the dict key.
 *
 * @param providerId - route id.
 * @param modelId - catalog model id (the dict key).
 * @param before - entry as read, or undefined when absent.
 * @param after - entry as edited, or undefined when the override is gone.
 * @returns the minimal operations.
 */
export declare function diffManagedModelOverride(providerId: string, modelId: string, before: ProviderModelOverride | undefined, after: ProviderModelOverride | undefined): SettingsPathOp[];
/**
 * Diff every `modelOverrides` entry of one route.
 * @param providerId - route id.
 * @param before - mapping as read, or undefined when absent.
 * @param after - mapping as edited, or undefined when empty.
 * @returns the minimal operations, entry by entry, then the mapping itself.
 */
export declare function diffManagedModelOverrides(providerId: string, before: Record<string, ProviderModelOverride> | undefined, after: Record<string, ProviderModelOverride> | undefined): SettingsPathOp[];
/**
 * Reset the named sections.
 *
 * Sections are resolved through {@link SECTION_PROVIDER_FIELDS} and never used
 * as field names directly: the ids are the UI's vocabulary (`timeout` covers
 * three fields, `network` none at all), and treating one as a provider key is
 * how a reset would unsets a whole `models` list.
 *
 * @param providerId - route id.
 * @param profile - profile as read.
 * @param sections - section ids to clear.
 * @returns operations removing only those sections' managed keys.
 */
export declare function resetSections(providerId: string, profile: ProviderProfile, sections: readonly AdvancedSectionId[]): SettingsPathOp[];
/**
 * Remove every `modelOverrides` entry of one route.
 * @param providerId - route id.
 * @param overrides - mapping as read.
 * @returns operations clearing every entry and the mapping.
 */
export declare function clearModelOverrides(providerId: string, overrides: Record<string, ProviderModelOverride> | undefined): SettingsPathOp[];
/**
 * Reset every advanced setting on a provider, including per-model extras.
 *
 * Deliberately narrow: identity, endpoint, credential reference, model ids,
 * context windows and max tokens of LISTED models are never named, so Reset All
 * cannot damage a working route (spec section 48). A `modelOverrides` entry is
 * the exception, and only because this plugin's editor is the channel that
 * creates it: the whole entry goes, which restores the installed catalog
 * declaration for that model.
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
