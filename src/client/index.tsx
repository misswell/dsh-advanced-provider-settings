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
 *  - `ctx.settingsScope.bind({namespace, decode?})` for reads and writes.
 *
 * Nothing here requires `@deepseek-ai/dsh-client-locale` or
 * `@deepseek-ai/dsh-client-ui-settings`: the client module table is a closed
 * seed list, and neither package is on it. They are reached as cordis services
 * instead.
 */
import { PLUGIN_NAMESPACE, PROVIDER_NAMESPACE } from '../shared/capabilities.js'
import { createProviderCardSeat } from './ProviderAdvancedSettings.js'
import { createGlobalSeat } from './GlobalSettingsSection.js'
import { createFooterSeat } from './FooterSeat.js'
import { en } from './locales/en-US.js'
import { zh } from './locales/zh-CN.js'
import { injectStyles } from './styles.js'
import type { ClientContext } from './contract.js'

/** Cordis plugin name; must equal the package name the bundle registers under. */
export const name = PLUGIN_NAMESPACE

/**
 * Services to wait for before `apply` runs.
 *
 * `slots` is the extension registry, `settingsScope` the revision-fenced
 * settings transport, and `locale` the dictionary registry. All three are hard
 * requirements: without any of them this plugin has nothing to contribute.
 */
export const inject = ['slots', 'settingsScope', 'locale']

/** Slot key of the provider-card extension seat declared by the Models section. */
export const PROVIDER_CARD_SLOT = 'settings.models.provider-card'

/** Slot key of the Models page footer seat. */
export const MODELS_FOOTER_SLOT = 'settings.models.footer'

/** Slot key of a settings page contribution. */
export const SETTINGS_SECTION_SLOT = 'settings.section'

/** Settings namespace of the OpenAI-compatible provider family. */
export { PROVIDER_NAMESPACE }

/** Nav position of this plugin's settings page, after the built-in sections. */
const SECTION_ORDER = 60

/**
 * Mount the browser half.
 *
 * @param ctx - the client context, whose services are provided by the settings
 *   and locale plugins this plugin declares as dependencies.
 */
export function apply(ctx: ClientContext): void {
  injectStyles()

  // The locale service returns a disposer; handing it to `ctx.effect` is what
  // releases the dictionaries when this fiber unloads (HMR included). Dropping
  // it would leak a namespace that a reload then cannot re-register.
  ctx.effect(() => ctx.locale.register(PLUGIN_NAMESPACE, { zh, en }), 'advanced-provider-settings: dictionaries')

  // A `label` thunk is re-read on every projection, so the nav entry follows the
  // active locale without the shell subscribing to locale state for us.
  const translate = ctx.locale.bind(PLUGIN_NAMESPACE)

  ctx.slots.inject(PROVIDER_CARD_SLOT, () =>
    ctx.slots.register(
      {
        // `name` is the slot key being contributed into, not a label for this
        // registration: the core resolves it against its declaration table.
        name: PROVIDER_CARD_SLOT,
        // Keyed slots dispatch on the row's owning settings namespace, which is
        // `llm-pi-ai` for every OpenAI-compatible provider card.
        key: PROVIDER_NAMESPACE,
        registrant: PLUGIN_NAMESPACE,
      },
      createProviderCardSeat(ctx),
    ),
  )

  ctx.slots.inject(SETTINGS_SECTION_SLOT, () =>
    ctx.slots.register(
      {
        name: SETTINGS_SECTION_SLOT,
        id: PLUGIN_NAMESPACE,
        order: SECTION_ORDER,
        label: () => translate('global.navLabel'),
        registrant: PLUGIN_NAMESPACE,
      },
      createGlobalSeat(ctx),
    ),
  )

  ctx.slots.inject(MODELS_FOOTER_SLOT, () =>
    ctx.slots.register(
      {
        name: MODELS_FOOTER_SLOT,
        id: `${PLUGIN_NAMESPACE}-footer`,
        order: SECTION_ORDER,
        label: () => translate('plugin.title'),
        registrant: PLUGIN_NAMESPACE,
      },
      createFooterSeat(ctx),
    ),
  )
}
