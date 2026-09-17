/**
 * The boot composition path, driven through the real implementation.
 *
 * `dsh-client-modules` is what turns a package's `dsh.client` declaration into a
 * preloaded browser bundle. It is also the one place where a mistake in this
 * package's manifest is not merely local: `ClientModuleRegistry`'s constructor
 * aggregates every declaration failure and throws
 * `ClientPackageCompositionError`, so a malformed `dsh.client` declaration,
 * an `exports` map without a `./client` entry, or a missing bundle file takes
 * down the web plugin table for **every** plugin in the composition, not just
 * this one.
 *
 * Reading that code and concluding "our shape looks accepted" is not evidence.
 * These tests construct the real registry, hand it a loader entry that names
 * this package, and assert on what it actually produces: the composed row, the
 * preload URL injected into the shell, and the bytes served for it. The
 * malformed-declaration cases exist so the guard is proven load-bearing rather
 * than assumed — a suite that only ever feeds valid input cannot tell a real
 * check from a vacuous one.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import ClientModuleRegistry, { bootInjections, stripClientSuffix } from '@deepseek-ai/dsh-client-modules'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const PACKAGE_NAME = 'dsh-advanced-provider-settings'

/**
 * Build the request the shell's carrier hands the registry.
 * @param url - path and query, as served.
 * @param method - HTTP method.
 * @returns a real Request, matching the carrier's contract.
 */
function bundleRequest(url: string, method = 'GET'): Request {
  return new Request(new URL(url, 'http://localhost'), { method })
}

/** Temp trees created by a test, removed once the file finishes. */
const scratchDirs: string[] = []

afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true })
})

/**
 * Build a real registry over a loader entry naming one package.
 *
 * A declaration failure does not come back through the logger: the constructor
 * collects every failure and throws one `ClientPackageCompositionError` naming
 * all of them. Both channels are captured, because asserting on only one of them
 * is how the first draft of this file silently asserted nothing.
 * @param packageName - entry name the loader reports.
 * @param base - directory the entry resolves from.
 * @returns the registry (undefined when composition threw) and the failures.
 */
function bootOne(packageName: string, base: string): { registry?: ClientModuleRegistry; errors: string[] } {
  const errors: string[] = []
  const ctx = new Context()
  /** The slice of a real Loader the registry reads. */
  const loader = {
    entries: () => [
      {
        options: { name: packageName },
        fiber: { id: 'test-fiber' },
        disabled: false,
        parent: { tree: { ctx: { baseUrl: pathToFileURL(path.join(base, 'entry.js')).href } } },
      },
    ],
  }
  Object.assign(ctx, { loader })
  ctx.logger = {
    warn: (e: Error) => errors.push(e.message),
    error: (e: Error) => errors.push(e.message),
    info: () => {},
  } as never
  // A real Loader exposes Node's resolver here, and the registry takes a
  // DIFFERENT branch when it is present: it resolves the entry to a module URL
  // and walks up to the nearest matching package.json. Leaving `internal` off
  // falls back to `require.resolve("<pkg>/package.json")`, which needs the
  // manifest to be an exported subpath and — worse — silently SKIPS a package it
  // cannot locate instead of reporting anything. That silence is why the first
  // draft of this file had five rejection tests asserting on an empty string.
  // The third argument shape and the `file:` URL are both load-bearing:
  // `nearestPackage` returns early for anything that is not a file URL, which
  // silently produces no row rather than an error.
  Object.assign(loader, {
    internal: {
      resolveSync: (specifier: string, base: string) => ({
        url: pathToFileURL(createRequire(base).resolve(specifier)).href,
      }),
    },
  })
  try {
    return { registry: new ClientModuleRegistry(ctx), errors }
  } catch (error) {
    errors.push((error as Error).message)
    return { errors }
  }
}

/**
 * Build a registry that is expected to compose successfully.
 * @param packageName - entry name the loader reports.
 * @param base - directory the entry resolves from.
 * @returns the registry.
 */
function registryFor(packageName: string, base: string): ClientModuleRegistry {
  const { registry, errors } = bootOne(packageName, base)
  if (registry === undefined) throw new Error(`expected a clean composition, got: ${errors.join('; ')}`)
  if (errors.length > 0) throw new Error(`expected no composition complaints, got: ${errors.join('; ')}`)
  return registry
}

/**
 * Write a throwaway package declaring `dsh.client`.
 *
 * `lib/index.js` always exists so the entry resolves; whether `lib/client.js`
 * exists is the variable under test.
 * @param name - package name to create.
 * @param manifest - the manifest to write.
 * @param clientSource - contents of `lib/client.js` (omit to write no bundle).
 * @returns the directory to resolve the package from.
 */
function scratchPackage(name: string, manifest: Record<string, unknown>, clientSource?: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'aps-composition-'))
  scratchDirs.push(dir)
  const pkgDir = path.join(dir, 'node_modules', name)
  mkdirSync(path.join(pkgDir, 'lib'), { recursive: true })
  writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(manifest, null, 2))
  writeFileSync(path.join(pkgDir, 'lib', 'index.js'), 'export const apply = () => {};\n')
  if (clientSource !== undefined) writeFileSync(path.join(pkgDir, 'lib', 'client.js'), clientSource)
  return dir
}

const VALID_CLIENT = 'window.__ModuleLoader__.load({ id: "x", factory: function () { return {} } });'

describe('boot composition (real dsh-client-modules)', () => {
  it('accepts this package manifest and emits a bundle row', () => {
    const registry = registryFor(PACKAGE_NAME, root)
    const entry = registry.graph().entries.find((row) => row.id === PACKAGE_NAME)
    expect(entry, 'the composition produced no row for this package').toBeDefined()
    // The URL is the combo route the shell preloads, revisioned for cache busting.
    expect(entry!.url).toContain(`${PACKAGE_NAME}/client.js`)
    expect(entry!.url.startsWith('/plugins/??')).toBe(true)
    // A combo revision: content hash plus the batch index it was packed into.
    expect(entry!.rev).toMatch(/^[0-9a-f]{16}-\d+$/)
  })

  it('resolves exports["./client"].default, not the types condition', () => {
    const registry = registryFor(PACKAGE_NAME, root)
    // `clientExportOf` reads `.default` when `./client` is an object. If it ever
    // picked `types` instead, the served body would be a declaration file.
    expect(registry.clientPath(PACKAGE_NAME)).toBe(path.join(root, 'lib', 'client.js'))
  })

  it('carries the declared inject edges and no external edges', () => {
    const registry = registryFor(PACKAGE_NAME, root)
    const entry = registry.graph().entries.find((row) => row.id === PACKAGE_NAME)!

    // `inject` is an ARRIVAL edge: the browser system awaits these bundles
    // before materialising this one, which is what lets the slot registrations
    // find declarations that other packages install at runtime.
    expect(entry.inject).toEqual(['@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-ui-settings-models'])
    // `external` would make them requirable. This bundle requires none of them —
    // it only requires the three static seeds — so declaring them here would be
    // a lie that also adds a graph edge the browser cannot satisfy.
    expect(entry.external).toBeUndefined()
  })

  it('does not advertise the meaningless immediately flag', () => {
    const registry = registryFor(PACKAGE_NAME, root)
    const entry = registry.graph().entries.find((row) => row.id === PACKAGE_NAME)!
    // `immediately: false` is accepted but the loader never consults the flag, so
    // the row must not pretend to defer anything.
    expect('immediately' in entry).toBe(false)
  })

  it('preloads this bundle into the shell head', () => {
    const registry = registryFor(PACKAGE_NAME, root)
    const rows = bootInjections(registry.graph())

    // The queue script, then preloads, then bootstrap scripts, then the graph.
    expect(rows[0]!.kind).toBe('script')
    expect(rows[rows.length - 1]!.name).toBe('__DSH_BOOT__')
    const preloads = rows.filter((row) => row.kind === 'script-preload').map((row) => row.src)
    expect(preloads.some((src) => src.includes(PACKAGE_NAME))).toBe(true)
  })

  it('serves the bundle as JavaScript, with this package own envelope', () => {
    const registry = registryFor(PACKAGE_NAME, root)
    const url = registry.graph().entries.find((row) => row.id === PACKAGE_NAME)!.url
    const response = registry.fetchBundle(bundleRequest(url))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(response.headers.get('cache-control')).toBeTruthy()
    // The registry hands the file through untouched; the envelope is this
    // package's own build output, not something the loader adds.
    return response.text().then((body) => {
      expect(body).toContain('window.__ModuleLoader__.load(')
      expect(body).toContain(`id: "${PACKAGE_NAME}"`)
      expect(body.length).toBeGreaterThan(1000)
    })
  })

  it('answers HEAD without a body, 404 for unknown, and 405 for a write', () => {
    const registry = registryFor(PACKAGE_NAME, root)
    const url = registry.graph().entries.find((row) => row.id === PACKAGE_NAME)!.url

    const head = registry.fetchBundle(bundleRequest(url, 'HEAD'))
    expect(head.status).toBe(200)
    expect(head.body).toBeNull()

    expect(registry.fetchBundle(bundleRequest('/plugins/??nope/client.js')).status).toBe(404)
    expect(registry.fetchBundle(bundleRequest(url, 'POST')).status).toBe(405)
  })
})

describe('declaration rejection is load-bearing', () => {
  it('rejects a declaration whose exports map has no ./client', () => {
    const dir = scratchPackage('aps-no-client', {
      name: 'aps-no-client',
      version: '1.0.0',
      dsh: { client: { platform: 'web' } },
      exports: { '.': './lib/index.js' },
    }, VALID_CLIENT)
    const { errors } = bootOne('aps-no-client', dir)

    expect(errors.join('\n')).toMatch(/exports no "\.\/client" bundle/)
  })

  it('rejects a ./client whose default is not a string', () => {
    const dir = scratchPackage('aps-bad-default', {
      name: 'aps-bad-default',
      version: '1.0.0',
      dsh: { client: { platform: 'web' } },
      // `'.'` must exist: the loader resolves the entry to a module URL and
      // walks up to the manifest. Without it the package is skipped before its
      // declaration is parsed, and the malformed field is never reached.
      exports: { '.': './lib/index.js', './client': { default: 42 } },
    }, VALID_CLIENT)
    const { errors } = bootOne('aps-bad-default', dir)

    expect(errors.join('\n')).toMatch(/must be a string or an object with a string default/)
  })

  it('rejects a non-array inject', () => {
    const dir = scratchPackage('aps-bad-inject', {
      name: 'aps-bad-inject',
      version: '1.0.0',
      dsh: { client: { platform: 'web', inject: 'react' } },
      exports: { '.': './lib/index.js', './client': './lib/client.js' },
    }, VALID_CLIENT)
    const { errors } = bootOne('aps-bad-inject', dir)

    expect(errors.join('\n')).toMatch(/inject must be a string array/)
  })

  it('rejects a non-boolean immediately', () => {
    const dir = scratchPackage('aps-bad-immediate', {
      name: 'aps-bad-immediate',
      version: '1.0.0',
      dsh: { client: { platform: 'web', immediately: 'yes' } },
      exports: { '.': './lib/index.js', './client': './lib/client.js' },
    }, VALID_CLIENT)
    const { errors } = bootOne('aps-bad-immediate', dir)

    expect(errors.join('\n')).toMatch(/immediately must be a boolean/)
  })

  it('rejects a declaration whose bundle file is missing', () => {
    const dir = scratchPackage('aps-no-bundle', {
      name: 'aps-no-bundle',
      version: '1.0.0',
      dsh: { client: { platform: 'web' } },
      exports: { '.': './lib/index.js', './client': './lib/client.js' },
    })
    const { errors } = bootOne('aps-no-bundle', dir)

    // The loader names the package and the exact path, and tells the user what to
    // do about it — which is why this package commits its built bundles.
    const message = errors.join('\n')
    expect(message).toMatch(/client bundles not found/)
    expect(message).toContain('aps-no-bundle')
    expect(message).toContain(path.join(dir, 'node_modules', 'aps-no-bundle', 'lib', 'client.js'))
    expect(message).toMatch(/pnpm run build/)
  })

  it('skips a package it cannot locate, without reporting anything', () => {
    // The failure mode worth knowing: a broken `exports` map is not an error, it
    // is silence. The package never resolves to a module URL, so it is dropped
    // before its `dsh.client` declaration is read. This package's own
    // `exports['.']` and `exports['./package.json']` are both present, so neither
    // the resolver path nor the fallback can land here.
    const dir = scratchPackage('aps-unresolvable', {
      name: 'aps-unresolvable',
      version: '1.0.0',
      dsh: { client: { platform: 'web' } },
      exports: { './client': './lib/client.js' },
    }, VALID_CLIENT)
    const { registry, errors } = bootOne('aps-unresolvable', dir)

    expect(errors).toEqual([])
    expect(registry!.graph().entries).toEqual([])
  })

  it('ignores a package that declares no dsh.client at all', () => {
    const dir = scratchPackage('aps-plain', {
      name: 'aps-plain',
      version: '1.0.0',
      exports: { '.': './lib/index.js' },
    })
    const registry = registryFor('aps-plain', dir)

    expect(registry.graph().entries).toEqual([])
  })
})

describe('module specifier normalisation', () => {
  it('treats <pkg>/client and <pkg> as the same export', () => {
    // This is what lets a bundle request the subpath its own code imports and
    // still be answered by the package's single client bundle.
    expect(stripClientSuffix('dsh-advanced-provider-settings/client')).toBe(PACKAGE_NAME)
    expect(stripClientSuffix(PACKAGE_NAME)).toBe(PACKAGE_NAME)
    expect(stripClientSuffix('@scope/pkg/client')).toBe('@scope/pkg')
    // The strip is a blunt suffix removal, so a scope literally named `client`
    // normalises to a bare scope. Harmless here — nothing is named that — but
    // recorded so the behaviour is not mistaken for scope-aware logic.
    expect(stripClientSuffix('@scope/client')).toBe('@scope')
    expect(stripClientSuffix('lib/client')).toBe('lib')
  })
})
