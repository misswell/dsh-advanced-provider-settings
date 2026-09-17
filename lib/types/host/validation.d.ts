import type { ProviderProfile } from '../shared/types.js';
/** One field-level problem found in a draft. */
export interface DraftIssue {
    /** Field path inside the provider profile, e.g. `retryPolicy.backoff.jitterRatio`. */
    field: string;
    /** Stable code the client resolves through its locale files. */
    code: string;
    /** Offending value rendered small and safe for diagnostics (never a secret). */
    detail?: string;
}
/**
 * Validate the advanced fields of one provider draft.
 *
 * Only plugin-managed fields are examined. Identity, endpoint, credential
 * reference and model window sizes are Harness's business and are not judged
 * here (spec section 48).
 *
 * @param profile - the candidate profile.
 * @returns every problem found, empty when the draft is acceptable.
 */
export declare function validateProviderDraft(profile: ProviderProfile): DraftIssue[];
/** Whether any issue is severe enough to refuse the write. */
export declare function hasBlockingIssue(issues: readonly DraftIssue[]): boolean;
