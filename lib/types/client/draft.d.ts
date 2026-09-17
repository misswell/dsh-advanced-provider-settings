import type { AdvancedSectionId } from '../shared/summary.js';
import type { ProviderProfile, SettingsPathOp } from '../shared/types.js';
import type { SettingsScopeLike, SettingsSnapshotLike } from './contract.js';
/** Outcome of a save attempt. */
export type SaveOutcome = 'saved' | 'noop' | 'conflict' | 'rejected' | 'unavailable';
/** The editing surface one provider card needs. */
export interface ProviderDraft {
    /** Committed profile, as the settings document resolves it. */
    committed: ProviderProfile;
    /** Profile with the user's edits applied, or the committed one when clean. */
    draft: ProviderProfile;
    /** Whether the user has edited anything not yet written. */
    dirty: boolean;
    /** Whether the namespace accepts writes at all. */
    writable: boolean;
    /** Load state of the namespace. */
    status: SettingsSnapshotLike<unknown>['status'];
    /** Replace one provider-level field. */
    setField: (field: string, value: unknown) => void;
    /** Replace one field on one model. */
    setModelField: (index: number, field: string, value: unknown) => void;
    /** Drop every managed field in the named sections, or all of them. */
    reset: (sections?: readonly AdvancedSectionId[]) => void;
    /** Throw away local edits. */
    discard: () => void;
    /** Write the diff, fenced by the revision the edit was based on. */
    save: () => Promise<SaveOutcome>;
    /** Wholesale replace the draft, used by the migration importer and tests. */
    replace: (next: ProviderProfile) => void;
}
/**
 * Build the draft surface for one provider.
 *
 * @param scope - the bound `llm-pi-ai` scope, or undefined when unavailable.
 * @param providerId - the route id this card edits.
 * @returns the draft surface.
 */
export declare function useProviderDraft(scope: SettingsScopeLike<{
    providers?: Record<string, ProviderProfile>;
}> | undefined, providerId: string): ProviderDraft;
/**
 * Diff one provider without models, for a section-scoped save.
 * @param providerId - route id.
 * @param before - committed profile.
 * @param after - edited profile.
 * @returns provider-level operations.
 */
export declare function providerSectionOps(providerId: string, before: ProviderProfile, after: ProviderProfile): SettingsPathOp[];
