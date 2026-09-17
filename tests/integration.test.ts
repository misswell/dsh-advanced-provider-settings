/**
 * Integration tests against the BUILT artifacts (spec sections 74, 87).
 *
 * These load `lib/index.js` and `lib/client.js` — the exact files that ship —
 * rather than the TypeScript sources. That matters because the failures this
 * suite is looking for (a host import that does not resolve in the DSH
 * environment, a client bundle that requires a module the shell does not seed, a
 * factory that throws at materialization) only exist after bundling.
 *
 * The host side is imported for real, so `@deepseek-ai/schemastery` and
 * `node:async_hooks` must resolve exactly as they do inside DSH. The client side
 * is evaluated in a `vm` context with a stubbed module table, which is the
 * closest an out-of-browser test can get to `window.__ModuleLoader__`.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

/** The nine specifiers the web shell seeds, per its inlined platform table. */
const PLATFORM_SEEDS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

// ---------------------------------------------------------------------------
// Host half
// ---------------------------------------------------------------------------

/** A fake settings service recording what was registered. */
function fakeSettings() {
  const watchers: ((next: unknown, prev: unknown) => void)[] = []
  const registered: string[] = []
  let value: Record<string, unknown> = {}
  return {
    registered,
    register(namespace: string, _schema: unknown) {
      registered.push(namespace)
      return {
        get: () => value,
        watch(callback: (next: unknown, prev: unknown) => void) {
          watchers.push(callback)
          return () => { watchers.splice(watchers.indexOf(callback), 1) }
        },
      }
    },
    describe: () => [
      { ns: 'dsh-advanced-provider-settings', revision: 1, user: {} },
      { ns: 'llm-pi-ai', revision: 1, user: {} },
    ],
    get: (namespace: string) => (namespace === 'dsh-advanced-provider-settings' ? value : undefined),
    writable: true,
    /** Test hook. */
    set(next: Record<string, unknown>) { value = next },
    notify() { for (const watcher of watchers) watcher(value, value) },
  }
}

/** A log sink the tests can assert on. */
type LogSpy = { mock: { calls: unknown[][] } }

/** A fake cordis context capturing effects and listeners. */
function fakeHostContext(options: { webServer?: boolean } = {}) {
  const logger = { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }
  const settings = fakeSettings()
  const effects: (() => void)[] = []
  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()
  const routes: { kind: string; path: string }[] = []

  const services: Record<string, unknown> = {
    settings,
    llm: { discoverModels: async () => [] },
    logger,
  }
  if (options.webServer === true) {
    services.webServer = {
      register(spec: { kind: string; path: string }) {
        routes.push({ kind: spec.kind, path: spec.path })
        return () => { routes.splice(routes.indexOf(spec as never), 1) }
      },
    }
  }

  return {
    settings,
    logger,
    routes,
    effects,
    listeners,
    ctx: {
      settings,
      llm: services.llm,
      logger,
      get: (service: string) => services[service],
      effect: (body: () => void | (() => void)) => {
        const dispose = body()
        if (typeof dispose === 'function') effects.push(dispose)
      },
      on: (event: string, handler: (...args: never[]) => unknown) => {
        listeners.set(event, [...(listeners.get(event) ?? []), handler])
      },
    },
  }
}

/** Load the built host bundle. */
async function loadHostBundle(): Promise<Record<string, unknown>> {
  return (await import(new URL('../lib/index.js', import.meta.url).href)) as Record<string, unknown>
}

describe('built host bundle', () => {
  it('resolves every runtime dependency it declares', async () => {
    const source = await readFile(path.join(root, 'lib', 'index.js'), 'utf8')
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!)
    expect(specifiers.length).toBeGreaterThan(0)
    for (const specifier of specifiers) {
      expect(() => require.resolve(specifier), specifier).not.toThrow()
    }
  })

  it('externalises only builtins and schemastery, bundling everything else', async () => {
    const source = await readFile(path.join(root, 'lib', 'index.js'), 'utf8')
    const specifiers = new Set([...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!))
    for (const specifier of specifiers) {
      const isBuiltin = specifier.startsWith('node:')
      const isPeer = specifier === '@deepseek-ai/schemastery'
      expect(isBuiltin || isPeer, `unexpected external: ${specifier}`).toBe(true)
    }
  })

  it('exports the cordis plugin contract DSH reads', async () => {
    const host = await loadHostBundle()
    expect(host.name).toBe('dsh-advanced-provider-settings')
    expect(host.inject).toEqual(['settings', 'llm'])
    expect(typeof host.apply).toBe('function')
  })

  it('registers its own namespace and subscribes to the stream waterfall', async () => {
    const host = await loadHostBundle()
    const harness = fakeHostContext()
    ;(host.apply as (ctx: unknown) => void)(harness.ctx)

    expect(harness.settings.registered).toContain('dsh-advanced-provider-settings')
    expect(harness.listeners.get('llm/stream')).toHaveLength(1)

    for (const dispose of harness.effects) dispose()
  })

  it('warns when the retired community plugin shares the process', async () => {
    const host = await loadHostBundle()
    const harness = fakeHostContext()
    const describe = vi.fn(() => [
      { ns: 'dsh-advanced-provider-settings', revision: 1 },
      { ns: 'dsh-custom-provider-settings', revision: 1 },
      { ns: 'llm-pi-ai', revision: 1 },
    ])
    ;(harness.ctx.settings as unknown as { describe: unknown }).describe = describe
    ;(host.apply as (ctx: unknown) => void)(harness.ctx)

    const warn = harness.logger.warn as unknown as LogSpy
    expect(warn.mock.calls).toHaveLength(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('dsh-custom-provider-settings')

    for (const dispose of harness.effects) dispose()
  })

  it('installs and removes the fetch bridge around the real process fetch', async () => {
    const host = await loadHostBundle()
    const before = globalThis.fetch
    const harness = fakeHostContext()
    ;(host.apply as (ctx: unknown) => void)(harness.ctx)

    expect(globalThis.fetch).not.toBe(before)
    for (const dispose of harness.effects) dispose()
    expect(globalThis.fetch).toBe(before)
  })

  it('applies global headers to a stream without touching other fetches', async () => {
    const host = await loadHostBundle()
    const captured: Record<string, string>[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers: Record<string, string> = {}
      new Headers(init?.headers as HeadersInit).forEach((value, key) => { headers[key] = value })
      captured.push(headers)
      return new Response('{}', { status: 200 })
    }) as typeof globalThis.fetch

    try {
      const harness = fakeHostContext()
      ;(host.apply as (ctx: unknown) => void)(harness.ctx)
      harness.settings.set({ globalHeaders: { 'x-global': 'yes' } })

      const listener = harness.listeners.get('llm/stream')![0]!
      const chunks = (async function* () {
        // The adapter's request happens on a later pull, which is exactly the
        // case a naive `storage.run` around the iterable would miss.
        await fetch('https://provider.test/v1/chat')
        yield { type: 'text' }
      })()
      const stream = listener(
        { provider: 'gateway', model: 'm' } as never,
        (() => chunks) as never,
      ) as AsyncIterable<unknown>
      for await (const _chunk of stream) { /* drain */ }

      expect(captured).toHaveLength(1)
      expect(captured[0]!['x-global']).toBe('yes')

      // Outside the stream the bridge must stay inert.
      await fetch('https://elsewhere.test/')
      expect(captured[1]!['x-global']).toBeUndefined()

      for (const dispose of harness.effects) dispose()
    } finally {
      globalThis.fetch = original
    }
  })

  it('registers its same-origin routes when a web server is present', async () => {
    const host = await loadHostBundle()
    const harness = fakeHostContext({ webServer: true })
    ;(host.apply as (ctx: unknown) => void)(harness.ctx)

    expect(harness.routes).toEqual([{ kind: 'prefix', path: '/dsh-advanced-provider-settings' }])
    for (const dispose of harness.effects) dispose()
  })

  it('mounts without a web server, because a headless run has none', async () => {
    const host = await loadHostBundle()
    const harness = fakeHostContext()
    expect(() => { (host.apply as (ctx: unknown) => void)(harness.ctx) }).not.toThrow()
    expect(harness.routes).toHaveLength(0)
    for (const dispose of harness.effects) dispose()
  })
})

// ---------------------------------------------------------------------------
// Client bundle
// ---------------------------------------------------------------------------

/** A minimal React stand-in: enough for module evaluation and slot registration. */
function clientStubs() {
  const element = (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children })
  const jsxRuntime = {
    jsx: element,
    jsxs: element,
    jsxDEV: element,
    Fragment: Symbol('Fragment'),
  }
  const primitives = {
    Button: element,
    Input: element,
    Pill: element,
    Tag: element,
    Switch: element,
    Modal: element,
    Tooltip: element,
    DisclosureRow: element,
    RiskConfirmation: element,
    StateDot: element,
  }
  return {
    react: {
      createElement: element,
      useCallback: <T,>(fn: T) => fn,
      useEffect: () => {},
      useMemo: <T,>(fn: () => T) => fn(),
      useRef: <T,>(value: T) => ({ current: value }),
      useState: <T,>(value: T) => [value, () => {}] as [T, (next: T) => void],
      useSyncExternalStore: <T,>(_subscribe: unknown, getSnapshot: () => T) => getSnapshot(),
    },
    'react/jsx-runtime': jsxRuntime,
    '@deepseek-ai/dsh-client-ui-primitives': primitives,
  }
}

/** Evaluate the built client bundle against a stub module table. */
async function evaluateClientBundle(): Promise<{
  registered: { name: string; options: Record<string, unknown>; component: unknown }[]
  injected: string[]
  dictionaries: { namespace: string; keys: string[] }[]
  missingSpecifiers: string[]
  styles: { attributes: Record<string, string>; css: string }[]
  effectLabels: string[]
  registrations: number
  effectDisposers: number
  runDisposers: () => void
}> {
  const source = await readFile(path.join(root, 'lib', 'client.js'), 'utf8')
  const stubs = clientStubs()
  const missingSpecifiers: string[] = []
  const registered: { name: string; options: Record<string, unknown>; component: unknown }[] = []
  const injected: string[] = []
  const dictionaries: { namespace: string; keys: string[] }[] = []
  const styles: { attributes: Record<string, string>; css: string }[] = []
  const effectLabels: string[] = []
  const disposers: (() => void)[] = []
  let disposerCount = 0
  let localeDisposers = 0

  let exports: Record<string, unknown> | undefined
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(spec: { id: string; factory: (require: (id: string) => unknown) => unknown }) {
          expect(spec.id).toBe('dsh-advanced-provider-settings')
          exports = spec.factory((id: string) => {
            const stub = (stubs as Record<string, unknown>)[id]
            if (stub === undefined) {
              missingSpecifiers.push(id)
              throw new Error(`client-modules: require("${id}") missed the module table`)
            }
            return stub
          }) as Record<string, unknown>
        },
      },
    },
    console,
    document: {
      head: {
        querySelector: () => null,
        appendChild: (node: { attributes: Record<string, string>; textContent: string }) => {
          styles.push({ attributes: node.attributes, css: node.textContent })
        },
      },
      createElement: () => {
        const attributes: Record<string, string> = {}
        return {
          attributes,
          textContent: '',
          setAttribute: (name: string, value: string) => { attributes[name] = value },
        }
      },
    },
  }
  vm.createContext(sandbox)
  new vm.Script(source, { filename: 'client.js' }).runInContext(sandbox)

  if (exports === undefined) throw new Error('the client bundle did not call __ModuleLoader__.load')
  const plugin = exports as { apply?: (ctx: unknown) => void; inject?: string[]; name?: string }
  expect(plugin.name).toBe('dsh-advanced-provider-settings')

  const ctx = {
    locale: {
      register(namespace: string, dict: { zh: Record<string, string>; en: Record<string, string> }) {
        dictionaries.push({ namespace, keys: Object.keys(dict.en) })
        expect(Object.keys(dict.zh).sort()).toEqual(Object.keys(dict.en).sort())
        localeDisposers += 1
        return () => { localeDisposers -= 1 }
      },
      bind: () => (key: string) => key,
      getLocale: () => ({ active: 'en', revision: 0 }),
      subscribe: () => () => {},
    },
    slots: {
      inject(key: string, body: () => unknown) {
        injected.push(key)
        body()
      },
      register(options: Record<string, unknown>, component: unknown) {
        registered.push({ name: String(options.name), options, component })
        return () => {}
      },
    },
    settingsScope: { bind: () => ({ getSnapshot: () => ({ status: 'ready' }) }) },
    effect(body: () => void | (() => void), label?: string) {
      if (label !== undefined) effectLabels.push(label)
      const disposer = body()
      if (typeof disposer === 'function') {
        disposerCount += 1
        disposers.push(disposer)
      }
    },
    /** Test hook: run every registered teardown, as a fiber unload would. */
    runDisposers() {
      for (const dispose of disposers.splice(0)) dispose()
    },
  }
  plugin.apply?.(ctx)
  return {
    registered,
    injected,
    dictionaries,
    missingSpecifiers,
    styles,
    effectLabels,
    get registrations() { return localeDisposers },
    get effectDisposers() { return disposerCount },
    runDisposers: ctx.runDisposers,
  }
}

describe('built client bundle', () => {
  it('is a classic-script ModuleLoader envelope with the exact package id', async () => {
    const source = await readFile(path.join(root, 'lib', 'client.js'), 'utf8')
    expect(source).toContain('window.__ModuleLoader__.load({')
    expect(source).toContain('id: "dsh-advanced-provider-settings"')
    expect(source).toContain('factory: (require) =>')
    // A classic script, not an ES module: DSH injects it as a plain <script>.
    expect(source).not.toMatch(/^\s*export\s/m)
    expect(source).not.toMatch(/^\s*import\s/m)
  })

  it('materialises using only modules the shell seeds', async () => {
    const result = await evaluateClientBundle()
    expect(result.missingSpecifiers).toEqual([])
  })

  it('requires nothing outside the platform seed list', async () => {
    const source = await readFile(path.join(root, 'lib', 'client.js'), 'utf8')
    const specifiers = [...source.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]!)
    expect(specifiers.length).toBeGreaterThan(0)
    for (const specifier of new Set(specifiers)) {
      expect(PLATFORM_SEEDS, `not a platform seed: ${specifier}`).toContain(specifier)
    }
  })

  it('never requires the settings or locale packages, which are not requirable', async () => {
    const source = await readFile(path.join(root, 'lib', 'client.js'), 'utf8')
    expect(source).not.toContain('require("@deepseek-ai/dsh-client-locale")')
    expect(source).not.toContain('require("@deepseek-ai/dsh-client-ui-settings")')
  })

  it('registers the three extension seats through slots.inject', async () => {
    const result = await evaluateClientBundle()
    expect(result.injected.sort()).toEqual(
      ['settings.models.footer', 'settings.models.provider-card', 'settings.section'].sort(),
    )
    expect(result.registered).toHaveLength(3)

    // `name` is the TARGET SLOT KEY, not a label for the registration. The slot
    // core resolves it against its declaration table and throws on a miss, so a
    // descriptive name here is a load-time failure of the whole client half.
    // Worse, it fails QUIETLY in review: the option reads like a name.
    const names = result.registered.map((entry) => entry.options.name).sort()
    expect(names).toEqual(
      ['settings.models.footer', 'settings.models.provider-card', 'settings.section'].sort(),
    )

    const optionsFor = (name: string) => {
      const found = result.registered.find((entry) => entry.options.name === name)
      if (found === undefined) throw new Error(`no registration into ${name}`)
      return found.options
    }

    // Keyed slot: `key` is the row's owning settings namespace.
    const card = optionsFor('settings.models.provider-card')
    expect(card.key).toBe('llm-pi-ai')

    // List slots: `id` is the cell key and `label` is projected as nav text.
    for (const name of ['settings.section', 'settings.models.footer']) {
      const options = optionsFor(name)
      expect(typeof options.id, name).toBe('string')
      expect(String(options.id).length, name).toBeGreaterThan(0)
      expect(typeof options.order, name).toBe('number')
      // A thunk is re-read per projection, which is how the nav entry follows a
      // language switch without the shell subscribing to locale state.
      expect(typeof options.label, name).toBe('function')
    }
  })

  it('does not declare `locale:`, which would couple rendering to the namespace table', async () => {
    const result = await evaluateClientBundle()
    for (const entry of result.registered) {
      // Declaring `locale:` makes the renderer synthesize the `t` seat through
      // `LocaleNamespaceMap` — a table this plugin's namespace is not merged
      // into — and the synthesis fails loud when no locale face is installed.
      // The plugin binds its namespace against the locale service instead.
      expect(entry.options.locale, String(entry.options.name)).toBeUndefined()
    }
  })

  it('registers both locale dictionaries with identical key sets', async () => {
    const result = await evaluateClientBundle()
    expect(result.dictionaries).toHaveLength(1)
    expect(result.dictionaries[0]!.namespace).toBe('dsh-advanced-provider-settings')
    expect(result.dictionaries[0]!.keys.length).toBeGreaterThan(150)
  })

  it('releases its dictionaries through ctx.effect, not a dangling registration', async () => {
    const result = await evaluateClientBundle()
    // The locale service returns a disposer. Handing it to `ctx.effect` is what
    // lets an HMR reload re-register the namespace; dropping it leaks the
    // registration, and the reload then throws "already has locale".
    expect(result.effectLabels).toContain('advanced-provider-settings: dictionaries')
    expect(result.effectDisposers).toBe(1)
    expect(result.registrations).toBe(1)

    // Running the teardown, as a fiber unload would, must actually release it.
    result.runDisposers()
    expect(result.registrations).toBe(0)
  })

  it('contains no dynamic code execution', async () => {
    const source = await readFile(path.join(root, 'lib', 'client.js'), 'utf8')
    expect(source).not.toMatch(/\beval\s*\(/)
    expect(source).not.toMatch(/new\s+Function\s*\(/)
  })

  it('injects one style tag marked with the package id, as the shell expects', async () => {
    const result = await evaluateClientBundle()
    expect(result.styles).toHaveLength(1)
    const style = result.styles[0]!
    expect(style.attributes['data-plugin']).toBe('dsh-advanced-provider-settings')
    expect(style.attributes['data-plugin-css']).toBe('dsh-advanced-provider-settings/styles.css')
    expect(style.css.length).toBeGreaterThan(500)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Packaging and profile composition
// ---------------------------------------------------------------------------

/**
 * A minimal block-sequence reader, so this file needs no YAML dependency.
 *
 * The patch is a flat list of one-key mappings with a nested list of rows. That
 * shape is small enough that a real parser would add a dependency to the
 * published package for no benefit — but it is also the shape that `dsh plugin`
 * and the composition loader read, so it must be asserted rather than assumed.
 */
function parsePatch(source: string): { key: string; rows: { id: string; name: string; extra: string[] }[] }[] {
  const groups: { key: string; rows: { id: string; name: string; extra: string[] }[] }[] = []
  let current: { key: string; rows: { id: string; name: string; extra: string[] }[] } | undefined
  let row: { id: string; name: string; extra: string[] } | undefined
  for (const raw of source.split('\n')) {
    const line = raw.replace(/#.*$/, '').trimEnd()
    if (line.trim() === '') continue
    const group = /^-\s+([a-zA-Z]+):\s*$/.exec(line)
    if (group !== null) {
      current = { key: group[1]!, rows: [] }
      groups.push(current)
      row = undefined
      continue
    }
    const listRow = /^\s{4}-\s+([a-zA-Z]+):\s*(.+?)\s*$/.exec(line)
    if (listRow !== null && current !== undefined) {
      row = { id: '', name: '', extra: [] }
      if (listRow[1] === 'id') row.id = listRow[2]!
      else if (listRow[1] === 'name') row.name = listRow[2]!
      else row.extra.push(listRow[1]!)
      current.rows.push(row)
      continue
    }
    // Continuation keys of the current row (`      name: …` after `    - id: …`).
    const nested = /^\s{6,}([a-zA-Z]+):\s*(.*)$/.exec(line)
    if (nested !== null && row !== undefined) {
      if (nested[1] === 'id') row.id = nested[2]!
      else if (nested[1] === 'name') row.name = nested[2]!
      else row.extra.push(nested[1]!)
      continue
    }
    if (/^\s{6,}-\s+/.test(line) && row !== undefined) {
      row.extra.push('__list__')
      continue
    }
    throw new Error(`unparsed patch line: ${raw}`)
  }
  return groups
}

describe('profile bundle patch', () => {
  it('declares itself as a bundle through dsh.bundle.patch', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      name: string
      dsh?: { bundle?: { patch?: string }; client?: { platform?: string; inject?: string[] } }
      files?: string[]
    }
    expect(manifest.name).toBe('dsh-advanced-provider-settings')
    // `dsh plugin` reconciles `dsh.profile.bundles` by exactly this check: a
    // dependency joins the layer stack when its manifest declares a patch.
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh?.client?.platform).toBe('web')
    expect(manifest.files).toContain('cordis.patch.yml')
    expect(manifest.files).toContain('lib')
  })

  it('is a valid `insert` layer naming this package', async () => {
    const source = await readFile(path.join(root, 'cordis.patch.yml'), 'utf8')
    const groups = parsePatch(source)
    expect(groups).toHaveLength(1)
    const layer = groups[0]!
    expect(layer.key).toBe('insert')
    expect(layer.rows).toHaveLength(1)
    const row = layer.rows[0]!
    // `name` is the package the loader imports, so it must match the manifest.
    expect(row.name).toBe('dsh-advanced-provider-settings')
    expect(row.id).toBe('advanced-provider-settings')
  })

  it('does not gate the host half on webServer, which headless runs lack', async () => {
    const source = await readFile(path.join(root, 'cordis.patch.yml'), 'utf8')
    const groups = parsePatch(source)
    const row = groups[0]!.rows[0]!
    // The plugin's own wait is `export const inject = ['settings', 'llm']`, and
    // `webServer` is reached through `ctx.get()` so a composition without one
    // still mounts the namespace and the header bridge. Adding it here would
    // make the whole plugin wait for a service that never arrives.
    expect(row.extra).not.toContain('inject')
  })

  it('publishes the built entry points the manifest advertises', async () => {
    for (const relative of ['lib/index.js', 'lib/client.js', 'lib/types/index.d.ts', 'lib/types/client/index.d.ts']) {
      await expect(readFile(path.join(root, relative), 'utf8')).resolves.toBeTruthy()
    }
  })

  it('ships no test or source file in the published file list', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { files: string[] }
    for (const entry of manifest.files) {
      expect(entry.startsWith('tests'), entry).toBe(false)
      expect(entry.startsWith('src'), entry).toBe(false)
    }
  })
})
