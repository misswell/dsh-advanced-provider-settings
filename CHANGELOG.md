# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-09-22

### Breaking

**This release requires DeepSeek Harness `0.1.7` or later, and supports nothing older.** 0.1.7
rewrote the settings layer this plugin is built on, and it did so by removing the API rather than by
deprecating it: there is no `ctx.settingsScope` in the browser any more, and there is no
`settings.register()` on the host. Both halves are now written against the new shape with no
compatibility path back, so `v0.2.1` is the release to install on an older Harness.

On a `0.1.6` or older host this plugin's browser bundle fails to activate, and the web boot says so
(`dsh-advanced-provider-settings: pending (waiting for service: settingsScope)`) rather than half
working — which is the intended failure, because a silently degraded settings panel is worse than a
missing one.

### Changed

- **A namespace is now declared, never registered.** In 0.1.7 the settings directory is derived from
  each profile entry's own `Config`, keyed by the entry's `id`. So the host half declares
  `export const Config` with `.volatile()` on every field the browser edits — an entry with no
  volatile field gets no namespace at all — and reads its own settings out of the `config` argument
  `apply` receives, which is a live reader rather than a snapshot. `settings.configure({ auto: false })`
  turns off the generated page for this entry, owned by this plugin's fiber so unloading hands the
  policy back.
- **The browser writes through the framework's transport, and can tell "refused" from "conflicted".**
  Reads go through `ctx.configForms.get(entryId)`, page visibility through `acceptView`, and the three
  seats through `ctx.configForms.whileServed(namespaces, register)` — so nothing mounts when the host
  serves no `llm-pi-ai`. Writes go through `ctx.remote.settings.mutate(ns, ops, expectedRevision)`,
  whose result distinguishes a revision conflict from a refused write; the older
  `settingsScope.bind()` collapsed both into one error and the panel could not have said which happened.
- **`webServer` left the required-services list and became a child fiber.** See *Fixed* below.

### Fixed

**The same-origin RPC routes never registered at all — on every release up to and including 0.2.1.**
`apply` asked for the web server with `ctx.get('webServer')`, which reads what the composition has
provided *at this moment*. This entry requires only `settings` and `llm`, so it activates before the
web server exists and that read came back `undefined`: no routes, no error, no log line. Every
server-backed feature was therefore dead on a real install — `/dsh-advanced-provider-settings/health`
answered 404, `POST /rpc` answered 405, and *Diagnostics*, *Discover Models* and the legacy-import
probe had nothing to talk to. Reading the bundle at rest cannot find this: the code is correct for
the ordering `ctx.get` would have if the plugin required the service, and the composition simply
never reaches that ordering. The routes are now attached through `ctx.inject(['webServer'], …)`, a
child fiber that waits for the service and is disposed with the plugin, which keeps the headless case
working — a profile with no web server still mounts the settings namespace and the header bridge.

- **The Diagnostics panel reported its own settings namespace as missing on a healthy install.** The
  probe asked whether the directory contained `dsh-advanced-provider-settings` — the *package* name —
  while 0.1.7 keys namespaces by profile *entry* id, which this bundle's own patch layer sets to
  `advanced-provider-settings`. Both spellings are correct identifiers for one install, so the probe
  now checks the entry id and the panel tells the truth.
- **The stream listener is subscribed before the header bridge is installed.** Between the two steps a
  stream can already begin; subscribing first means it passes through the wrapper instead of finding
  it not yet in place.
- **The duplicate-plugin warning now fires after the bridge is installed**, so the thing it warns
  about — two writers putting the same header on the wire — is really true at the moment it is said.

### Verification

Against a live `0.1.7-alpha.1` boot on the `web` profile: no activation warning in the boot log;
`GET /dsh-advanced-provider-settings/health` → `200 {"ok":true,"version":"0.3.0"}`; the diagnostics
RPC reports `dshVersion`, `settingsNamespace`, `providerNamespace`, `settingsRevision`,
`settingsWritable`, `headerRuntime` and `settingsRoutes` all `ok`. In the real browser UI the *Provider
高级设置* page mounts with its three cards, `添加 Header` → `保存` writes through the 0.1.7 transport
into the profile's `cordis.patch.yml`, and the host reads the same value back as `source: global`
via `effective-headers`. The test fakes now model what the real host does — `ctx.get('webServer')`
returns `undefined` at apply time — so the defect above cannot come back quietly.

Gates: `tsc --noEmit`, `eslint .`, `node scripts/build.mjs`, and 288 tests across 10 files.

## [0.2.1] — 2026-09-21

### Fixed

**The panel now has a measurable spacing system instead of an eyeballed one.** Every gap was rendered
headlessly and read off computed geometry, which exposed three defects no amount of reading markup
would have:

- **Section descriptions sat directly on top of their content.** `Note` and the card description
  carried an inline `style={{ margin: 0 }}`, so no stylesheet margin could ever apply to them — the
  distance from "what this section is for" to the first control was 0px on every card in the panel.
  The inline overrides are gone; the gap is now 8px.
- **The thinking-level grid had no row gap.** Seven fields in an auto-fit grid wrap to two rows at any
  normal width, and the second row's labels (`高`, `极高`, `最大`) were printed over the first row's
  inputs.
- **Filled notice boxes touched whatever surrounded them.** A warning or danger callout is the one
  block in a card that has its own background, and it needs air to read as a block rather than as a
  band across the card.

### Changed

- **One inset per card.** Rows previously pulled themselves 10px out of the card body with a negative
  margin, so a row's hairline — and an empty state's text — landed 10px left of the column every other
  line in the same card was aligned to. The card body owns the padding now and nothing fights it; the
  overridden-row accent bar moved into the 8px gutter that leaves, so a marked row's label still lines
  up with its unmarked neighbours. Measured left edges are now 13 / 26 / 37px for the three nesting
  levels, previously a mix of 2px and 12px.
- **The two disclosure levels are now distinguishable without reading them.** A provider's section
  cards sit 8px apart inside a 34px-tall header; the plugin's own top-level cards sit 14px apart inside
  a 40px-tall one. Both levels carry the same title-plus-chip shape, so size and rhythm are what say
  which level you are on.
- **Lint no longer runs over local scratch.** `.tmp/` was already gitignored, and `eslint .` walked
  into the throwaway preview harness there and failed the gate on it.

## [0.2.0] — 2026-09-21

### Added

**Per-provider settings are now editable on the plugin's own settings page.** The page used to print
one read-only line per provider and send you to the Models page for the controls, which made the
destination look like a status screen. It now lists the configured providers as a choice row and
mounts the full editor — headers, retry, network, vision, reasoning, compatibility, models, effective
configuration — for the selected one. Both surfaces write through the same revision-fenced scope, so
the card on the Models page and this page are two views of one configuration, not two copies.

- Switching providers while the editor holds unsaved edits is refused, with the reason stated: the
  draft belongs to one provider and switching would otherwise drop it silently.

### Changed

**The model, not the provider, is the primary unit of configuration.** A panel that only showed
provider-wide cards made every model on a route look equally configured — but "can *this* model take
images?" is the question people arrive with, and the answer differs per model. *Models* is now
*Per model*: a one-at-a-time master-detail editor, mounted first in the panel, so the model list is
where configuration starts rather than one more form at the bottom.

- **Both disclosure levels start folded.** The three cards on the settings page and every section
  inside the editor open closed, including *Per model*. A card header already carries the chip that
  says what is configured there (`2 items`, `Always retrying`, `Custom`), so the page reads as an
  index of answers and you expand only the one you came for. Opening every section that held an
  override — which is what a configured provider does — turned the page into a wall of forms.
- **A row of model pills selects the model.** An `IMG` / `图` mark shows a model that declares image
  input, a dot shows one that already carries overrides (with the count in the tooltip), and a filter
  box appears past eight models so a long catalog stays usable. The editor header states the model id
  it is editing and offers *Clear every override on this model*, and the model list is never reordered
  or renamed — entries are addressed by index.
- **The editor shows exactly the fields a model entry accepts.** Harness's schema permits `input`,
  `reasoningEfforts` and `compat` on a model, and strict validation **rejects a settings write that
  puts anything else there**. So there are no per-model retry, header, network, image-budget or
  cache controls to hunt for; the editor states that boundary in prose instead of shipping buttons
  that would fail on save.
- **An inherited model-level flag names what it inherits.** Each un-overridden `compat` flag in the
  model editor now reads `Inherited from the route: Supported` / `当前沿用路由级：支持`, so comparing a
  model against its provider no longer means switching sections and holding the value in memory.
- **Every provider-wide card says so in its own description** — headers, retry, network, vision and
  reasoning each state that the value applies to all models on the route, and vision and reasoning
  point at *Per model* for the part that is per-model.
- **The override bar stopped lying.** A choice row whose value was the `inherit` sentinel painted the
  accent bar as if you had set it; the bar is the one mark that claims "this is yours", so `ChoiceRow`
  now takes the fact explicitly.
- Alongside this, 24 dictionary keys left over from the previous nested-accordion layout were removed
  from both locales.

**The configuration surface is visual rather than a form.** A field that showed `supportsStore` as
its label, or `300000` in a box with no unit, tells you what a value is but not what it does. Every
control now answers one of the questions a form leaves open — and answers it once, not five times.

- **One row, one setting.** Each section is a card whose head carries the title, a status badge and
  one line describing what the card edits. Below it, hairline-separated rows each hold a label, at
  most one line of explanation, and exactly one control. A value that used to appear as a slider
  overlay, a range input, a text box, a human-readable echo, a "default is X" caption, a reset button
  and a status dot now appears as the number, its unit, and one sentence.
- **Every identifier is named and explained.** All 26 `compat` flags, the seven thinking levels, the
  four transports, the three cache-retention tiers and the compat enum options have real labels and
  a one-line description in both locales (about 145 new keys per dictionary). The wire identifier is
  kept as a monospace subtitle so it can still be matched against provider documentation.
- **Compat flags are grouped by what they change** — request fields, streaming, reasoning, tool
  calls, caching — with a per-group count of how many members are overridden, and a filter that
  appears once the list is long enough to need one. Tri-state is preserved: `Inherit` is not `Off`.
- **A number carries its unit inside its box**, and the inherited default is the placeholder rather
  than a third widget. An inherit button appears only on a row that actually overrides something, and
  it removes the override instead of pinning today's number.
- **Durations and byte budgets are said out loud** — `2 分钟`, `10 MiB` — so a value that is wrong by
  a factor of 1000 stops looking plausible. The pixel budget is the one row that restates its value,
  because converting it to `≈ 1448 × 1448 像素` says something the box cannot.
- **An accent bar on the row's left edge is the only per-field status mark.** A dot plus a word for
  "overridden" repeated on most rows and left nothing for a real warning to distinguish itself from.
- **Pills are the single selection vocabulary** — transport, cache tier, thinking level, retry mode
  and retry preset — so one kind of choice is never rendered three ways.
- **A coloured box now always means a decision is needed.** Explanatory prose is plain text; only
  warnings, blocking errors and action results get a fill.
- **The retry policy is drawn** as a backoff curve: one bar per attempt, sized by the real delay,
  with the total wait.
- **Every card header states what is inside it**, through a status chip rather than a body of text —
  the rule the default-collapsed panel above now depends on.
- **The panel is themed by the shell, not by itself.** Every colour resolves to a `--dsw-alias-*`
  token and every size is derived from `--dsh-content-font-delta`, so it follows the host's theme and
  the user's Settings font size instead of painting on hardcoded fallbacks.

### Fixed

- **A per-model `compat` override was silently dropped on save.** The model editor wrote
  `models.<i>.compat` into the draft, painted the row's accent bar and counted it among the model's
  overrides — but the managed-key table the diff is taken from (`MANAGED_MODEL_KEYS`) listed only
  `input` and `reasoningEfforts`, so no operation was ever emitted for it. The edit looked applied
  until the panel reloaded, when it disappeared — and *Reset all advanced settings* could not clear a
  key it never wrote either. `compat` is now in that table, the section badge and the editor's override count
  both derive from it rather than restating it, and a test asserts the whole-config diff a save uses
  round-trips a model-level `compat` value.
- **The effective-configuration preview printed its own dictionary keys.** `cacheRetention`, the
  three timeouts, `defaultInput` and every `compat.*` line rendered literally as
  `preview.key.compat.supportsStore`, because those keys were never in either dictionary. Each preview
  line now names itself, compat lines reuse the flag's own label rather than a second copy of it, and
  a render test fails if any requested key is missing from the shipped dictionary.
- **"Open Models" was a label, not a button.** The page ended with a field carrying that label and
  two namespace chips under it; nothing was clickable, so it advertised an action it could not
  perform. Removed — the two namespaces it printed are already reported by the diagnostics probes.
- **A wide enum control squeezed its own label into a vertical ribbon.** On `thinkingFormat`, whose
  13 options are the widest control in the panel, the rigid two-column flag row left the label one
  character wide. Flag rows now wrap, and the group's control moves below the text when it does not
  fit.
- **`chatTemplateKwargs` and `chatTemplateArgs` were unusable.** Both are `dict` fields and fell
  through to the enum branch, which has no options for them, so an already-set value rendered as
  `[object Object]` and could not be edited. They now accept JSON in a box that spans the row, and a
  half-typed object is discarded rather than written.
- **`formatBytes` is reachable and consistent with the Vision section.** It quotes KiB/MiB/GiB to
  match the schema's powers of two.

## [0.1.0] — 2026-09-17

First release. Verified against DeepSeek Harness `0.1.5-rc.2`.

### Added

**Provider advanced settings** — an "Advanced Settings" panel inside every OpenAI-compatible
provider card on the Models page, contributed through the `settings.models.provider-card`
extension seat rather than through DOM inspection:

- **Headers** — per-provider request headers with name/value validation (token grammar, CRLF
  rejection, non-empty values), case-insensitive duplicate detection, and automatic masking of
  secret-like values. Warnings for the two header traps in this Harness version: a provider-level
  `User-Agent` is discarded by Harness attribution, and a configured `authorization` can displace
  the resolved credential.
- **Global headers** — a second header layer applied to every provider request, on its own settings
  page, with User-Agent presets (Chrome, Safari, Firefox, opencode, Codex CLI, Claude CLI).
- **Retry policy** — Harness Default / Conservative / Aggressive presets plus a custom editor for
  mode, max retries, retryable codes, initial delay, max delay and jitter. Validation mirrors the
  Harness resolver rather than the looser schema, so values that would throw at profile resolution
  are rejected in the form. `always` is gated behind an explicit acknowledgement.
- **Network** — transport, request timeout, stream idle timeout, WebSocket connect timeout and
  cache retention, with an explicit note that Harness rejects provider-level `maxRetries` and
  `maxRetryDelayMs`.
- **Vision** — default input modalities and the three image limits, edited in human units (B/KiB/
  MiB/GiB) with a pixel-budget square hint.
- **Reasoning** — thinking level (`off` … `max`) and per-level token budgets, with a note that
  Harness folds `xhigh` and `max` onto the high budget.
- **Compatibility** — all 26 `compat` flags, filtered to those the route's protocol actually reads,
  and filtered harder at model level where a mismatch is a hard error rather than a no-op.
- **Models** — per-model input modalities, per-model reasoning-effort mapping and per-model
  compatibility overrides, addressed by index so a model list is never reordered or renamed.

**Test Provider** — interrogates the endpoint's model list using the headers currently in the form,
saved or not, through the same request-scoped header bridge the stream path uses.

**Effective configuration** — a layer-by-layer preview of what the provider will actually send, with
sensitive values masked on the host before the response is sent.

**Diagnostics** — a read-only compatibility report (detected Harness version, namespace
availability, revision-fenced write support, header bridge state, Models-page extension package,
legacy plugin presence) with a copy button.

**Migration** — detects the retired `dsh-custom-provider-settings` plugin, warns when both are
active, and offers to import its global header mapping without overwriting headers already set.

### Engineering

- Writes go through the framework's revision-fenced settings transport as ordered path operations;
  unknown fields, comments and untouched values are preserved by construction.
- "Harness default" deletes the key rather than writing today's default value, so future Harness
  releases that change a default are inherited rather than pinned.
- Global headers are applied through an `AsyncLocalStorage`-scoped, refcounted `globalThis.fetch`
  replacement that is completely inert when no LLM request is in flight. A 100-request concurrency
  test asserts zero cross-contamination between providers.
- Host RPC routes are guarded by loopback-peer, loopback-Host, same-origin-Origin, JSON
  content-type and 128 KiB body-cap checks.
- The browser bundle is wrapped in the `window.__ModuleLoader__.load` envelope and requires only
  the shell's static module table. It deliberately does not require `dsh-client-locale` or
  `dsh-client-ui-settings`, which are not requirable; both are reached as cordis services instead.
- 261 automated tests covering header precedence and validation, retry semantics, config diffing
  and preservation, vision conversion, request-scoped header isolation, request guarding, the RPC
  envelope, migration, the built artifacts themselves, slot registration driven through the real
  DeepSeek Harness `SlotCore`, and the boot composition driven through the real
  `dsh-client-modules` registry — rather than hand-written doubles throughout.
- Server-rendered component tests over the browser half, which is what catches the defects that
  typecheck and unit-test clean: a hook after an early return, a `useSyncExternalStore` snapshot
  that is a fresh object on every read, or a dictionary key a code path asks for but no dictionary
  defines.
- Every render test records the dictionary keys the tree requests and asserts each one exists, so a
  new section, badge or advisory with no translation fails the suite instead of reaching a user as
  a raw key.
- English and Simplified Chinese localization with an exhaustive key type, so a missing translation
  fails `npm run typecheck`.

### Notes

- The Advanced Settings area remembers whether you left it expanded
  (`ui.advancedExpanded`), so a page with many providers does not make you
  re-expand the same card on every visit.
- `timeout` and `transport` are separate fields in the Harness schema and are edited together in a
  single Network section. The collapsed summary folds them for the same reason, so the row shows
  one Network entry rather than two identically labelled ones.
- Verified end to end against a live DeepSeek Harness `0.1.5-rc.2` instance: the plugin installs
  into a profile, the server serves its browser bundle byte-for-byte, the host half answers all ten
  diagnostics probes, the RPC guard refuses cross-site and non-JSON requests, and the panel renders
  in the Models page and the settings nav with an empty browser console.

- Provider failover is explicitly out of scope for this release.
- Not supported on DeepSeek Harness `0.1.4` or earlier: the extension seat and the client-side
  settings mutation API this plugin depends on do not exist there.

[0.3.0]: https://github.com/misswell/dsh-advanced-provider-settings/releases/tag/v0.3.0
[0.2.1]: https://github.com/misswell/dsh-advanced-provider-settings/releases/tag/v0.2.1
[0.2.0]: https://github.com/misswell/dsh-advanced-provider-settings/releases/tag/v0.2.0
[0.1.0]: https://github.com/misswell/dsh-advanced-provider-settings/releases/tag/v0.1.0
