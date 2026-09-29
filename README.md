# Advanced Provider Settings for DeepSeek Harness

[English](./README.md) · [简体中文](./README.zh-CN.md)

**Advanced Provider Settings** is a WebUI plugin for **DeepSeek Harness** (DSH) that turns the
hidden half of an OpenAI-compatible provider into something you can see and edit. Instead of
hand-editing the profile YAML (`~/.dsh/profiles/<profile>/cordis.patch.yml`), you get a real control
panel — on its own settings page and on every provider card — and it is built around the **model**:
pick one, then give it its own input
modalities, reasoning-effort mapping and compatibility flags (and, on a route served by the installed
catalog, its own name, context window and output-token cap). Everything that can only apply to the
provider as a whole — request **Headers**, **User-Agent** control, **Retry Policy**, **Timeout** and
transport, **Vision** image budgets, **Reasoning** thinking levels, route-level **Compatibility**
flags — sits in provider-level cards that each say why they are not on the model. All of it is
written through DeepSeek Harness's own revision-fenced settings transport, so your YAML keeps its
comments and every field you never touched stays exactly as it was.

It exists above all for the case DSH serves worst out of the box: pointing Harness at a **third-party
DeepSeek endpoint** — a cloud gateway, a corporate proxy, a self-hosted vLLM or llama.cpp behind
nginx — where nothing in the URL tells the adapter that the models behind it *think in DeepSeek's
dialect*. Compatibility is detected from the provider id and the base URL, so such a route silently
gets OpenAI-shaped defaults: the **thinking level** you pick is shaped in a way the endpoint does not
understand, the output cap is spelled with the wrong field name, and a request field your vendor does
not implement is sent anyway. This plugin lets you declare the dialect per route and per model, set
the thinking ladder and its token budgets, and see what will leave the machine before a request fails
halfway through a session.

> **Status:** `v0.4.3`. Verified against DeepSeek Harness `0.1.7-alpha.1`.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [At a glance](#at-a-glance)
- [What you can configure](#what-you-can-configure)
- [Install](#install)
  - [Web UI — the `web` profile](#web-ui--the-web-profile)
  - [Desktop app — the `desktop` profile](#desktop-app--the-desktop-profile)
- [Uninstall](#uninstall)
- [Using it](#using-it)
- [Thinking levels, in depth](#thinking-levels-in-depth)
- [Worked examples](#worked-examples)
  - [Example 1 — a third-party DeepSeek endpoint](#example-1--a-third-party-deepseek-endpoint)
  - [Example 2 — the same models on a catalog route](#example-2--the-same-models-on-a-catalog-route)
  - [Example 3 — a gateway that whitelists clients](#example-3--a-gateway-that-whitelists-clients)
- [Behaviours that surprise people](#behaviours-that-surprise-people)
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
whether an image-heavy prompt is rejected before it is sent, and whether a DeepSeek-compatible
endpoint ever receives the thinking level you asked for — live in that YAML and nowhere else.

That last one is the sharpest case, because it fails without saying anything. `thinkingFormat`,
`supportsReasoningEffort` and `maxTokensField` are detected from the base URL, and only a URL
containing `deepseek.com` is detected as DeepSeek. Every other host that serves DeepSeek models —
Ark, a cloud aggregator, your own vLLM behind a reverse proxy — is treated as *OpenAI itself*: the
thinking parameter is built in OpenAI's shape, `max_completion_tokens` is sent where the endpoint
wants `max_tokens`, and `store` is sent to servers that reject it. Nothing errors at configuration
time; the request simply does not do what the level you selected said it would.

This plugin surfaces those fields without touching a single line of Harness source, without
patching anything in `node_modules`, and without owning a second copy of your configuration. It
adds UI through the Models page's **declared extension slots**, and it reads and writes the
`llm-pi-ai` settings namespace through the framework's public settings API.

## At a glance

- **Thinking levels you can actually land.** The full ladder — `off`, `minimal`, `low`, `medium`,
  `high`, `xhigh`, `max` — as a route default and as a **per-model map** that decides the exact
  string each level becomes on the wire, plus the per-level token budgets.
- **Third-party DeepSeek, declared by hand.** `thinkingFormat: deepseek`, `reasoning_effort`
  support, the `max_tokens` spelling, DeepSeek-style reasoning replay and the fields your gateway
  rejects — all switchable per route and per model, because URL detection will not do it for you.
- **Two per-model channels, correctly separated.** A route that declares its own `models` list is
  edited in place; a route serving the installed catalog is edited through `modelOverrides.<id>`.
- **Not only reasoning.** Headers, User-Agent, retry policy with a drawn backoff curve, timeouts and
  transport, image byte budgets, cache retention and all 26 compatibility flags — each labelled with
  what it changes and filtered to what your protocol actually reads.
- **Safe by construction.** Path-addressed writes through the revision-fenced settings transport,
  no DOM scraping, no Harness source modification, no credentials in the preview.

## What you can configure

Configuration has two levels: a **model** setting is edited one model at a time, and a **provider**
setting applies to every model on the route. That split is not a UI preference — it is the Harness
schema. A model entry created by the route's own `models` list accepts only `input`,
`reasoningEfforts` and `compat`; a route that serves the installed catalog is configured per model
through the schema's other channel, `modelOverrides.<id>`, which accepts six fields. Everything else
— headers, retry, network, image byte budgets, cache retention — exists only at route level, and a
model entry that sets it is rejected by name.

| Area | Level | What you get |
|---|---|---|
| **Per model** | Model | For the model you select: what input it accepts (text / image), the **thinking level → wire value map** it actually sends, and its `compat` overrides — each flag showing the route value it falls back to. On a catalog route the same editor also covers the model's display name, context window and max output tokens, because nothing else edits that channel. |
| **Headers** | Provider / global | Per-provider and global request headers, with validation, secret masking and duplicate detection. |
| **User-Agent** | Global | Presets (Chrome, Safari, Firefox, opencode, Codex CLI, Claude CLI) plus free text, for gateways that whitelist clients. |
| **Retry Policy** | Provider | Harness default / Conservative / Aggressive presets, or a custom policy: mode, max retries, retryable codes, initial delay, max delay, jitter. |
| **Network** | Provider | Transport (`sse`, `websocket`, `websocket-cached`, `auto`), request timeout, stream idle timeout, WebSocket connect timeout, cache retention. |
| **Vision** | Provider | The fallback input type for models that declare none, max image bytes per request, pixel budget, max bytes per image — with human units (MiB) instead of raw byte counts. |
| **Reasoning** | Provider | The route's default **thinking level** (`off` … `max`) and the per-level token budgets. What each level becomes for a given model is set under *Per model*. |
| **Compatibility** | Provider | All 26 `compat` flags, filtered to the ones your route's protocol actually reads — including the **thinking dialect** (`openai`, `deepseek`, `openrouter`, `qwen`, `chat-template`, …) and the field that carries a thinking budget. The model-level half lives under *Per model* and is filtered harder, because a mismatch there is a hard error in Harness. |
| **Test Provider** | Provider | Interrogates the endpoint's model list using the headers *currently in the form*, saved or not — the fastest way to prove a whitelist header works. |
| **Effective configuration** | Provider | A preview of exactly what the provider will send, layer by layer, with sensitive values masked. |
| **Diagnostics** | Global | Read-only compatibility report you can paste into a bug report, plus one-click import from the retired `dsh-custom-provider-settings` plugin. |

## Install

Requires DeepSeek Harness `0.1.7` or a compatible build, and Node.js 20+.

Both profiles run the same artifact — one package, no build on your machine. What differs is who is
allowed to write to the profile.

### Web UI — the `web` profile

`dsh plugin` manages this profile, and all three sources work:

```bash
# Straight from the repository — no build step, no npm publish
dsh plugin --profile web add github:misswell/dsh-advanced-provider-settings

# From a GitHub release tarball (a fixed, content-hashed artifact)
dsh plugin --profile web add https://github.com/misswell/dsh-advanced-provider-settings/releases/download/v0.4.3/dsh-advanced-provider-settings-0.4.3.tgz

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

### Desktop app — the `desktop` profile

The app owns this profile, and the CLI refuses to touch it:

```console
$ dsh plugin --profile desktop add github:misswell/dsh-advanced-provider-settings
error: profile "desktop" is managed exclusively by the Electron application
```

Install it from inside the app instead: open **Plugin Marketplace** and install
`misswell/dsh-advanced-provider-settings`, then restart the app. The app writes exactly what the CLI
writes for a web profile — a dependency in `~/.dsh/profiles/desktop/package.json` **and** an entry in
that manifest's `dsh.profile.bundles` list, the entry that makes the plugin a profile layer rather
than a plain dependency. (If the app has no Plugin Marketplace page yet, install
`dsh-plugin-marketplace` first; the marketplace is itself a plugin.)

> If an install ends with `spawn pnpm ENOENT`, the app was launched with a minimal PATH — what a
> Finder- or Dock-launched macOS app inherits. Make a pnpm that matches the profile's store visible
> to GUI apps (`launchctl setenv PATH …`, then relaunch) and install again.

## Uninstall

```bash
dsh plugin --profile web remove dsh-advanced-provider-settings
```

In the desktop app, remove it on the same Plugin Marketplace page.

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
   its own status chip — `2 items`, `Always retrying`, `high`, `Custom`, `Default` — so you can see
   where configuration lives, and how much, without opening anything, and expand only the card you
   came for.
3. Edit, then **Save**. Changes are written as path-addressed operations against the namespace
   revision you were reading, so a concurrent edit is refused rather than silently clobbered.
4. The **Provider Advanced** page also owns the two cross-provider surfaces: the **global header
   list** every request carries, and diagnostics.

### Reading the controls

- **Pick the model first.** The top of *Per model* is a row of model pills: an **IMG** mark means that
  model declares image input, and a dot on the right means the model already carries overrides.
  A filter box appears past 8 models. You edit one model at a time; the editor header shows its id
  and offers *Clear every override on this model*.
- **Which channel is being edited is stated, not implied.** A route that declares its own `models`
  list is edited in place; a route served by the installed catalog is edited through
  `modelOverrides.<id>`, and the card says so — with the picker listing the catalog's live models and
  naming the layer that failed if the listing could not be read. An override whose model has since
  left the catalog still appears, marked, so it can be cleared rather than silently kept.
- **A control that is missing from the model is one Harness refuses.** On a listed model the entry
  accepts only input modalities, the reasoning-effort mapping and `compat`, so headers, retry, network,
  image byte budgets and cache retention appear at provider level only — and the model editor states
  that boundary at its foot instead of offering buttons that would be rejected on save. Name, context
  window and max output tokens are editable on a catalog override but deliberately left to the Models
  page on a listed model: one path, one writer.
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
  granularity that does not exist. A model that does not reason at all — `reasoningEfforts: false`, a
  model-level value with no provider-level equivalent — is declarable from the same editor, and
  *Inherit* clears it again.
- **The backoff curve** draws the retry policy: one bar per attempt, sized by the real delay, with
  the total wait. `4 retries, 500 ms, doubling, capped at 8 s` is a shape, and it is easier to
  sanity-check as one.
- **Compatibility flags** are grouped by what they change — request fields, streaming, reasoning,
  tool calls, caching — each with a plain-language name and a one-line explanation. The wire
  identifier is kept as a monospace subtitle so you can still match it against provider docs, and
  a filter appears once the list is long enough to need one. Three states are kept per flag:
  `Inherit` is not the same as `Off`, because it leaves the decision to the adapter.

## Thinking levels, in depth

Everything about reasoning in Harness is two-layered, and the two layers answer different questions:
**what level do we want** and **what does this endpoint call it**. This plugin exposes both.

### The ladder

`off` → `minimal` → `low` → `medium` → `high` → `xhigh` → `max`. The last two are accepted by the
schema but folded onto the `high` budget before the request leaves, so only `high` ever needs a
budget of its own; the Reasoning card says this in words next to the pills. Budgets exist for
`minimal`, `low`, `medium` and `high` (Harness defaults: `1024`, `2048`, `8192`, `16384`), and a
budget is **clamped to the room the request leaves for an answer** — a 32000-token budget on a
request whose output cap is 8000 becomes 8000.

A budget reaches the wire only if the route says which field carries it: pick **Budget field name**
(`thinking_token_budget`, `thinking_budget`, `thinking_budget_tokens`) or the alias switch
in the Compatibility card, because no adapter can guess it. Servers that express the budget inside
their chat template instead are served by the `chat-template` dialects.

### The route default

**Reasoning → Thinking level** sets the level this route uses when a request does not name one. It is
a route-wide default, and Harness validates it against the model that actually receives the request:
a level a model pins as unsupported is refused with `UNSUPPORTED_REASONING_EFFORT` rather than
downgraded. On a route that mixes thinking and non-thinking models, leave it on *Inherit* and let the
per-model maps decide (see [behaviour 4](#4-a-route-level-thinking-level-must-be-one-every-model-on-it-can-take)).

### The per-model map

**Per model → Model level mapping** is one box per level, and the box is the exact string that level
sends. A level left blank is *pinned unsupported* for that model, so choosing it is refused by name
instead of being silently dropped. The consequences are worth stating precisely:

| What you leave in the map | What it means |
|---|---|
| `low: low`, `high: high` | Those levels exist for this model and send exactly those strings. |
| a level left blank | Pinned unsupported: the level is hidden from the model's effort list and a request naming it fails with a named error. |
| `off` left empty (the *Offered, sends nothing* switch on) | `off` stays selectable instead of being pinned unsupported. The dialect then expresses "do not think" its own way. |
| `off` given a string | `off` is offered *and* sends that string as the thinking parameter. |
| `reasoningEfforts: false` (*No reasoning*) | The model is declared non-reasoning: Harness reports no reasoning capability at all, and asks for nothing. Model level only — the schema has no provider-level equivalent. |

The map is not free-form: Harness refuses a map that is empty, that offers no level beyond `off`,
that maps anything but `off` to nothing, or that contains an empty string. The editor's grid cannot
produce those shapes, and the draft check names one if a hand-edited YAML has it.

### What the dialect does with it

The chosen level goes through your `compat` switches, which is where "third-party DeepSeek" is won or
lost. With `thinkingFormat: deepseek` and `supportsReasoningEffort: true`, a request asking for
`high` carries `thinking: {type: "enabled"}` together with `reasoning_effort: "high"`; a request
asking for nothing carries `thinking: {type: "disabled"}`, the dialect's way of saying so. With the
default `openai` format the same level becomes a bare `reasoning_effort`, and "no thinking" is the
absence of any reasoning field — which is why a DeepSeek-compatible endpoint that requires an
explicit disabled marker must be told which dialect it speaks.

## Worked examples

### Example 1 — a third-party DeepSeek endpoint

**The situation.** An OpenAI-compatible endpoint serves DeepSeek models: `deepseek-reasoner` thinks,
`deepseek-chat` does not. Its host is a cloud gateway or a corporate proxy — nothing like
`api.deepseek.com` — so Harness cannot recognise what is behind it.

**Why it needs configuring.** Compatibility is detected from the provider id and the base URL. An
unrecognised URL is treated as *OpenAI itself*, which is wrong in five specific ways here:

| Assumed for an unrecognised URL | What a DeepSeek-compatible endpoint expects |
|---|---|
| `thinkingFormat: openai` — a bare `reasoning_effort` | `thinkingFormat: deepseek` — an explicit `thinking` marker plus `reasoning_effort` |
| `maxTokensField: max_completion_tokens` | `max_tokens`, the spelling DeepSeek's own API and most mirrors use |
| `supportsStore: true` — sends `store` | DeepSeek's own API does not take `store` — Harness already treats it as non-standard — and most mirrors follow |
| `supportsDeveloperRole: true` — sends instructions as `developer` | DeepSeek-style servers expect instructions as `system` |
| `requiresReasoningContentOnAssistantMessages: false` | servers that replay DeepSeek turns expect an empty `reasoning_content` alongside them |

**Step 1 — declare the route on the Models page.** Identity, endpoint, credential and the model list
belong to DSH's own page; the plugin deliberately does not edit them.

```yaml
# Settings → Models
displayName: Third-party DeepSeek
apiKeyEnv: THIRDPARTY_DEEPSEEK_API_KEY   # the name of a credential, never the key
api: openai-completions
baseURL: https://llm-gateway.example.com/v1
models:
  - id: deepseek-reasoner
    name: DeepSeek R1
    contextWindow: 131072
    maxTokens: 65536
  - id: deepseek-chat
    name: DeepSeek V3
```

Because this route declares a `models` list, that list **replaces** the installed catalog and the
per-model channel is those entries themselves — the *Per model* card edits them in place, addressed by
position.

**Step 2 — Compatibility, at route level.** The mismatches above, as six switches:

- *Reasoning wire shape* → **DeepSeek**
- *Understands `reasoning_effort`* → **Supported**
- *Output cap field* → **`max_tokens`, legacy**
- *Sends `store`* → **Not supported**
- *Uses the `developer` role* → **Not supported**
- *Replay empty reasoning* → **Supported**

**Step 3 — Reasoning, at route level.** Leave *Thinking level* on **Inherit** here: the two models do
not share a ladder, and a route default a model cannot take is refused at request time. Set the
budgets instead — they are route-wide and safe:

- *Low* `2048`, *Medium* `8192`, *High* `32768`

**Step 4 — Per model.** Select `deepseek-reasoner` and fill the mapping grid:

| Level | Box | Meaning |
|---|---|---|
| Off | *Offered, sends nothing* switch on | `off` stays selectable; the dialect expresses it as `thinking: {type: "disabled"}` |
| Low | `low` | sends `reasoning_effort: low` |
| Medium | `medium` | sends `reasoning_effort: medium` |
| High | `high` | sends `reasoning_effort: high` |
| Extra high / Maximum | left blank | pinned unsupported, because Harness would fold them onto `high` anyway |

Then select `deepseek-chat` and press **No reasoning** — the model declares `reasoningEfforts: false`,
so Harness offers no reasoning control for it and sends nothing.

**What the plugin writes.** Only the paths you touched; everything else in the file stays as it was.

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      thirdparty-deepseek:
        # ---- declared on the Models page (DSH owns these) ----------------
        displayName: Third-party DeepSeek
        apiKeyEnv: THIRDPARTY_DEEPSEEK_API_KEY
        api: openai-completions
        baseURL: https://llm-gateway.example.com/v1
        models:
          - id: deepseek-reasoner
            name: DeepSeek R1
            contextWindow: 131072
            maxTokens: 65536
            # ---- Per model → Model level mapping -------------------------
            reasoningEfforts:
              off: null          # offered; the dialect decides how to say "no thinking"
              low: low
              medium: medium
              high: high
          - id: deepseek-chat
            name: DeepSeek V3
            reasoningEfforts: false   # Per model → "No reasoning"
        # ---- Compatibility card, route level -----------------------------
        compat:
          thinkingFormat: deepseek
          supportsReasoningEffort: true
          maxTokensField: max_tokens
          supportsStore: false
          supportsDeveloperRole: false
          requiresReasoningContentOnAssistantMessages: true
          # only when your endpoint documents one of these fields:
          thinkingTokenBudgetField: thinking_budget_tokens
        # ---- Reasoning card ---------------------------------------------
        thinkingBudgets:
          low: 2048
          medium: 8192
          high: 32768
```

**What leaves the machine.** For `deepseek-reasoner`, once the compat block above is in place:

| The request asks for | The request body carries |
|---|---|
| `high` | `"thinking": {"type": "enabled"}, "reasoning_effort": "high", "max_tokens": 65536` |
| `medium` | the same shape with `"reasoning_effort": "medium"` and whichever budget you set |
| nothing (`off`) | `"thinking": {"type": "disabled"}` — no `reasoning_effort` |
| `xhigh` / `max` | refused before the request is built, because the map pins them unsupported |
| anything, for `deepseek-chat` | no reasoning field at all; the model is declared non-reasoning |

### Example 2 — the same models on a catalog route

If your gateway fronts model ids that the installed catalog already describes, the route declares no
`models` list, Harness serves the catalog, and the per-model channel becomes `modelOverrides.<id>`.
The editor is the same; the channel is different, and so is the reason it matters:

```yaml
        # no `models` list on this route → the catalog is served
        modelOverrides:
          deepseek-reasoner:
            contextWindow: 65536      # nothing else edits this channel…
            maxTokens: 32768          # …so identity and capacity live here too
            reasoningEfforts:         # Per model → Model level mapping
              off: null
              low: low
              high: high
        reasoning: high               # Reasoning card: safe here, every model reasons
```

Two rules come with this channel. Harness refuses an override whose id the catalog does not describe —
use a `models` list for ids only your gateway knows. And a non-empty `models` list refuses
`modelOverrides` outright, so declaring models to "unlock" per-model settings would trade the whole
catalog away for a seat; the card edits whichever channel the route actually has.

### Example 3 — a gateway that whitelists clients

A gateway that only talks to approved clients, or that is simply flaky, is the other half of this
plugin. The two lists are separate and both matter:

```yaml
# this plugin's own namespace — the global layer, on every request
- id: advanced-provider-settings
  config:
    globalHeaders:
      user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) … Chrome/131.0.0.0 Safari/537.36
      x-client-version: 2.14.0
```

and, on the route itself:

```yaml
# llm-pi-ai → providers.<id>
        headers:
          x-portal-token: …            # provider level; overrides a global of the same name
        retryPolicy:
          mode: normal
          maxRetries: 4
          retryableCodes: [RATE_LIMIT, SERVER, TIMEOUT, TRANSPORT, EMPTY_RESPONSE]
          backoff:
            initialDelayMs: 500
            maxDelayMs: 8000
            jitterRatio: 0.2
        timeoutMs: 120000
        streamIdleTimeoutMs: 60000
```

- **User-Agent goes in the global list, and only there.** Harness strips any header named
  `user-agent` from a provider profile and sends its own attribution value instead; the global layer is
  applied by this plugin's transport wrapper *after* Harness has built its header set, which makes it
  the only place the field can take effect. The card warns if you set it at provider level.
- **A configured `authorization` header displaces the stored API key** on OpenAI-compatible
  protocols. That is occasionally the point and frequently the bug; the card warns next to the row.
- **Retry is route-wide, never per model.** The backoff curve draws what the numbers mean — one bar
  per attempt, sized by the real delay — and *Always* is warned about rather than hidden.
- **Test Provider** asks the endpoint for its model list using the headers **currently in the form**,
  saved or not. It is the fastest way to prove a whitelist header works before saving anything.

## Behaviours that surprise people

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

### 3. Retry is never per-model, and "the finest level" depends on the route

`retryPolicy`, headers, transport and timeouts, image byte budgets and cache retention live on the
provider route; there is no per-model retry, and there is no global retry. This plugin shows that
boundary instead of hiding it: every provider-level card says in its own description that the value
applies to all models on the route, and the model editor's footer names the fields Harness would
reject on a model entry.

Which per-model channel exists depends on the route, and the difference is not cosmetic. A route
with a non-empty `models` list **replaces** the catalog, so its entries *are* the models and accept
`input`, `reasoningEfforts` and `compat`. A route with no `models` list serves the installed catalog
and is configured through `modelOverrides.<id>` — keyed by a model id the catalog must describe — and
that channel accepts six fields: those three plus `name`, `contextWindow` and `maxTokens`. The two
are mutually exclusive in the schema: a non-empty `models` list refuses `modelOverrides` outright.
So the card edits whichever channel the route actually has, and never suggests declaring models as a
way to "unlock" per-model settings — that would trade your catalog away for a seat.

### 4. A route-level thinking level must be one every model on it can take

The Reasoning card's level is a route-wide default. Harness validates the level a request ends up
naming against the model that receives it, and refuses an unsupported one with a named
`UNSUPPORTED_REASONING_EFFORT` error rather than quietly downgrading it. A `reasoningEfforts: false`
model on the same route supports only `off`, so a route default of `high` breaks that model's
requests. On a mixed route, leave the route level on *Inherit* and let each model's mapping decide
what it can do.

### 5. A thinking dialect belongs to one protocol

`thinkingFormat`, `supportsReasoningEffort` and `thinkingTokenBudgetField` are Chat Completions
fields. On a route whose `api` is `openai-responses` or `anthropic-messages`, the Compatibility card
offers only what that protocol reads — so a third-party DeepSeek endpoint you reach over the
Responses API cannot be taught the `deepseek` dialect, and its reasoning behaviour is whatever that
protocol does. Pick `openai-completions` when the endpoint speaks it and the level has to land
exactly.

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
               version, and written against 0.1.5-rc.2. What 0.3.0 and 0.4.0 changed there is in
               their changelog entries; treat those reports as history, not as the current API.
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
- **Thinking-token budgets are not validated by the Harness schema.** `thinkingBudgets` accepts any
  number upstream; this plugin's boxes insist on a whole, non-negative value and reject an unknown
  level, but a value written by hand or by another tool is only clamped at request time.
- **The mapping string you type is checked for shape, not for correctness.** Harness refuses the
  malformed shapes, and a level a model pins unsupported fails at request time with a named error
  (see [behaviour 4](#4-a-route-level-thinking-level-must-be-one-every-model-on-it-can-take)) — but
  whether *your endpoint* accepts the string you typed is not something any editor can know. The
  Effective-configuration preview shows what will be sent; the endpoint's own documentation is the
  authority on what it accepts.
- **Enum *values* that are wire syntax keep their literal spelling.** A thinking format is shown
  as `deepseek` or `chat_template_kwargs` because that string is what the endpoint receives and
  what provider documentation names; translating it would break the correspondence. The field
  *names*, the groups they sit in, the option descriptions and every level are localized.
- **A catalog route's per-model editor needs the host to list the catalog.** The picker's model ids
  come from the route's live catalog over the `catalog-models` RPC op. If the host's `llm` service
  cannot list a route's models — an older host, or a route not registered with an adapter — the card
  says which of the two it is and stays empty, because an override is keyed by an id nothing else can
  supply. Configuring that route means declaring its models on the Models page.
- **A `modelOverrides` id the catalog no longer describes cannot be saved.** Harness validates the id
  against the catalog and refuses the write; the card still shows the stored entry, with a warning and
  a *Clear* button, so it is never invisible.
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
