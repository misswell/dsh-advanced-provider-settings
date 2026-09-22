/**
 * Host-side own-namespace configuration.
 *
 * This plugin stores exactly one kind of provider-independent configuration:
 * global request headers, plus its own UI preferences. Everything that
 * describes a PROVIDER stays in Harness's own `llm-pi-ai` namespace, so there
 * is no second copy to drift (spec sections 5, 6).
 *
 * Since DSH 0.1.7 a plugin's settings ARE its entry `Config`: the settings
 * service derives a namespace from the schema of a profile entry, keyed by that
 * entry's id ({@link PLUGIN_SETTINGS_NS}). There is no registration call any
 * more, and a field the schema does not mark `.volatile()` is invisible to the
 * browser — the host refuses such a write before it reaches the document, and
 * an entry with no volatile field at all gets no namespace to write to.
 *
 * The service is described structurally rather than imported as a type, so this
 * module can be exercised without a cordis context.
 */
import z from '@deepseek-ai/schemastery'
import type { MigrationState, PluginSettings, PluginUiSettings } from '../shared/types.js'

/**
 * Durable schema for this plugin's entry config.
 *
 * Every field is optional and none carries a schema default, so "absent" stays
 * distinguishable from "explicitly set" all the way to the wire — which is what
 * lets the client answer "is this inherited?" without a second marker. Adding a
 * default here would silently turn "never configured" into "configured".
 */
export const PluginSettingsConfig = z.object({
  globalHeaders: z
    .dict(z.string())
    .volatile()
    .description('Headers applied to every provider request, below provider headers.'),
  ui: z
    .object({
      advancedExpanded: z.boolean().description('Whether Advanced Settings starts expanded.'),
      acknowledgedAlwaysRetry: z.boolean().description('Whether the Always-retry warning was accepted once.'),
    })
    .volatile()
    .description('Interface preferences. Never provider configuration.'),
  migration: z
    .object({
      globalHeaders: z
        .union([z.const('imported'), z.const('ignored')])
        .description('Outcome of the legacy-plugin header migration.'),
      decidedAt: z.string().description('ISO timestamp of the migration decision.'),
    })
    .volatile()
    .description('How far the retired plugin migration got.'),
})

/** One `.volatile()` field as cordis hands the config to `apply`: a live reader. */
export interface VolatileField<T> {
  /** @returns the field's current resolved value, or undefined when unset. */
  get: () => T | undefined
}

/** This plugin's resolved entry config, as `apply(ctx, config)` receives it. */
export interface OwnConfig {
  globalHeaders: VolatileField<Record<string, string>>
  ui: VolatileField<PluginUiSettings>
  migration: VolatileField<MigrationState>
}

/** One namespace as the settings directory reports it. */
export interface SettingsDescriptorLike {
  ns: string
  /** Monotonic revision of the entry config this descriptor was read at. */
  revision?: number
  /** Resolved form values; present only when the entry has a volatile form. */
  value?: unknown
  /** Raw user layer; a field's presence here marks it user-overridden. */
  user?: unknown
  /** Whether the settings service would still generate a page for this entry. */
  autoGenerate?: boolean
}

/** The settings service surface this plugin depends on. */
export interface SettingsServiceLike {
  describe: (options?: { redactSecrets?: boolean }) => readonly SettingsDescriptorLike[]
  /** Page policy for an entry. Returns the disposer removing it. */
  configure: (presentation: { auto?: boolean }, owner?: unknown) => () => void
  writable?: boolean
}

/**
 * Resolve this plugin's own settings from its live entry config.
 *
 * Read per call rather than cached: a volatile field reports whatever the
 * document says right now, which is why the header bridge picks up a write made
 * from another window without subscribing to anything.
 *
 * @param config - the resolved entry config cordis passed to `apply`.
 * @returns the settings as the rest of the host half and the RPC routes read them.
 */
export function ownSettingsOf(config: OwnConfig): PluginSettings {
  return {
    globalHeaders: config.globalHeaders.get(),
    ui: config.ui.get(),
    migration: config.migration.get(),
  }
}

/**
 * Find one namespace in the settings directory.
 *
 * @param settings - the host settings service.
 * @param namespace - the profile entry id to look for.
 * @returns the descriptor, or undefined when that entry exposes no settings form.
 */
export function namespaceDescriptor(
  settings: SettingsServiceLike,
  namespace: string,
): SettingsDescriptorLike | undefined {
  return settings.describe().find((candidate) => candidate.ns === namespace)
}

/** The namespaces this deployment exposes as configurable settings. */
export function servedNamespaces(settings: SettingsServiceLike): string[] {
  return settings.describe().map((descriptor) => descriptor.ns)
}

/** One namespace's resolved config, or undefined when it is not served. */
export function namespaceValue(settings: SettingsServiceLike, namespace: string): unknown {
  return namespaceDescriptor(settings, namespace)?.value
}
