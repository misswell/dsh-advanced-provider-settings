/**
 * Effective configuration preview (spec sections 19, 41).
 *
 * The header rows come from the host, which folds the same three layers the
 * transport uses and masks sensitive values there rather than here. The rest of
 * the summary is computed from the local draft, so it reflects what the user is
 * about to save rather than what is currently stored — which is the whole point
 * of a preview.
 */
import { type ReactNode } from 'react';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** One header row as the host reports it. */
export interface EffectiveHeaderRow {
    name: string;
    value: string;
    source: string;
    reserved: boolean;
    sensitive: boolean;
}
/** The host's effective-header answer. */
export interface EffectiveHeadersResult {
    headers: EffectiveHeaderRow[];
    advisories: {
        code: string;
        name: string;
    }[];
    attributionOverridden: boolean;
}
/** Render the preview. */
export declare function PreviewSection(props: {
    t: Translate;
    profile: ProviderProfile;
    effective: EffectiveHeadersResult | undefined;
    loading: boolean;
}): ReactNode;
