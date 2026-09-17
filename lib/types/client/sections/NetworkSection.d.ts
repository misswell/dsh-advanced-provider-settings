/**
 * Network section: transport, timeouts and cache retention (spec sections 33-36).
 *
 * `maxRetries` and `maxRetryDelayMs` are deliberately absent: the `llm-pi-ai`
 * provider schema rejects both outright, so offering them would produce a
 * profile that fails to load. The section says so instead of staying silent,
 * because a user migrating from a hand-written YAML is likely looking for them.
 */
import type { ReactNode } from 'react';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** Render the Network section body. */
export declare function NetworkSection(props: {
    t: Translate;
    profile: ProviderProfile;
    disabled: boolean;
    /** Field-keyed validation messages from the host validator. */
    issues: ReadonlyMap<string, string>;
    onChange: (field: string, value: unknown) => void;
}): ReactNode;
