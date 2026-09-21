/**
 * Reasoning section: provider-level thinking level and token budgets
 * (spec sections 25-27).
 *
 * `xhigh` and `max` are offered as levels because the schema accepts them, with
 * a note that DSH folds both onto the `high` budget — otherwise a user setting
 * an `xhigh` budget of 128k would silently get 16k. The fold is stated once, in
 * words, beside the control it applies to; a second picture of the same ladder
 * would only repeat what the pills already say.
 */
import type { ReactNode } from 'react';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** Render the Reasoning section body. */
export declare function ReasoningSection(props: {
    t: Translate;
    profile: ProviderProfile;
    disabled: boolean;
    issues: ReadonlyMap<string, string>;
    onChange: (field: string, value: unknown) => void;
}): ReactNode;
