/**
 * Per-model configuration (spec sections 29, 30, 40).
 *
 * This is the level the user actually thinks in: a provider is a credential and
 * a URL, but "does THIS model take images" and "what does its `high` map to on
 * the wire" are per-model facts. So the card is a master-detail — pick a model,
 * edit that model — rather than a list of accordions, and it sits above the
 * provider-wide cards instead of trailing them.
 *
 * There are two channels, and the profile decides which one is in play:
 *
 *  - A non-empty `models` list REPLACES the served catalog, so its entries are
 *    the models. They are edited in place, addressed by index.
 *  - A route with no `models` list serves the INSTALLED CATALOG, and the only
 *    per-model channel left is `modelOverrides.<id>` — keyed by model id, which
 *    is why the model list itself has to come from the host (`catalog-models`).
 *    Harness refuses an id the catalog does not describe.
 *
 * The two channels carry different field sets, and that is the schema's doing,
 * not a UI simplification. On a `models` entry the Models page already edits
 * identity and capacity (`name`, `contextWindow`, `maxTokens`), so only the
 * three advanced fields appear here. A `modelOverrides` entry has no other
 * editor at all, so all six fields appear — leaving them out would make the
 * finest level the schema offers unreachable.
 *
 * The per-model compat grid is filtered by the model's protocol: a field the
 * protocol does not read is a hard error at model level where it is only
 * ignored at route level.
 */
import { type ReactNode } from 'react';
import type { Translate } from '../contract.js';
import type { ProviderProfile } from '../../shared/types.js';
/** Render the per-model editor for one provider. */
export declare function ModelsSection(props: {
    t: Translate;
    /** Route id, the key the catalog listing is asked under. */
    providerId: string;
    profile: ProviderProfile;
    disabled: boolean;
    onModelField: (index: number, field: string, value: unknown) => void;
    onModelOverrideField: (modelId: string, field: string, value: unknown) => void;
}): ReactNode;
