/**
 * Browser half entry point.
 *
 * Registration is the entire job: this plugin adds UI through the Models page's
 * declared extension seats rather than by touching its DOM, and stores
 * configuration through the framework's revision-fenced settings transport
 * rather than through a private channel (spec sections 4, 40, 71).
 *
 * Three seams are used, and only these three:
 *
 *  - `ctx.slots.inject(key, …)` because a slot only exists once the entry that
 *    declares it has registered. A direct `slots.register` call throws when the
 *    slot is not yet declared, so the inject wrapper is not optional.
 *  - `ctx.slots.register(options, Component)`, where `options.name` is the
 *    TARGET SLOT KEY and the kind shape fields follow from that slot's
 *    declaration (`key` for keyed, `id`/`order`/`label` for list).
 *  - `ctx.configForms.get(entryId)` for reads and `ctx.remote.settings.mutate`
 *    for the revision-fenced writes, both over the shell's single describe
 *    mirror.
 *
 * Nothing here requires `@deepseek-ai/dsh-client-locale` or
 * `@deepseek-ai/dsh-client-ui-settings`: the client module table is a closed
 * seed list, and neither package is on it. They are reached as cordis services
 * instead.
 */
import { PROVIDER_NAMESPACE } from '../shared/capabilities.js';
import type { ClientContext } from './contract.js';
/** Cordis plugin name; must equal the package name the bundle registers under. */
export declare const name = "dsh-advanced-provider-settings";
/**
 * Services to wait for before `apply` runs.
 *
 * `slots` is the extension registry and `locale` the dictionary registry.
 * `configForms` is the settings read transport and `remote.settings` its write
 * half — both hard requirements: without them this plugin can show a page but
 * change nothing, which is worse than showing nothing.
 */
export declare const inject: string[];
/** Slot key of the provider-card extension seat declared by the Models section. */
export declare const PROVIDER_CARD_SLOT = "settings.models.provider-card";
/** Slot key of the Models page footer seat. */
export declare const MODELS_FOOTER_SLOT = "settings.models.footer";
/** Slot key of a settings page contribution. */
export declare const SETTINGS_SECTION_SLOT = "settings.section";
/** Settings namespace of the OpenAI-compatible provider family. */
export { PROVIDER_NAMESPACE };
/**
 * Mount the browser half.
 *
 * @param ctx - the client context, whose services are provided by the settings
 *   and locale plugins this plugin declares as dependencies.
 */
export declare function apply(ctx: ClientContext): void;
