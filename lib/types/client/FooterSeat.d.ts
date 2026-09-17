/**
 * The Models page footer seat (spec section 42).
 *
 * The section supplies no owner props here, so this is a self-contained summary
 * that points at the one cross-provider surface: how many providers carry
 * advanced overrides, and the shortcut into the settings page that owns global
 * headers. It deliberately renders nothing when nothing is configured, so an
 * untouched install sees no extra chrome.
 */
import { type ReactNode } from 'react';
import type { ClientContext } from './contract.js';
/** Build the footer seat for one plugin instance. */
export declare function createFooterSeat(ctx: ClientContext): () => ReactNode;
/** The footer content. */
export declare function ModelsFooter(props: {
    ctx: ClientContext;
}): ReactNode;
