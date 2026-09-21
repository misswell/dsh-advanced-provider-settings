/**
 * The Settings → "Provider Advanced" page (spec sections 42, 55, 50).
 *
 * This page owns the two things no provider card can answer: the global request
 * header list that applies to every route, and a per-provider editor reached
 * without hunting through the Models page. Diagnostics and the legacy migration
 * prompt ride along because they are cross-provider questions.
 */
import { type ReactNode } from 'react';
import type { ClientContext } from './contract.js';
/**
 * Build the settings page component for one plugin instance.
 * @param ctx - the client context captured at registration.
 * @returns the component to register.
 */
export declare function createGlobalSeat(ctx: ClientContext): () => ReactNode;
/**
 * The page body.
 *
 * The context arrives as a prop rather than through a module-level singleton,
 * so a test can render the page with its own context and two plugin instances
 * could never share one.
 */
export declare function GlobalSettingsPage(props: {
    ctx: ClientContext;
}): ReactNode;
/**
 * Which provider the editor below is configured for.
 *
 * A row of pills rather than a dropdown because the roster is short and the
 * choice is the page's main action.
 */
export declare function ProviderPicker(props: {
    label: string;
    providers: readonly (readonly [string, {
        displayName?: string;
    }])[];
    active: string;
    /** An unsaved draft belongs to one provider, so another choice is refused. */
    refuseSwitch: boolean;
    onSelect: (providerId: string) => void;
}): ReactNode;
