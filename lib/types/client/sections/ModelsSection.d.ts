/**
 * Per-model configuration (spec sections 29, 30, 40).
 *
 * This is the level the user actually thinks in: a provider is a credential and
 * a URL, but "does THIS model take images" and "what does its `high` map to on
 * the wire" are per-model facts. So the card is a master-detail — pick a model,
 * edit that model — rather than a list of accordions, and it sits above the
 * provider-wide cards instead of trailing them.
 *
 * Harness accepts exactly three fields on a model entry: `input`,
 * `reasoningEfforts` and `compat` (plus `name`/`contextWindow`/`maxTokens`,
 * which belong to the Models page). Anything else written there is rejected by
 * the strict validation a settings write uses, so this editor offers nothing
 * else — and says so, because "I expected a retry setting here" is otherwise
 * unanswerable from the screen.
 *
 * The per-model compat grid is filtered by the ROUTE protocol for the same
 * reason: a field the protocol does not read is a hard error at model level
 * where it is only ignored at route level.
 */
import { type ReactNode } from 'react';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** Render the per-model editor for one provider. */
export declare function ModelsSection(props: {
    t: Translate;
    profile: ProviderProfile;
    disabled: boolean;
    onModelField: (index: number, field: string, value: unknown) => void;
}): ReactNode;
