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
 *
 * `compat` is the part of the schema most likely to be misused, because its
 * field names are wire-protocol identifiers that mean nothing without context.
 * Every flag is therefore rendered with a translated name and a one-line
 * explanation of what it changes about the outgoing request, clustered by
 * concern, and the raw identifier is kept only as a monospace subtitle so it
 * can still be matched against provider documentation.
 */
import { type ReactNode } from 'react';
import { type CompatFieldDef, type CompatGroupId } from '../../shared/capabilities.js';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** Render the route-level compatibility editor. */
export declare function CompatibilitySection(props: {
    t: Translate;
    profile: ProviderProfile;
    disabled: boolean;
    onChange: (field: string, value: unknown) => void;
}): ReactNode;
/** Split fields into their groups, preserving {@link COMPAT_GROUPS} order. */
export declare function groupCompatFields(fields: readonly CompatFieldDef[]): readonly {
    group: CompatGroupId;
    fields: readonly CompatFieldDef[];
}[];
/**
 * The grouped compat controls, reused by the per-model editor.
 *
 * A filter box appears only once the list is long enough to need one; the
 * point of the grouping is that most users never need it.
 */
export declare function CompatFieldGrid(props: {
    t: Translate;
    fields: readonly CompatFieldDef[];
    values: Record<string, unknown>;
    disabled: boolean;
    onChange: (key: string, value: unknown) => void;
}): ReactNode;
/**
 * One flag: what it means on the left, how it is set on the right.
 *
 * A boolean keeps three states rather than two. "Inherit" is not the same as
 * "off" — it leaves the decision to the adapter — so a two-position switch
 * would show a value the plugin cannot actually know.
 */
export declare function CompatFlagRow(props: {
    t: Translate;
    field: CompatFieldDef;
    value: unknown;
    disabled: boolean;
    onChange: (next: unknown) => void;
}): ReactNode;
/** Return a copy of a compat record with one key set or removed. */
export declare function withValue(record: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> | undefined;
