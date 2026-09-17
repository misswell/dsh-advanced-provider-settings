/**
 * Compatibility section: route-level and model-level `compat` flags
 * (spec sections 37-40).
 *
 * The field list is filtered by the route's protocol rather than shown in full,
 * because the two levels behave differently in Harness and only one of the two
 * is forgiving:
 *
 *  - at ROUTE level a field the protocol does not read is silently skipped;
 *  - at MODEL level the same field is a HARD ERROR that fails profile
 *    resolution.
 *
 * So the model-level editor is not merely convenient — offering a field there
 * that the protocol does not support would let the user save a broken profile.
 */
import type { ReactNode } from 'react';
import { type CompatFieldDef } from '../../shared/capabilities.js';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** Render the route-level compatibility editor. */
export declare function CompatibilitySection(props: {
    t: Translate;
    profile: ProviderProfile;
    disabled: boolean;
    onChange: (field: string, value: unknown) => void;
}): ReactNode;
/** The grid of compat controls, reused by the per-model editor. */
export declare function CompatFieldGrid(props: {
    t: Translate;
    fields: readonly CompatFieldDef[];
    values: Record<string, unknown>;
    disabled: boolean;
    onChange: (key: string, value: unknown) => void;
}): ReactNode;
/** Return a copy of a compat record with one key set or removed. */
export declare function withValue(record: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> | undefined;
