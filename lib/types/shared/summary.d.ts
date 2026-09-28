import type { ProviderModelOverride, ProviderProfile } from './types.js';
/** Identifiers of the advanced sections. */
export type AdvancedSectionId = 'headers' | 'retry' | 'timeout' | 'transport' | 'vision' | 'reasoning' | 'compatibility' | 'models';
/**
 * The provider-level fields each section owns, for a section-scoped reset.
 *
 * `models` owns none: its whole subject is the per-model channel, which lives
 * outside the provider's own key space. Keeping this table beside
 * {@link AdvancedSectionId} is what stops a section id from ever being mistaken
 * for a provider field name — which is how a "reset this section" would delete
 * an entire `models` list.
 */
export declare const SECTION_PROVIDER_FIELDS: Record<AdvancedSectionId, readonly string[]>;
/** Structured status of one section, translated at render time. */
export type SectionStatus = 
/** Nothing set: Harness defaults apply. */
{
    kind: 'default';
}
/** Nothing set, but a warning is worth surfacing. */
 | {
    kind: 'default-warning';
}
/** N items configured (headers, overrides, models). */
 | {
    kind: 'count';
    count: number;
}
/** A bounded retry policy with N maximum retries. */
 | {
    kind: 'retries';
    count: number;
}
/** The unbounded retry policy — always a warning. */
 | {
    kind: 'always';
}
/** A chosen reasoning level. */
 | {
    kind: 'level';
    level: string;
}
/** Set to something without a countable shape. */
 | {
    kind: 'custom';
}
/** Set, and the setting carries a hazard the user must see. */
 | {
    kind: 'custom-warning';
};
/** One section's id + status. */
export interface SectionSummary {
    id: AdvancedSectionId;
    status: SectionStatus;
}
/**
 * Count the provider-level compatibility overrides present.
 * @param profile - the profile as read.
 * @returns how many compat fields are explicitly set.
 */
export declare function compatOverrideCount(profile: ProviderProfile): number;
/**
 * Count models whose stored declaration claims image support: the entries of a
 * `models` list, plus any catalog model an override declares images for.
 * @param profile - the profile as read.
 * @returns the image-claiming count.
 */
export declare function visionModelCount(profile: ProviderProfile): number;
/** Every `modelOverrides` entry that carries at least one value. */
export declare function configuredModelOverrides(profile: ProviderProfile): [string, ProviderModelOverride][];
/** How many fields one override entry sets. */
export declare function overrideEntryCount(override: ProviderModelOverride | undefined): number;
/** Whether the provider default declares image input. */
export declare function providerClaimsImages(profile: ProviderProfile): boolean;
/**
 * Whether any plugin-managed key is set on the profile or its models.
 * @param profile - the profile as read.
 * @returns whether anything is configured.
 */
export declare function hasAnyAdvanced(profile: ProviderProfile): boolean;
/**
 * Project every section's status from a profile.
 * @param profile - the profile as read from the user layer.
 * @returns one summary per section, in display order.
 */
export declare function summarizeSections(profile: ProviderProfile): SectionSummary[];
/** One line of the Effective Configuration preview. */
export interface PreviewLine {
    /** Stable key for this line. */
    key: string;
    /**
     * Dictionary entry naming this line. Compat lines point straight at the flag's
     * own label rather than a second copy of it under `preview.`, which is how a
     * flag added to the table gets a preview name for free.
     */
    labelKey: string;
    /** How the value should be read back to the user. */
    format: 'text' | 'duration';
    /** Already-formatted value; numbers and short identifiers only. */
    value: string;
}
/**
 * Build the summarised "Effective Configuration" the preview shows — never a
 * full YAML dump (spec section 41).
 * @param profile - the profile as read.
 * @returns labelled value lines.
 */
export declare function buildPreview(profile: ProviderProfile): PreviewLine[];
