/**
 * Host-side own-namespace registration.
 *
 * This plugin stores exactly one kind of provider-independent configuration:
 * global request headers, plus its own UI preferences. Everything that
 * describes a PROVIDER stays in Harness's own `llm-pi-ai` namespace, so there
 * is no second copy to drift (spec sections 5, 6).
 *
 * The namespace must be registered Host-side before the browser half can bind
 * to it: `ctx.settingsScope.bind({namespace})` reads the served-namespace
 * directory, and a namespace nobody registered is invisible to the client.
 *
 * The service is described structurally rather than imported as a type, so this
 * module can be exercised without a cordis context.
 */
import z from '@deepseek-ai/schemastery'
import { PLUGIN_NAMESPACE } from '../shared/capabilities.js'
import type { PluginSettings } from '../shared/types.js'

/**
 * Durable schema for this plugin's namespace.
 *
 * Every field is optional and none carries a schema default, so "absent" stays
 * distinguishable from "explicitly set" all the way to the wire — which is what
 * lets the client answer "is this inherited?" without a second marker.
 */
export const PluginSettingsSchema: z<PluginSettings> = z.object({
  globalHeaders: z.dict(z.string()).description('Headers applied to every provider request, below provider headers.'),
  ui: z
    .object({
      advancedExpanded: z.boolean().description('Whether Advanced Settings starts expanded.'),
      acknowledgedAlwaysRetry: z.boolean().description('Whether the Always-retry warning was accepted once.'),
    })
    .description('Interface preferences. Never provider configuration.'),
  migration: z
    .object({
      globalHeaders: z
        .union([z.const('imported'), z.const('ignored')])
        .description('Outcome of the legacy-plugin header migration.'),
      decidedAt: z.string().description('ISO timestamp of the migration decision.'),
    })
    .description('How far the retired plugin migration got.'),
})

/** One namespace as the settings directory reports it. */
export interface SettingsDescriptorLike {
  ns: string
  /** Monotonic revision of the raw user section this descriptor was read at. */
  revision?: number
  /** Raw user section; a field's presence here marks it user-overridden. */
  user?: unknown
}

/** Owner-facing handle returned by `settings.register`. */
export interface SettingsScopeLike<T> {
  get: () => T
  watch: (callback: (next: T, prev: T) => void) => () => void
}

/** The settings service surface this plugin depends on. */
export interface SettingsServiceLike {
  register: (
    namespace: string,
    schema: unknown,
    options?: { validate?: (value: PluginSettings) => void },
  ) => SettingsScopeLike<PluginSettings>
  describe: () => readonly SettingsDescriptorLike[]
  get: (namespace: string) => unknown
  writable?: boolean
}

/** The plugin's own settings scope, as the host half consumes it. */
export interface OwnSettingsHandle {
  /** Current resolved values. */
  get: () => PluginSettings
  /** Subscribe to committed changes; returns a disposer. */
  watch: (callback: (next: PluginSettings, prev: PluginSettings) => void) => () => void
  /** Current raw user layer for this namespace, or undefined when absent. */
  userLayer: () => Record<string, unknown> | undefined
  /** Revision fencing the next write, or undefined when unavailable. */
  revision: () => number | undefined
}

/**
 * Register this plugin's namespace and return a narrow handle over it.
 *
 * Call from inside an effect scope: the registration is owned by the calling
 * fiber, so unloading the plugin removes the namespace and its observers.
 *
 * @param settings - the host settings service.
 * @returns the handle the rest of the host half reads through.
 */
export function registerOwnSettings(settings: SettingsServiceLike): OwnSettingsHandle {
  const scope = settings.register(PLUGIN_NAMESPACE, PluginSettingsSchema)

  const descriptor = (): SettingsDescriptorLike | undefined =>
    settings.describe().find((candidate) => candidate.ns === PLUGIN_NAMESPACE)

  const userLayer = (): Record<string, unknown> | undefined => {
    const user = descriptor()?.user
    if (user === undefined || user === null || typeof user !== 'object' || Array.isArray(user)) return undefined
    return user as Record<string, unknown>
  }

  const revision = (): number | undefined => {
    const value = descriptor()?.revision
    return typeof value === 'number' ? value : undefined
  }

  return {
    get: () => scope.get() ?? {},
    watch: (callback) => scope.watch(callback),
    userLayer,
    revision,
  }
}
