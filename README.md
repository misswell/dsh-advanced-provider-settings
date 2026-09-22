# Advanced Provider Settings for DeepSeek Harness

**Advanced Provider Settings** is a WebUI plugin for **DeepSeek Harness** (DSH) that turns the
hidden half of an OpenAI-compatible provider into something you can see and edit. Instead of
hand-editing the profile YAML (`~/.dsh/profiles/<profile>/cordis.patch.yml`), you get a real control
panel — on its own settings page and on
every provider card — and it is built around the **model**: pick one, then give it its own input
modalities, reasoning-effort mapping and compatibility flags. Everything that can only apply to the
provider as a whole — request **Headers**, **User-Agent** control, **Retry Policy**, **Timeout** and
transport, **Vision** image budgets, **Reasoning** thinking levels, route-level **Compatibility**
flags — sits in provider-level cards that each say why they are not on the model. All of it is
written through DeepSeek Harness's own revision-fenced settings transport, so your YAML keeps its
comments and every field you never touched stays exactly as it was.

> **Status:** `v0.3.0`. Verified against DeepSeek Harness `0.1.7-alpha.1`.

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
whether an image-heavy prompt is rejected before it is sent — live in that YAML and nowhere
else.

This plugin surfaces those fields without touching a single line of Harness source, without
patching anything in `node_modules`, and without owning a second copy of your configuration. It
adds UI through the Models page's **declared extension slots**, and it reads and writes the
`llm-pi-ai` settings namespace through the framework's public settings API.

## What you can configure

Configuration has two levels: a **model** setting is edited one model at a time, and a **provider**
setting applies to every model on the route. That split is not a UI preference — it is the Harness
schema, which accepts only `input`, `reasoningEfforts` and `compat` on a model entry and rejects
anything else by name.

| Area | Level | What you get |
|---|---|---|
| **Per model** | Model | For the model you select: what input it accepts (text / image), the reasoning-effort mapping it actually sends on the wire, and its `compat` overrides — each flag showing the route value it falls back to. |
| **Headers** | Provider / global | Per-provider and global request headers, with validation, secret masking and duplicate detection. |
| **User-Agent** | Global | Presets (Chrome, Safari, Firefox, opencode, Codex CLI, Claude CLI) plus free text, for gateways that whitelist clients. |
| **Retry Policy** | Provider | Harness default / Conservative / Aggressive presets, or a custom policy: mode, max retries, retryable codes, initial delay, max delay, jitter. |
| **Network** | Provider | Transport (`sse`, `websocket`, `websocket-cached`, `auto`), request timeout, stream idle timeout, WebSocket connect timeout, cache retention. |
| **Vision** | Provider | The fallback input type for models that declare none, max image bytes per request, pixel budget, max bytes per image — with human units (MiB) instead of raw byte counts. |
| **Reasoning** | Provider | Thinking level (`off` … `max`) and per-level token budgets. |
| **Compatibility** | Provider | All 26 `compat` flags, filtered to the ones your route's protocol actually reads. The model-level half lives under *Per model* and is filtered harder, because a mismatch there is a hard error in Harness. |
| **Test Provider** | Provider | Interrogates the endpoint's model list using the headers *currently in the form*, saved or not — the fastest way to prove a whitelist header works. |
| **Effective configuration** | Provider | A preview of exactly what the provider will send, layer by layer, with sensitive values masked. |
| **Diagnostics** | Global | Read-only compatibility report you can paste into a bug report, plus one-click import from the retired `dsh-custom-provider-settings` plugin. |

## Install

Requires DeepSeek Harness `0.1.7` or a compatible build, and Node.js 20+.

```bash
# Straight from the repository — no build step, no npm publish
dsh plugin --profile web add github:misswell/dsh-advanced-provider-settings

# From a GitHub release tarball (a fixed, content-hashed artifact)
dsh plugin --profile web add https://github.com/misswell/dsh-advanced-provider-settings/releases/download/v0.3.0/dsh-advanced-provider-settings-0.3.0.tgz

# From npm, once published
dsh plugin --profile web add dsh-advanced-provider-settings
```

All three work without a build on your machine. `lib/` is committed on purpose: `dsh plugin` runs
no build step, and pnpm 10+ blocks a git dependency's `prepare` script, so a plugin that needs
building must ship its output.

Then restart the web UI:

```bash
dsh web
```

## Uninstall

```bash
dsh plugin --profile web remove dsh-advanced-provider-settings
```

Removing the package removes the UI, and with it this plugin's own settings namespace: on 0.1.7 a
namespace *is* a profile entry's `Config`, so dropping the entry drops the global header list and the
UI preferences stored under it. **Your provider configuration is untouched** — the advanced fields
keep working, because they were written to Harness's own `llm-pi-ai` entry, which this plugin never
owned. Both live in the active profile's user layer, `~/.dsh/profiles/<profile>/cordis.patch.yml`; to
clear the fields this plugin set by hand, delete the `providers.<id>` keys under the `llm-pi-ai` entry
(or use *Reset all advanced settings* on each provider card first, which shows what is about to go).

## Using it

1. Open **Settings → Provider Advanced**, expand **Provider configuration**, and pick a provider; or
   open **Settings → Models** and expand any OpenAI-compatible provider card. Both surfaces edit the
   same configuration.
2. **Both disclosure levels start folded**: the three cards on the settings page (global headers,
   provider configuration, diagnostics) and every section inside the editor. Each card header carries
   its own status chip — `2 items`, `Always retrying`, `Custom`, `Default` — so you can see where
   configuration lives, and how much, without opening anything, and expand only the card you came for.
3. Edit, then **Save**. Changes are written as path-addressed operations against the namespace
   revision you were reading, so a concurrent edit is refused rather than silently clobbered.
4. The **Provider Advanced** page also owns the two cross-provider surfaces: the **global header
   list** every request carries, and diagnostics.

### Reading the controls

- **Pick the model first.** The top of *Per model* is a row of model pills: an **IMG** mark means that
  model declares image input, and a dot on the right means the model already carries overrides.
  A filter box appears past 8 models. You edit one model at a time; the editor header shows its id
  and offers *Clear every override on this model*.
- **A control that is missing from the model is one Harness refuses.** A model entry accepts only
  input modalities, the reasoning-effort mapping and `compat`, so headers, retry, network, image byte
  budgets and cache retention appear at provider level only — and the model editor states that
  boundary at its foot instead of offering buttons that would be rejected on save.
- **One row is one setting.** A card holds its rows separated by a hairline, and each row is a label,
  at most one line of explanation, and one control. A row whose value you set yourself carries an
  accent bar on its left edge — that bar is the only per-field status mark, so a warning still stands
  out from it.
- **The unit lives inside the number box**, and the inherited default is the placeholder rather than a
  second widget. **Inherit** appears only on a row that actually overrides something, and it removes
  the override so the value tracks Harness again instead of being pinned to today's number.
- **A model-level compatibility flag names what it inherits.** When the model does not override a
  flag, its explanation ends with `Inherited from the route: Supported`, so you never have to switch
  back to the provider-level list to compare.
- **Durations and budgets are said out loud**: `2 min`, `5 min`, `10 MiB`. A value that is off by a
  factor of 1000 stops looking plausible. The pixel budget is the one row that restates its own value,
  because turning it into `≈ 1448 × 1448 pixels` says something the box cannot.
- **A coloured box always means a decision is needed.** Explanatory prose is plain text; only warnings,
  blocking errors and the result of an action get a fill.
- **Thinking levels are pills, and the fold is stated in words.** `xhigh` and `max` are accepted by the
  schema but folded to `high` before the request leaves, and the row says so rather than offering a
  granularity that does not exist.
- **The backoff curve** draws the retry policy: one bar per attempt, sized by the real delay, with
  the total wait. `4 retries, 500 ms, doubling, capped at 8 s` is a shape, and it is easier to
  sanity-check as one.
- **Compatibility flags** are grouped by what they change — request fields, streaming, reasoning,
  tool calls, caching — each with a plain-language name and a one-line explanation. The wire
  identifier is kept as a monospace subtitle so you can still match it against provider docs, and
  a filter appears once the list is long enough to need one. Three states are kept per flag:
  `Inherit` is not the same as `Off`, because it leaves the decision to the adapter.

## Three behaviours that surprise people

These are properties of DeepSeek Harness `0.1.7-alpha.1` that this plugin surfaces rather than hides.
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

### 3. Only three things are per-model, and retry is not one of them

A model entry in Harness accepts `input`, `reasoningEfforts` and `compat` — nothing else.
`retryPolicy`, headers, transport and timeouts, image byte budgets and cache retention are configured
on the provider route; there is no per-model retry, and there is no global retry. This plugin shows
that boundary instead of hiding it: *Per model* carries those three control groups and its footer
states which fields are provider-wide, while every provider-level card says in its own description
that the value applies to all models on the route. So you look for the boundary, rather than for a
switch that Harness would reject.

## Compatibility matrix

| DeepSeek Harness | Status | Notes |
|---|---|---|
| `0.1.7-alpha.1` | **Verified** | Every constant and code path in this release was read from this build and exercised against it. |
| other `0.1.7-*` | Expected to work | Release candidates inside one patch series have not changed the provider schema historically, but this is untested. |
| `0.1.6` and earlier | Unsupported | 0.1.7 rewrote the settings layer this plugin is built on: a namespace is now derived from a profile entry's own `Config`, and the browser writes through `configForms` and `remote.settings`. Neither exists before 0.1.7 — install `v0.2.1` there instead. |
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
src/host/      entry config schema, the header bridge, discovery, diagnostics, RPC routes
src/client/    slot registration, the provider card panel, the settings page, locales, styles
tests/         unit tests plus integration tests against the built artifacts
docs/recon/    the source-level reconnaissance this implementation is based on — per Harness
               version, and written against 0.1.5-rc.2. What 0.3.0 changed there is in the
               `0.3.0` changelog entry; treat those reports as history, not as the current API.
```

## Known issues

- **A git install fetches the whole repository, not just the package.** It works with no build —
  `lib/` is committed precisely so it does — but it also pulls `src/`, `tests/` and `docs/`, and the
  revision you get is whatever the branch tip is at that moment. Use the release tarball if you want
  a fixed, content-hashed artifact. If you fork this, keep `lib/` committed and keep the `prepack`
  script from becoming a `prepare` script, or git installs will start failing for everyone downstream.
- **Harness UI internals can change between minor versions.** If a future release renames a slot or
  changes its owner props, the affected seat renders nothing rather than throwing — but the feature
  is gone until this plugin is updated. The Diagnostics panel makes that visible.
- **Route-level compatibility flags that the protocol does not read are reported, not blocked.**
  Harness silently skips them; this plugin flags them so the mistake is visible, but still lets you
  save. A *model-level* mismatch is refused, because Harness treats it as a hard error.
- **Enum *values* that are wire syntax keep their literal spelling.** A thinking format is shown
  as `deepseek` or `chat_template_kwargs` because that string is what the endpoint receives and
  what provider documentation names; translating it would break the correspondence. The field
  *names*, the groups they sit in, the option descriptions and every level are localized.
- **A route with no `models` list has no per-model seat.** *Per model* edits the model list the route
  declares for itself; a route served by the installed catalog uses a different channel in Harness,
  `modelOverrides.<id>`, which covers the same three fields. This plugin has no UI for that yet, so on
  such a route you either declare the models on the Models page or edit the YAML by hand.
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
