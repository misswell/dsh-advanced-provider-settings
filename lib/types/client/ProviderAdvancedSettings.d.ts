/**
 * The provider-card extension: "Advanced Settings" under every `llm-pi-ai` card.
 *
 * WHY THIS IS NOT A MONKEY PATCH (spec sections 4, 40): the Models page declares
 * `settings.models.provider-card` as a keyed extension seat and dispatches it
 * with `entryKey = provider.settingsNs`. This plugin registers ONE entry under
 * `key: 'llm-pi-ai'` and receives every card of that family — saved rows and the
 * add-provider draft alike. The shipped Models section keeps full ownership of
 * its own layout, and nothing here reads or writes its DOM.
 *
 * The seat is a dispatch selector, not a prop: the component learns which
 * provider it belongs to from `provider.settingsNs` / `provider.provider`, which
 * is why the guard below re-checks the namespace instead of trusting the key.
 */
import { type ReactNode } from 'react';
import type { ClientContext, ProviderDirectoryEntry } from './contract.js';
/** Owner props the Models section supplies at this seat. */
export interface ProviderCardSeatProps {
    provider: ProviderDirectoryEntry;
    configured: boolean;
    keyConfigured: boolean;
}
/**
 * Build the seat component for one plugin instance.
 * @param ctx - the client context captured at registration.
 * @returns the component to register.
 */
export declare function createProviderCardSeat(ctx: ClientContext): (props: ProviderCardSeatProps) => ReactNode;
/** The advanced settings panel for one provider. */
export declare function ProviderAdvancedSettings(props: ProviderCardSeatProps & {
    ctx: ClientContext;
}): ReactNode;
/**
 * The same editor, mounted somewhere that owns its own provider selection.
 *
 * `embedded` drops the card's disclosure chrome: the host surface has already
 * decided which provider is on screen, so the body renders directly and starts
 * expanded.
 */
export declare function ProviderAdvancedEditor(props: {
    ctx: ClientContext;
    providerId: string;
    configured?: boolean;
    embedded?: boolean;
    /** Reports unsaved edits so the host can refuse to switch providers. */
    onDirtyChange?: (dirty: boolean) => void;
}): ReactNode;
