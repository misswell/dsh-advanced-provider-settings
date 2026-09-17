/**
 * The Settings → "Provider Advanced" page (spec sections 42, 55, 50).
 *
 * This page owns the one piece of configuration that has no provider to hang
 * off: the global request header list. It also carries diagnostics, the legacy
 * migration prompt, and a read-only roll-up of what each provider resolves to —
 * all of which are cross-provider questions that no provider card can answer.
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
