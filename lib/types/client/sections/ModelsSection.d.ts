/**
 * Models section: the per-model fields this plugin owns (spec sections 29, 30, 40).
 *
 * Only `input` and `reasoningEfforts` are editable — everything else about a
 * model (its id, context window, output limit) belongs to the Models page, so
 * the editor addresses models by index and never reorders or renames them.
 *
 * The per-model compat grid is filtered by the ROUTE protocol because a
 * mismatched field here is a hard error in Harness rather than a no-op.
 */
import { type ReactNode } from 'react';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** Render the Models section body. */
export declare function ModelsSection(props: {
    t: Translate;
    profile: ProviderProfile;
    disabled: boolean;
    onChange: (field: string, value: unknown) => void;
    onModelField: (index: number, field: string, value: unknown) => void;
}): ReactNode;
