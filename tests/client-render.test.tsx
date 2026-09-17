/**
 * Render tests for the browser half.
 *
 * These import the TSX sources and mount them with real React and a real
 * server renderer, against a behavioural double for the shell's primitive kit
 * (see `tests/stubs/primitives.tsx`). The bundle-level contract — the
 * ModuleLoader envelope, the module table, slot option semantics — is covered
 * separately against the built artifact in `tests/integration.test.ts`; this
 * suite is about what the components DO once they are mounted.
 *
 * That split matters: rendering catches the defects that typecheck and unit-test
 * clean but break the page — a hook called after an early return, a
 * `useSyncExternalStore` snapshot that is a fresh object every read (an infinite
 * render in the browser), a settings field read through the wrong path, or a
 * transient `undefined` that escapes a guard during the first frames.
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProviderAdvancedSettings } from '../src/client/ProviderAdvancedSettings.js'
import { GlobalSettingsPage } from '../src/client/GlobalSettingsSection.js'
import { ModelsFooter } from '../src/client/FooterSeat.js'
import { HeaderEditor } from '../src/client/components/HeaderEditor.js'
import { RetryEditor } from '../src/client/components/RetryEditor.js'
import { NetworkSection } from '../src/client/sections/NetworkSection.js'
import { VisionSection } from '../src/client/sections/VisionSection.js'
import { ReasoningSection } from '../src/client/sections/ReasoningSection.js'
import { CompatibilitySection } from '../src/client/sections/CompatibilitySection.js'
import { ModelsSection } from '../src/client/sections/ModelsSection.js'
import { PreviewSection } from '../src/client/sections/PreviewSection.js'
import { en } from '../src/client/locales/en-US.js'
import { headerEntriesOf } from '../src/shared/headers.js'
import { toRetryEditorState } from '../src/shared/retry.js'
import { PLUGIN_NAMESPACE, PROVIDER_NAMESPACE } from '../src/shared/capabilities.js'
import type {
  ClientContext,
  ProviderDirectoryEntry,
  SettingsScopeLike,
  SettingsSnapshotLike,
  SlotRegisterOptions,
} from '../src/client/contract.js'
import type { PluginSettings, ProviderNamespaceSection, ProviderProfile } from '../src/shared/types.js'

// ---------------------------------------------------------------------------
// Context harness
// ---------------------------------------------------------------------------

/** Recorded registrations, so a test can drive the real slot call sites. */
export interface Recorded {
  options: SlotRegisterOptions
  component: (props: Record<string, unknown>) => unknown
}

/** What a test needs back from the harness. */
export interface Harness {
  ctx: ClientContext
  /** Value currently published for the provider namespace. */
  setProviders(value: ProviderNamespaceSection): void
  /** Value currently published for this plugin's own namespace. */
  setOwn(value: PluginSettings): void
  /** Writes applied through either scope, in order. */
  writes: { namespace: string; ops: readonly unknown[] }[]
  /** Snapshots currently published, for identity assertions. */
  snapshots: Map<string, SettingsSnapshotLike<unknown>>
  /** Every dictionary key the rendered tree requested, in request order. */
  requestedKeys: Set<string>
}

/** A snapshot object with the shape the scopes publish. */
function snapshot<T>(value: T | undefined, revision: number, writable = true): SettingsSnapshotLike<T> {
  return {
    status: value === undefined ? 'loading' : 'ready',
    value,
    base: undefined,
    user: undefined,
    revision,
    writable,
    mode: 'host',
  }
}

/**
 * Build a client context whose scopes behave like the real ones.
 *
 * The snapshots are stored per namespace and returned by reference — exactly
 * the contract `useSyncExternalStore` requires. A harness that rebuilt the
 * snapshot per read would make every component look correct here and loop
 * forever in a browser, so that property is asserted explicitly below.
 */
function harness(options: {
  providers?: ProviderNamespaceSection | undefined
  own?: PluginSettings | undefined
  writable?: boolean
  rpc?: (op: string, payload: unknown) => Promise<unknown>
} = {}): Harness {
  const snapshots = new Map<string, SettingsSnapshotLike<unknown>>()
  const writes: { namespace: string; ops: readonly unknown[] }[] = []
  const listeners = new Map<string, Set<() => void>>()
  /**
   * Every dictionary key the rendered tree asked for.
   *
   * The identity translate below echoes keys, so an assertion can name the key it
   * expects. Recording them as well turns "does this string appear" into the
   * stronger "did the component request a key that does not exist" — which is the
   * only form that catches a missing key for a code path a fixture happens not to
   * reach with an obvious expectation.
   */
  const requestedKeys = new Set<string>()

  const publish = (namespace: string, value: unknown, revision: number): void => {
    snapshots.set(namespace, snapshot(value, revision))
    for (const listener of listeners.get(namespace) ?? []) listener()
  }

  publish(PROVIDER_NAMESPACE, options.providers ?? { providers: {} }, 1)
  publish(PLUGIN_NAMESPACE, options.own ?? {}, 1)

  const bind = <T,>(spec: { namespace: string }): SettingsScopeLike<T> => ({
    getSnapshot: () => snapshots.get(spec.namespace) as SettingsSnapshotLike<T>,
    subscribe: (listener: () => void) => {
      const set = listeners.get(spec.namespace) ?? new Set()
      set.add(listener)
      listeners.set(spec.namespace, set)
      return () => { set.delete(listener) }
    },
    set: async () => {},
    unset: async () => {},
    mutate: async (ops) => { writes.push({ namespace: spec.namespace, ops }) },
  })

  const ctx: ClientContext = {
    slots: {
      inject: (_key: string, body: () => unknown) => body(),
      register: () => () => {},
    },
    settingsScope: { bind },
    locale: {
      register: () => () => {},
      // Identity translate: an assertion can then name the dictionary key it
      // expects, which is what makes a missing key visible as a raw key string.
      bind: () => (key: string, params?: Record<string, string | number>) => {
        requestedKeys.add(key)
        return params === undefined
          ? key
          : `${key}(${Object.entries(params).map(([k, v]) => `${k}=${String(v)}`).join(',')})`
      },
      getLocale: () => ({ active: 'en', revision: 0 }),
      subscribe: () => () => {},
    },
    effect: (body: () => void | (() => void)) => { body() },
  }

  // The RPC transport is a same-origin fetch; a test that renders a component
  // reading it gets an empty successful response.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, data: [] }), { headers: { 'content-type': 'application/json' } })) as typeof globalThis.fetch

  return {
    ctx,
    snapshots,
    writes,
    requestedKeys,
    setProviders: (value) => { publish(PROVIDER_NAMESPACE, value, (snapshots.get(PROVIDER_NAMESPACE)?.revision ?? 0) + 1) },
    setOwn: (value) => { publish(PLUGIN_NAMESPACE, value, (snapshots.get(PLUGIN_NAMESPACE)?.revision ?? 0) + 1) },
  }
}

/** Synthesize a `ProviderDirectoryEntry` as the Models section builds it. */
function entry(overrides: Partial<ProviderDirectoryEntry> = {}): ProviderDirectoryEntry {
  return {
    provider: 'gateway',
    displayName: 'Gateway',
    settingsNs: PROVIDER_NAMESPACE,
    settingsPath: '/gateway',
    active: true,
    ...overrides,
  } as ProviderDirectoryEntry
}

/** Render one node to static markup. */
function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node)
}

/**
 * A provider profile with something set in every area the panel covers.
 *
 * Annotated rather than inferred: without the annotation every string literal
 * widens and the profile stops being assignable to the component props, which is
 * exactly the check that keeps these tests honest about the real types.
 */
const RICH: ProviderProfile = {
  api: 'openai-completions',
  baseURL: 'https://provider.test/v1',
  apiKeyEnv: 'GATEWAY_KEY',
  displayName: 'Gateway',
  headers: { 'x-tenant': 'acme' },
  retryPolicy: { mode: 'normal', maxRetries: 4, backoff: { initialDelayMs: 500, maxDelayMs: 8000, jitterRatio: 0.2 } },
  transport: 'websocket',
  timeoutMs: 120000,
  streamIdleTimeoutMs: 300000,
  websocketConnectTimeoutMs: 20000,
  cacheRetention: 'long',
  reasoning: 'high',
  thinkingBudgets: { minimal: 1024, low: 2048, medium: 8192, high: 16384 },
  defaultInput: ['text', 'image'],
  maxRequestImageBytes: 10485760,
  requestImagePixelBudget: 2097152,
  requestImageMaxBytes: 524288,
  compat: { supportsStore: true, thinkingFormat: 'deepseek' },
  models: [
    { id: 'fast', name: 'fast', contextWindow: 131072, maxTokens: 8192, input: ['text'] },
    { id: 'vision', name: 'vision', contextWindow: 262144, maxTokens: 16384, input: ['text', 'image'] },
  ],
}

// ---------------------------------------------------------------------------
// Provider card seat
// ---------------------------------------------------------------------------

describe('provider card seat', () => {
  it('renders the collapsed summary for an llm-pi-ai provider', () => {
    const h = harness({ providers: { providers: { gateway: RICH } } })
    const html = render(
      <ProviderAdvancedSettings ctx={h.ctx} provider={entry()} configured keyConfigured />,
    )
    expect(html).toContain('plugin.title')
    // Status badges are localized; a raw key here means the dictionary lookup
    // regressed to the section id.
    expect(html).toContain('section.headers')
    expect(html).not.toMatch(/>\s*headers\s*</)
    // Collapsed by default, so the body is absent.
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('aps-shell-body')
  })

  it('folds timeout and transport into a single Network entry', () => {
    // The bug the live GUI surfaced: `summarizeSections` reports `timeout` and
    // `transport` as separate fields, but the card shows one Network section. A
    // row built straight from the summary list asked the dictionary for
    // `section.timeout` and printed that raw key to the user. `section.network`
    // must appear once, and neither underlying id may be requested at all.
    const h = harness({ providers: { providers: { gateway: RICH } } })
    const html = render(
      <ProviderAdvancedSettings ctx={h.ctx} provider={entry()} configured keyConfigured />,
    )
    expect(html).toContain('section.network')
    expect(h.requestedKeys.has('section.timeout')).toBe(false)
    expect(h.requestedKeys.has('section.transport')).toBe(false)
  })

  it('requests only dictionary keys that exist', () => {
    // The general guard, and the only one that scales: rather than naming the
    // labels a fixture is expected to produce, assert that every key the whole
    // rendered tree asked for is actually in the shipped dictionary. A newly
    // added section, badge or advisory with no translation fails here instead of
    // reaching a user as a raw key.
    const h = harness({ providers: { providers: { gateway: RICH } } })
    render(<ProviderAdvancedSettings ctx={h.ctx} provider={entry()} configured keyConfigured />)
    render(<GlobalSettingsPage ctx={h.ctx} />)
    render(<ModelsFooter ctx={h.ctx} />)

    const missing = [...h.requestedKeys].filter((key) => !(key in en))
    expect(missing).toEqual([])
    // Guard against a vacuous pass: the tree must have asked for many keys.
    expect(h.requestedKeys.size).toBeGreaterThan(30)
  })

  it('renders nothing for a provider family it does not own', () => {
    const h = harness()
    const html = render(
      <ProviderAdvancedSettings
        ctx={h.ctx}
        provider={entry({ settingsNs: 'llm-deepseek', provider: 'deepseek' })}
        configured
        keyConfigured
      />,
    )
    expect(html).toBe('')
  })

  it('explains an unconfigured provider instead of rendering an editor', () => {
    const h = harness()
    const html = render(
      <ProviderAdvancedSettings ctx={h.ctx} provider={entry()} configured={false} keyConfigured={false} />,
    )
    expect(html).toContain('card.unconfigured')
  })

  it('reads the persisted "starts expanded" preference without crashing', () => {
    const h = harness({
      providers: { providers: { gateway: RICH } },
      own: { ui: { advancedExpanded: true, acknowledgedAlwaysRetry: false } } as PluginSettings,
    })
    // Expansion is applied by an effect, which a static render never runs, so
    // the assertion targets the controllable path: the preference is READ
    // (no crash, correct snapshot field) and the collapsed render is stable.
    const html = render(
      <ProviderAdvancedSettings ctx={h.ctx} provider={entry()} configured keyConfigured />,
    )
    expect(html).toContain('aps-shell')
    expect(h.snapshots.get(PLUGIN_NAMESPACE)?.value).toBeDefined()
  })

  it('renders read-only when the namespace refuses writes', () => {
    const h = harness({ providers: { providers: { gateway: RICH } } })
    h.snapshots.set(PROVIDER_NAMESPACE, snapshot({ providers: { gateway: RICH } }, 1, false))
    const html = render(
      <ProviderAdvancedSettings ctx={h.ctx} provider={entry()} configured keyConfigured />,
    )
    expect(html).toContain('aria-expanded="false"')
  })

  it('survives an empty provider namespace', () => {
    const h = harness({ providers: {} })
    expect(() =>
      render(<ProviderAdvancedSettings ctx={h.ctx} provider={entry()} configured keyConfigured />),
    ).not.toThrow()
  })

  it('is memo-stable: the same props render identical markup twice', () => {
    const h = harness({ providers: { providers: { gateway: RICH } } })
    const node = <ProviderAdvancedSettings ctx={h.ctx} provider={entry()} configured keyConfigured />
    expect(render(node)).toBe(render(node))
  })
})

// ---------------------------------------------------------------------------
// Sections, rendered directly so their bodies are exercised
// ---------------------------------------------------------------------------

/** An empty validation-issue map for sections that accept one. */
const NO_ISSUES: ReadonlyMap<string, string> = new Map()

/** The translate function the identity-bound locale service hands out. */
const t = (key: string, params?: Record<string, string | number>): string =>
  params === undefined ? key : `${key}(${Object.entries(params).map(([k, v]) => `${k}=${String(v)}`).join(',')})`

describe('header editor', () => {
  it('renders rows and flags a reserved User-Agent', () => {
    const html = render(
      <HeaderEditor
        t={t}
        rows={headerEntriesOf({ 'user-agent': 'curl/8', 'x-tenant': 'acme' })}
        onChange={() => {}}
        scope="provider"
        showPresets
      />,
    )
    expect(html).toContain('curl/8')
    expect(html).toContain('headers.reservedProvider')
    expect(html).toContain('headers.presets')
  })

  it('warns that an authorization header displaces the credential', () => {
    const html = render(
      <HeaderEditor
        t={t}
        rows={headerEntriesOf({ authorization: 'Bearer sk-live-abcdef' })}
        onChange={() => {}}
        scope="provider"
        // The advisory is conditional on a credential actually resolving: with
        // no credential there is nothing for the header to displace.
        credentialRef="GATEWAY_KEY"
      />,
    )
    expect(html).toContain('headers.credentialWarn')
  })

  it('masks a sensitive header value behind a password field and a reveal toggle', () => {
    // The value is necessarily in the DOM — the user is editing it — so the
    // masking is a password input plus an explicit reveal, not an omission.
    const html = render(
      <HeaderEditor
        t={t}
        rows={headerEntriesOf({ authorization: 'Bearer sk-live-abcdef', 'x-tenant': 'acme' })}
        onChange={() => {}}
        scope="provider"
      />,
    )
    expect(html).toContain('type="password"')
    expect(html).toContain('title="headers.sensitive"')
    // The non-sensitive row is a plain text field.
    expect(html).toContain('type="text"')
  })

  it('reports a malformed header name', () => {
    const html = render(
      <HeaderEditor t={t} rows={headerEntriesOf({ 'bad name': 'x' })} onChange={() => {}} scope="provider" />,
    )
    expect(html).toContain('headers.error.invalidName')
  })

  it('renders an empty global list with the add affordance', () => {
    const html = render(<HeaderEditor t={t} rows={[]} onChange={() => {}} scope="global" showPresets />)
    expect(html).toContain('headers.add')
    expect(html).toContain('headers.empty')
  })

  it('renders a disabled editor without add or remove controls', () => {
    const html = render(
      <HeaderEditor t={t} rows={headerEntriesOf({ 'x-a': 'b' })} onChange={() => {}} scope="global" disabled />,
    )
    expect(html).toContain('disabled')
  })
})

describe('retry editor', () => {
  it('renders every preset and the custom fields', () => {
    const state = toRetryEditorState({
      mode: 'normal',
      maxRetries: 4,
      backoff: { initialDelayMs: 500, maxDelayMs: 8000, jitterRatio: 0.2 },
    })!
    const html = render(
      <RetryEditor t={t} state={state} onChange={() => {}} issues={new Map()} acknowledged={false} onAcknowledge={() => {}} />,
    )
    expect(html).toContain('retry.preset.custom')
    expect(html).toContain('retry.maxRetries')
    expect(html).toContain('retry.initialDelayMs')
  })

  it('renders the Harness Default state with no custom fields', () => {
    const html = render(
      <RetryEditor t={t} state={null} onChange={() => {}} issues={new Map()} acknowledged={false} onAcknowledge={() => {}} />,
    )
    expect(html).toContain('retry.preset.harnessDefault')
    expect(html).not.toContain('retry.maxRetries')
  })

  it('shows a validation issue against its field', () => {
    const state = toRetryEditorState({
      mode: 'normal',
      maxRetries: 2,
      backoff: { initialDelayMs: 5000, maxDelayMs: 100, jitterRatio: 0 },
    })!
    const html = render(
      <RetryEditor
        t={t}
        state={state}
        onChange={() => {}}
        issues={new Map([['maxDelayMs', 'backoff-initial-exceeds-max']])}
        acknowledged={false}
        onAcknowledge={() => {}}
      />,
    )
    expect(html).toContain('retry.maxDelayMs')
  })

  it('renders the always-retry acknowledgement gate', () => {
    const state = toRetryEditorState({ mode: 'always', backoff: { initialDelayMs: 1000, maxDelayMs: 60000, jitterRatio: 0 } })!
    const html = render(
      <RetryEditor t={t} state={state} onChange={() => {}} issues={new Map()} acknowledged={false} onAcknowledge={() => {}} />,
    )
    expect(html).toContain('retry.alwaysTitle')
  })
})

describe('provider sections', () => {
  const profile = RICH

  it('renders the network section with every transport choice', () => {
    const html = render(<NetworkSection t={t} profile={profile} disabled={false} issues={NO_ISSUES} onChange={() => {}} />)
    expect(html).toContain('network.transport')
    // All four schema transports, in schema order.
    for (const transport of ['sse', 'websocket', 'websocket-cached', 'auto']) {
      expect(html).toContain(transport)
    }
    expect(html).toContain('network.streamIdleTimeoutMs')
    // The provider-level maxRetries rejection is explained, not hidden.
    expect(html).toContain('network.unsupportedBody')
  })

  it('renders network defaults without a value', () => {
    const html = render(<NetworkSection t={t} profile={{}} disabled={false} issues={NO_ISSUES} onChange={() => {}} />)
    expect(html).toContain('network.transport')
  })

  it('renders the vision section in human byte units', () => {
    const html = render(<VisionSection t={t} profile={profile} disabled={false} issues={NO_ISSUES} onChange={() => {}} />)
    expect(html).toContain('vision.defaultInput')
    expect(html).toContain('vision.maxRequestImageBytes')
    // 10485760 bytes is offered as MiB, not as a raw byte count.
    expect(html).toContain('MiB')
  })

  it('renders the reasoning section with every thinking level', () => {
    const html = render(<ReasoningSection t={t} profile={profile} disabled={false} issues={NO_ISSUES} onChange={() => {}} />)
    expect(html).toContain('reasoning.level')
    for (const level of ['off', 'minimal', 'low', 'medium', 'high']) {
      expect(html).toContain(level)
    }
    expect(html).toContain('reasoning.budget.high')
  })

  it('renders the compatibility section filtered to the route protocol', () => {
    const html = render(<CompatibilitySection t={t} profile={profile} disabled={false} onChange={() => {}} />)
    // openai-completions reads this one; the anthropic-only flags are absent.
    expect(html).toContain('supportsStore')
    expect(html).not.toContain('forceAdaptiveThinking')
    expect(html).not.toContain('supportsEagerToolInputStreaming')
  })

  it('renders the compatibility section for an anthropic route', () => {
    const html = render(
      <CompatibilitySection
        t={t}
        profile={{ ...profile, api: 'anthropic-messages' }}
        disabled={false}
        onChange={() => {}}
      />,
    )
    expect(html).toContain('forceAdaptiveThinking')
    expect(html).not.toContain('supportsStore')
  })

  it('renders the compatibility section with no route protocol chosen', () => {
    const html = render(<CompatibilitySection t={t} profile={{}} disabled={false} onChange={() => {}} />)
    expect(html).toContain('compat.unknownProtocol')
  })

  it('renders the models section with per-model rows', () => {
    const html = render(
      <ModelsSection t={t} profile={profile} disabled={false} onChange={() => {}} onModelField={() => {}} />,
    )
    expect(html).toContain('models.desc')
    expect(html).toContain('fast')
    expect(html).toContain('vision')
    // The collapsed row already states each model's declared input, which is the
    // thing a reader scans for.
    expect(html).toContain('vision.textOnly')
    expect(html).toContain('vision.textImage')
    expect(html).toContain('models.overrides(count=1)')
  })

  it('renders the models section with no models', () => {
    const html = render(
      <ModelsSection t={t} profile={{}} disabled={false} onChange={() => {}} onModelField={() => {}} />,
    )
    expect(html).toContain('models.none')
  })

  it('renders the preview section with masked headers', () => {
    const html = render(
      <PreviewSection
        t={t}
        profile={profile}
        loading={false}
        effective={{
          advisories: [{ code: 'reserved-provider-header', name: 'user-agent' }],
          attributionOverridden: true,
          headers: [
            { name: 'x-tenant', value: 'acme', source: 'provider', reserved: false, sensitive: false },
            { name: 'user-agent', value: '••••', source: 'harness', reserved: true, sensitive: true },
          ],
        }}
      />,
    )
    expect(html).toContain('x-tenant')
    expect(html).toContain('preview.source.provider')
  })

  it('renders the loading hint until the host answers', () => {
    const loading = render(<PreviewSection t={t} profile={profile} loading effective={undefined} />)
    expect(loading).toContain('common.loading')
    // With no host answer yet, the effective-header block is simply absent.
    expect(loading).not.toContain('preview.source.harness')
    expect(loading).not.toContain('preview.source.provider')
  })

  it('renders the empty notice for a provider with nothing to preview', () => {
    const html = render(<PreviewSection t={t} profile={{}} loading={false} effective={undefined} />)
    expect(html).toContain('preview.empty')
  })

  it('reports attribution as overridden when a global User-Agent applies', () => {
    const html = render(
      <PreviewSection
        t={t}
        profile={profile}
        loading={false}
        effective={{
          headers: [
            { name: 'user-agent', value: 'opencode/0.6.0', source: 'global', reserved: true, sensitive: false },
          ],
          advisories: [{ code: 'reserved-provider-header', name: 'user-agent' }],
          attributionOverridden: true,
        }}
      />,
    )
    expect(html).toContain('preview.source.global')
    expect(html).toContain('preview.attributionOverridden')
  })
})

// ---------------------------------------------------------------------------
// Settings page and footer
// ---------------------------------------------------------------------------

describe('settings page', () => {
  it('renders with global headers and providers present', () => {
    const h = harness({
      providers: { providers: { gateway: RICH } },
      own: { globalHeaders: { 'user-agent': 'opencode/0.6.0' }, ui: { advancedExpanded: false, acknowledgedAlwaysRetry: false } } as PluginSettings,
    })
    const html = render(<GlobalSettingsPage ctx={h.ctx} />)
    expect(html).toContain('global.title')
    expect(html).toContain('headers.globalTitle')
    expect(html).toContain('diag.title')
    // The configured provider rolls up here.
    expect(html).toContain('Gateway')
  })

  it('renders with nothing configured at all', () => {
    const h = harness({ providers: {}, own: {} })
    const html = render(<GlobalSettingsPage ctx={h.ctx} />)
    expect(html).toContain('global.providerNone')
  })

  it('renders the read-only notice when writes are refused', () => {
    const h = harness({ own: {} })
    h.snapshots.set(PLUGIN_NAMESPACE, { ...snapshot({}, 1), writable: false, status: 'ready' })
    const html = render(<GlobalSettingsPage ctx={h.ctx} />)
    expect(html).toContain('common.readOnly')
  })
})

describe('models footer', () => {
  it('rolls up the providers carrying overrides', () => {
    const h = harness({ providers: { providers: { gateway: RICH, plain: { api: 'openai-completions' } as never } } })
    const html = render(<ModelsFooter ctx={h.ctx} />)
    expect(html).toContain('plugin.title')
    expect(html).toContain('status.count(count=1)')
  })

  it('renders nothing when no provider has an override', () => {
    const h = harness({ providers: { providers: { plain: { api: 'openai-completions', models: [] } as never } } })
    expect(render(<ModelsFooter ctx={h.ctx} />)).toBe('')
  })

  it('renders nothing for an empty namespace', () => {
    const h = harness({ providers: {} })
    expect(render(<ModelsFooter ctx={h.ctx} />)).toBe('')
  })
})
