# Advanced Provider Settings for DeepSeek Harness

**Advanced Provider Settings** is a WebUI plugin for **DeepSeek Harness** (DSH) that turns the
hidden half of an OpenAI-compatible provider into something you can see and edit. Instead of
hand-editing `~/.dsh/settings.yaml`, you get a real control panel on every provider card for
**Provider Settings** covering request **Headers**, **User-Agent** control, **Retry Policy**,
**Timeout** and transport, **Vision** and image budgets, **Reasoning** and thinking levels,
**Compatibility** flags, and per-model capabilities — all written through DeepSeek Harness's own
revision-fenced settings transport, so your YAML keeps its comments and every field you never
touched stays exactly as it was.

> **Status:** `v0.1.0`. Verified against DeepSeek Harness `0.1.5-rc.2`.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [What you can configure](#what-you-can-configure)
- [Install](#install)
- [Uninstall](#uninstall)
- [Using it](#using-it)
- [Three behaviours that surprise people](#three-behaviours-that-surprise-people)
- [Compatibility matrix](#compatibility-matrix)
- [How it stays safe](#how-it-stays-safe)
- [Development](#development)
- [Known issues](#known-issues)
- [License](#license)

---

## Why this exists

DeepSeek Harness exposes a large, well-designed provider schema, and its Models page deliberately
edits only the common fields: endpoint, credential, model list. The rest — the fields that decide
whether a flaky gateway succeeds on the third try, whether a corporate proxy accepts your client,
whether an image-heavy prompt is rejected before it is sent — live in `settings.yaml` and nowhere
else.

This plugin surfaces those fields without touching a single line of Harness source, without
patching anything in `node_modules`, and without owning a second copy of your configuration. It
adds UI through the Models page's **declared extension slots**, and it reads and writes the
`llm-pi-ai` settings namespace through the framework's public settings API.

## What you can configure

| Area | What you get |
|---|---|
| **Headers** | Per-provider and global request headers, with validation, secret masking and duplicate detection. |
| **User-Agent** | Presets (Chrome, Safari, Firefox, opencode, Codex CLI, Claude CLI) plus free text, for gateways that whitelist clients. |
| **Retry Policy** | Harness default / Conservative / Aggressive presets, or a custom policy: mode, max retries, retryable codes, initial delay, max delay, jitter. |
| **Network** | Transport (`sse`, `websocket`, `websocket-cached`, `auto`), request timeout, stream idle timeout, WebSocket connect timeout, cache retention. |
| **Vision** | Default input modalities, max image bytes per request, pixel budget, max bytes per image — with human units (MiB) instead of raw byte counts. |
| **Reasoning** | Thinking level (`off` … `max`) and per-level token budgets. |
| **Compatibility** | All 26 `compat` flags, filtered to the ones your route's protocol actually reads — with model-level editing filtered harder, because a mismatch there is a hard error in Harness. |
| **Models** | Per-model input modalities, per-model reasoning-effort mapping, per-model compatibility overrides. |
| **Test Provider** | Interrogates the endpoint's model list using the headers *currently in the form*, saved or not — the fastest way to prove a whitelist header works. |
| **Effective configuration** | A preview of exactly what the provider will send, layer by layer, with sensitive values masked. |
| **Diagnostics** | Read-only compatibility report you can paste into a bug report, plus one-click import from the retired `dsh-custom-provider-settings` plugin. |

## Install

Requires DeepSeek Harness `0.1.5-rc.2` or a compatible build, and Node.js 20+.

```bash
# From a GitHub release tarball
dsh plugin --profile web add https://github.com/misswell/dsh-advanced-provider-settings/releases/download/v0.1.0/dsh-advanced-provider-settings-0.1.0.tgz

# From npm, once published
dsh plugin --profile web add dsh-advanced-provider-settings

# Directly from the repository (needs a build-capable git install; see Known issues)
dsh plugin --profile web add github:misswell/dsh-advanced-provider-settings
```

Then restart the web UI:

```bash
dsh web
```

## Uninstall

```bash
dsh plugin --profile web remove dsh-advanced-provider-settings
```

Removing the package removes the UI and unregisters the plugin's own settings namespace. **Your
provider configuration is untouched** — advanced fields keep working, because they were written to
Harness's own `llm-pi-ai` namespace, which this plugin never owned. If you also want to clear the
fields this plugin set, use *Reset all advanced settings* on each provider card first, or delete
the keys under `providers.<id>` in `~/.dsh/settings.yaml` by hand.

## Using it

1. Open **Settings → Models**.
2. Expand any OpenAI-compatible provider card. **Advanced Settings** appears under it.
3. Each section shows a status chip in the collapsed header, so you can see at a glance what is
   overridden and what is still inheriting Harness defaults.
4. Edit, then **Save**. Changes are written as path-addressed operations against the namespace
   revision you were reading, so a concurrent edit is refused rather than silently clobbered.
5. **Global headers** and diagnostics live on their own page: **Settings → Provider Advanced**.

## Three behaviours that surprise people

These are properties of DeepSeek Harness `0.1.5-rc.2` that this plugin surfaces rather than hides.
Each is reported in the UI at the point where it matters.

### 1. A provider-level `User-Agent` is discarded

Harness's pi-ai adapter strips any header named `user-agent` from a provider profile and then sends
its own attribution value (`deepseek-harness/<version> (+https://github.com/deepseek-ai/deepseek-harness)`).
`user-agent` is the *only* reserved name.

So the plugin warns when you set it on a provider, and offers the User-Agent presets on the
**Global** header list instead — the global layer is applied by this plugin's own transport wrapper
after Harness has built its header set, which makes it the only place a User-Agent can take effect.

### 2. A configured `authorization` header can displace your API key

On the OpenAI-compatible protocols, a header you configure overrides the credential Harness
resolved. That is occasionally exactly what you want (a gateway that wants its own token) and
frequently a mystery ("my key stopped working"). The plugin reports it as a warning next to the
header.

### 3. Retry is per provider route, not per model

`retryPolicy` is configured on the route. There is no per-model retry, and there is no global
retry. The plugin says so in the Retry section rather than letting you look for a control that
does not exist.

## Compatibility matrix

| DeepSeek Harness | Status | Notes |
|---|---|---|
| `0.1.5-rc.2` | **Verified** | Every constant and code path in this release was read from this build and exercised against it. |
| other `0.1.5-rc.*` | Expected to work | Release candidates inside one patch series have not changed the provider schema historically, but this is untested. |
| `0.1.4` and earlier | Unsupported | The `settings.models.provider-card` extension seat and the client `settingsScope` mutation API this plugin depends on do not exist. |
| `0.2.x` and later | Unknown | Check the Diagnostics panel: it reports the detected Harness version and which capabilities resolved. |

The Diagnostics panel is the authoritative answer for a given install. It reports the detected
Harness version, whether the plugin's namespace and the `llm-pi-ai` namespace are served, whether
revision-fenced writes are supported, whether the header bridge installed, and whether the
Models-page extension package resolved.

## How it stays safe

- **No Harness source modification.** No file outside this package is edited, and nothing in
  `node_modules` is patched. UI is contributed through the slot registry the Models page declares.
- **No DOM scraping.** The previous generation of this kind of plugin found the provider cards by
  matching bilingual text and `aria-label` values. This one registers into
  `settings.models.provider-card` and is handed its owner props. It never reads the page.
- **Your YAML keeps its comments and its unknown fields.** Writes are ordered path operations
  (`{op: 'set'|'unset', path}`), not a whole-file rewrite. Fields you never touched — including
  keys a future Harness adds that this plugin knows nothing about — are never named and therefore
  never changed. Both properties are covered by tests.
- **"Harness default" means *remove the override*.** Choosing a default deletes the key rather than
  writing today's default value, so a future Harness release that changes a default is inherited
  instead of pinned.
- **API keys are never stored in plain settings.** The plugin does not read, write, display or log
  credentials. It edits the *reference* to a credential (`apiKeyEnv`) only insofar as the Models
  page already owns that field — which is to say, not at all.
- **No secrets in the preview.** The effective-header preview masks sensitive values on the host
  before the response is sent, so a sensitive value has no reason to reach the browser.
- **No dynamic code execution.** `eval`, `new Function` and `setTimeout`-with-a-string are absent
  from the sources and lint-blocked.
- **The `fetch` wrapper is inert outside an LLM request.** Global headers need a transport seam,
  and DSH exposes none. The plugin scopes them with `AsyncLocalStorage` and installs one refcounted
  `fetch` replacement that forwards untouched whenever no request is in flight. Concurrent requests
  cannot see each other's headers — there is a 100-request test for exactly that.
- **Same-origin routes.** The host half registers its RPC routes behind a loopback peer check, a
  loopback Host check, a same-origin Origin check, a JSON content type requirement and a 128 KiB
  body cap. It is read-only apart from nothing: the host half never writes settings.

## Development

```bash
npm install
npm run build        # bundles lib/index.js + lib/client.js and emits lib/types/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest
npm pack --dry-run   # packaging check
```

Both halves must ship prebuilt. DSH's `dsh plugin` command is a `pnpm` forwarder with no build
step, and pnpm 10+ blocks the `prepare` script for git dependencies, so `lib/index.js` and
`lib/client.js` are **committed** and regenerated by `npm run build`. `.gitattributes` marks them
generated so they do not drown a diff, and `prepack` rebuilds them for every published tarball. The client bundle is wrapped in the
`window.__ModuleLoader__.load({ id, factory })` envelope the shell expects, and its `require` calls
are restricted to the shell's static module table:

`react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`,
`@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`,
`@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-dockkit`.

By design this plugin requires **none** of `dsh-client-locale` or `dsh-client-ui-settings` — they
are not in that table. It reaches locale and settings as cordis services instead. A test asserts
this against the built bundle.

### Layout

```
src/shared/    constants read out of the Harness schema, validation, diffing, summary
src/host/      namespace registration, the header bridge, discovery, diagnostics, RPC routes
src/client/    slot registration, the provider card panel, the settings page, locales, styles
tests/         unit tests plus integration tests against the built artifacts
docs/recon/    the source-level reconnaissance this implementation is based on
```

## Known issues

- **`npm pack` and `git` installs build from source.** The published tarball includes `lib/`.
  Installing straight from a git URL requires a build-capable install path, which pnpm 10's
  `allowBuilds` policy may refuse. Prefer the release tarball or the npm package.
- **Harness UI internals can change between minor versions.** If a future release renames a slot or
  changes its owner props, the affected seat renders nothing rather than throwing — but the feature
  is gone until this plugin is updated. The Diagnostics panel makes that visible.
- **Route-level compatibility flags that the protocol does not read are reported, not blocked.**
  Harness silently skips them; this plugin flags them so the mistake is visible, but still lets you
  save. A *model-level* mismatch is refused, because Harness treats it as a hard error.
- **Static English strings in a few technical places.** Compatibility flag names (`supportsStore`,
  `thinkingFormat`, …) are identifiers and are shown verbatim rather than translated; their
  descriptions are English tooltips. All UI copy is otherwise localized (English and Simplified
  Chinese).
- **Provider failover is out of scope.** It is deliberately deferred and not attempted here.
- **A package the loader cannot locate is skipped in silence.** If a plugin's `exports` map does
  not resolve, its browser half simply never loads — no error, no log, no diagnostic. This package
  publishes both `exports['.']` and `exports['./package.json']` so that neither of the loader's two
  discovery paths can drop it. If you fork this and the UI stops appearing with nothing in the
  console, check that first.
- **`dsh.client.immediately` has no effect in this Harness build.** The loader validates
  and stores the flag but never consults it: every `dsh.client` package is preloaded in the
  application batch. Declaring `immediately: false` does not defer anything, and no plugin
  can stay unloaded. See `docs/recon/client-runtime.md`.
- **`transport: 'auto'` is passed through verbatim.** This plugin does not second-guess the
  adapter's choice, and does not validate that the endpoint supports the transport you pick.

## License

[MIT](./LICENSE)
