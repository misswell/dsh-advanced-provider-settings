/**
 * Network section: transport, timeouts and cache retention (spec sections 33-36).
 *
 * `maxRetries` and `maxRetryDelayMs` are deliberately absent: the `llm-pi-ai`
 * provider schema rejects both outright, so offering them would produce a
 * profile that fails to load. The section says so instead of staying silent,
 * because a user migrating from a hand-written YAML is likely looking for them.
 *
 * Durations are the reason this section uses sliders. `300000` is a number
 * nobody can read at a glance, and the schema's ceiling is 2147483647 — a value
 * that looks unremarkable while being about 24 days. Rendering the same value as
 * "5 min" against a visible range removes the most common way to misconfigure a
 * timeout: being off by a factor of 1000.
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
