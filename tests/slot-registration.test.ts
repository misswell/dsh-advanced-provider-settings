/**
 * Registration tests against the REAL slot registry.
 *
 * The other suites use a hand-written `slots` double, which cannot tell a valid
 * registration from an invalid one — a double accepts whatever it is given. This
 * one drives the actual `SlotCore` shipped with DeepSeek Harness, with the slot
 * declarations taken from the contracts the declarers publish. It is the only
 * test here that can fail for the reason that matters most: a registration the
 * real shell would reject at load time.
 *
 * It exists because a hand-written double let exactly that bug through. An
 * earlier revision passed a descriptive string as `register({ name })`; the
 * registry reads `name` as the TARGET SLOT KEY, so `SlotCore.register` throws
 * "slot … is not declared" from inside the `inject` callback and the whole
 * browser half fails to materialise. Nothing in the type system, the linter, or
 * the double-based tests noticed.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { SlotCore, resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { SlotEntryDef, SlotSpec } from '@deepseek-ai/dsh-client-ui-slots'
import { en } from '../src/client/locales/en-US.js'
import { PLUGIN_NAMESPACE, PROVIDER_NAMESPACE } from '../src/shared/capabilities.js'
import * as React from 'react'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

/**
 * The declarations this plugin contributes into, copied from the contracts the
 * declarers publish:
 *
 *  - `settings.section` and `settings.models.footer`: list/root.
 *  - `settings.models.provider-card`: keyed/root.
 *
 * The keys are declared by *other* packages at runtime, so a test has to
 * reproduce them; if a future Harness release changes a kind, this file stops
 * compiling against its types and the mismatch is visible rather than silent.
 */
const DECLARED_SLOTS: Record<string, SlotSpec<SlotEntryDef>> = {
  'settings.section': { kind: 'list', scope: 'root' },
  'settings.models.provider-card': { kind: 'keyed', scope: 'root' },
  'settings.models.footer': { kind: 'list', scope: 'root' },
}

/** One recorded registration, as the registry stored it. */
type StoredEntry = ReturnType<SlotCore['entries']>[number]

/** What a test needs back. */
interface Registry {
  core: SlotCore
  /** Registrations that reached the core, per slot key. */
  registered: Map<string, StoredEntry[]>
  /** Disposers returned by each accepted registration, in order. */
  disposers: (() => void)[]
  /** Mirrors the shell's `ctx.slots`. */
  slots: {
    inject: (key: string, body: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => () => void
  }
  /** Rejects recorded from a throwing `register`, for assertions. */
  failures: Error[]
}

/**
 * Build a real registry with this plugin's target slots declared.
 *
 * The shell declares its slots from a root registrant's `children` table, which
 * is what the stand-in below reproduces.
 * @returns the registry and its mirrors.
 */
function realRegistry(): Registry {
  const core = new SlotCore()
  const failures: Error[] = []

  // A stand-in for the shell entry that declares these slots. Real shells
  // register into `root`; without a declarer every contribution below is
  // correctly refused.
  core.register(
    {
      name: 'root',
      children: DECLARED_SLOTS,
      // The renderer never runs in these tests, so an inert component is enough.
    } as never,
    (() => null) as never,
  )

  const registered = new Map<string, StoredEntry[]>()
  const disposers: (() => void)[] = []
  const slots = {
    inject(key: string, body: () => unknown): unknown {
      if (core.specDynamic(key) === undefined) {
        // Mirrors the real `inject`: the callback parks until a declaration
        // arrives. A test that lands here has declared nothing, which is itself
        // the failure under test.
        throw new Error(`test declared no slot named "${key}"`)
      }
      return body()
    },
    register(options: Record<string, unknown>, component: unknown): () => void {
      try {
        const dispose = core.register(options as never, component as never)
        const key = String(options.name)
        registered.set(key, [...(registered.get(key) ?? []), ...core.entries(key).slice(-1)])
        disposers.push(dispose)
        return dispose
      } catch (error) {
        failures.push(error as Error)
        throw error
      }
    },
  }

  return { core, registered, slots, failures, disposers }
}

/**
 * Evaluate the built client bundle against a real registry.
 * @param existing - reuse this registry instead of building a fresh one, which
 *   is how a second `apply` against the same shell is simulated.
 * @returns the registry, with everything the registrations produced.
 */
async function mountClient(existing?: Registry): Promise<Registry> {
  const registry = existing ?? realRegistry()
  const source = await readFile(path.join(root, 'lib', 'client.js'), 'utf8')

  const h = React.createElement
  const stubs: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': { jsx: h, jsxs: h, Fragment: React.Fragment },
    // Never rendered here — registration is the subject, not the markup.
    '@deepseek-ai/dsh-client-ui-primitives': new Proxy({}, { get: () => () => null }),
  }

  let exports: Record<string, unknown> | undefined
  const sandbox: Record<string, unknown> = {
    console,
    document: { head: { querySelector: () => null, appendChild: () => {} }, createElement: () => ({ setAttribute: () => {} }) },
    window: {
      __ModuleLoader__: {
        load(spec: { factory: (req: (id: string) => unknown) => unknown }) {
          exports = spec.factory((id: string) => {
            const stub = stubs[id]
            if (stub === undefined) throw new Error(`unexpected require("${id}")`)
            return stub
          }) as Record<string, unknown>
        },
      },
    },
  }
  vm.createContext(sandbox)
  new vm.Script(source, { filename: 'client.js' }).runInContext(sandbox)

  const plugin = exports as { apply?: (ctx: unknown) => void } | undefined
  if (plugin?.apply === undefined) throw new Error('the bundle exported no apply')

  plugin.apply({
    locale: {
      register: () => () => {},
      // Bind against the REAL dictionary, so the label asserted below is the
      // text a user actually sees rather than a key echoed back.
      bind: () => (key: string) => (en as Record<string, string>)[key] ?? key,
      getLocale: () => ({ active: 'en', revision: 0 }),
      subscribe: () => () => {},
    },
    slots: registry.slots,
    settingsScope: { bind: () => ({ getSnapshot: () => ({ status: 'loading' }) }) },
    effect: (body: () => void | (() => void)) => { body() },
  })

  return registry
}

describe('registration against the real slot registry', () => {
  it('is accepted by SlotCore without a single rejection', async () => {
    const registry = await mountClient()
    expect(registry.failures.map((error) => error.message)).toEqual([])
  })

  it('contributes into the three declared slot keys, by key', async () => {
    const registry = await mountClient()
    for (const key of Object.keys(DECLARED_SLOTS)) {
      expect(registry.core.entriesOfSlot(key), key).toHaveLength(1)
    }
    expect(registry.registered.size).toBe(3)
  })

  it('dispatches the provider card under the llm-pi-ai entry key', async () => {
    const registry = await mountClient()
    const entries = registry.core.entriesOfSlot('settings.models.provider-card')
    expect(entries).toHaveLength(1)
    // The Models section dispatches with `entryKey = provider.settingsNs`.
    expect(entries[0]!.options.key).toBe(PROVIDER_NAMESPACE)
    // Same key, same priority would have thrown; a clean land means the registry
    // accepted the cell.
    expect(entries[0]!.registrant).toBe(PLUGIN_NAMESPACE)
  })

  it('carries the real English nav label, resolved through a thunk', async () => {
    const registry = await mountClient()
    const section = registry.core.entriesOfSlot('settings.section')[0]!
    // `resolveSlotLabel` is what the shell's ledger projection calls.
    expect(resolveSlotLabel(section.options.label)).toBe('Provider Advanced')
    expect(section.options.id).toBe(PLUGIN_NAMESPACE)
    expect(typeof section.options.order).toBe('number')
  })

  it('carries the plugin title on the footer seat', async () => {
    const registry = await mountClient()
    const footer = registry.core.entriesOfSlot('settings.models.footer')[0]!
    expect(resolveSlotLabel(footer.options.label)).toBe('Advanced Provider Settings')
  })

  it('leaves no `locale:` declaration for the renderer to resolve', async () => {
    const registry = await mountClient()
    for (const key of Object.keys(DECLARED_SLOTS)) {
      expect(registry.core.entriesOfSlot(key)[0]!.locale).toBeUndefined()
    }
  })

  it('removes every contribution when the registrations are disposed', async () => {
    // The registry's disposers are idempotent and removing an entry collapses
    // nothing it did not declare, so a fiber unload must leave it empty — and a
    // second unload must not throw.
    const registry = await mountClient()
    expect(registry.disposers).toHaveLength(3)

    for (const dispose of registry.disposers) dispose()
    for (const key of Object.keys(DECLARED_SLOTS)) {
      expect(registry.core.entriesOfSlot(key), key).toHaveLength(0)
    }

    for (const dispose of registry.disposers) expect(() => { dispose() }).not.toThrow()
  })

  it('survives a re-mount after disposal, as an HMR reload does', async () => {
    // A reload re-runs `apply` against the SAME registry. A leaked registration
    // would collide on the same cell.
    const registry = await mountClient()
    for (const dispose of registry.disposers) dispose()

    const reloaded = await mountClient(registry)
    expect(reloaded.failures).toEqual([])
    for (const key of Object.keys(DECLARED_SLOTS)) {
      expect(reloaded.core.entriesOfSlot(key), key).toHaveLength(1)
    }
  })

  it('is rejected loudly when mounted twice without disposing', async () => {
    // The counterpart to the reload case: a genuine double-mount must throw on
    // the first occupied cell rather than silently shadowing the live entry, so
    // a lifecycle bug surfaces instead of producing two half-working panels.
    const registry = await mountClient()
    const second = await mountClient(registry).catch((error: Error) => error)
    expect(second).toBeInstanceOf(Error)
    expect(String(second)).toMatch(/already has an entry/)
  })

  it('refuses a registration into an undeclared slot, which is the bug this suite guards', () => {
    // The exact failure an earlier revision shipped: `name` read as a label
    // instead of a slot key. Reproduced against the real core so the guard is
    // proven to be load-bearing rather than assumed.
    const core = new SlotCore()
    core.register({ name: 'root' } as never, (() => null) as never)
    expect(() =>
      core.register({ name: 'dsh-advanced-provider-settings:provider-card', key: 'llm-pi-ai' } as never, (() => null) as never),
    ).toThrow(/is not declared/)
  })
})
