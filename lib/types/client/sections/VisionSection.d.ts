/**
 * Vision section: the provider-wide input default and the image budget
 * (spec sections 28-32, 69).
 *
 * Image limits are edited as a value plus a unit rather than raw bytes, because
 * the useful values are all powers of two and `20971520` tells a reader nothing.
 * A byte count that is not exactly representable in the chosen unit is rejected
 * rather than rounded: the host asserts these are positive integers, and a
 * silently rounded budget is a limit the user did not ask for.
 */
import type { ReactNode } from 'react';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** Render the Vision section body. */
export declare function VisionSection(props: {
    t: Translate;
    profile: ProviderProfile;
    disabled: boolean;
    issues: ReadonlyMap<string, string>;
    onChange: (field: string, value: unknown) => void;
}): ReactNode;
