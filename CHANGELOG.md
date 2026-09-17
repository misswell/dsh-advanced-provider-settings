# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2025-09-17

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

[Unreleased]: https://github.com/misswell/dsh-advanced-provider-settings/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/misswell/dsh-advanced-provider-settings/releases/tag/v0.1.0
