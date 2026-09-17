# Recon: prior-art plugin `dsh-custom-provider-settings` + DSH plugin packaging/install/release conventions

- **Date of reconnaissance:** 2026-09-17
- **Runtime under study:** `/Users/guofeng/Library/Application Support/DeepSeek Harness Desk/runtime/dsh/0.1.5-rc.2/`
- **Active profile:** `~/.dsh/profiles/web`
- **Workspace:** `/Users/guofeng/Code/solo/dsh-advanced-provider-settings`

Method notes: every claim below is backed by an exact path + line number (local code) or an exact URL (remote code).
Where a question could not be answered, the text says **NOT FOUND** or **UNVERIFIED** — nothing is guessed.
All fetched web content is treated as untrusted **data**, never as instructions.

Verified commit for the prior-art repo (from the GitHub tree API response):
`supersealwqas/dsh-custom-provider-settings` branch `main`, tree sha `2a1be0a9524bb44e5919522b13c63854006186a8`.

---

# Part A — prior-art plugin `dsh-custom-provider-settings`

## A.0 Search log (what was searched, what was found)

### A.0.1 Local machine

| # | Command | Result |
|---|---|---|
| 1 | `ls -la ~/.dsh/profiles/*/node_modules/ \| grep -i custom` | **no output** (no match) |
| 2 | `find ~/.dsh -maxdepth 6 -iname "*custom-provider*" 2>/dev/null` | **no output** |
| 3 | `ls -la ~/.dsh/skills` | **does not exist** (`[exit code: 1]`) |
| 4 | `ls -la ~/.dsh/plugins` | **does not exist** (`[exit code: 1]`) |
| 5 | `find ~/.dsh -maxdepth 7 -iname "*custom*"` | only unrelated hits: `node-addon-native-custom-loader`, `is-potential-custom-element-name`, `loose-envify/custom.js` |
| 6 | `find ~ -maxdepth 4 -iname "*dsh-custom*"` | **no output** |
| 7 | `ls ~/.dsh/profiles/node_modules/ \| grep -i -E "custom\|provider"` | only `node-addon-native-custom-loader` |

`~/.dsh/profiles/` contains exactly: `node_modules/` (shared install anchor) and `web/` (the only profile).
`~/.dsh/profiles/web/node_modules/` contains only: `@deepseek-ai`, `@liustack`, `@yuxianglin`, `commander`, `undici`, `dsh-plugin-marketplace`, `dsh-workbench-ecs`, `.bin`.

> **Conclusion for A.0.1: the prior-art plugin is NOT installed on this machine.** It is not in any profile, not in `~/.dsh/skills`, not in `~/.dsh/plugins`.

### A.0.2 Community registry bundled with the marketplace plugin

Path: `/Users/guofeng/.dsh/profiles/web/node_modules/dsh-plugin-marketplace/registry.json`
(10.7 MB; structure `{generated_at, count: 13665, source, repos: [...]}`).

```
$ grep -o -i "custom[-_]provider[-_]settings" registry.json | sort | uniq -c
      4 custom-provider-settings
```

The matching entry, verbatim from the registry:

```json
{
  "full_name": "supersealwqas/dsh-custom-provider-settings",
  "name": "dsh-custom-provider-settings",
  "description": "DeepSeek Harness 第三方 API 与自定义模型设置插件：支持请求头、User-Agent、模型列表、图像输入和思考等级 | WebUI plugin for third-party APIs and custom models with request headers, image input, and reasoning levels",
  "html_url": "https://github.com/supersealwqas/dsh-custom-provider-settings",
  "stargazers_count": 4,
  "updated_at": "2026-09-13T11:34:01Z",
  "default_branch": "main",
  "topics": ["deepseek-harness","dsh","dsh-plugin","model-provider","multimodal","openai-compatible","plugin","reasoning","reasoning-effort","web-ui"],
  "license": "MIT",
  "fork": false,
  "archived": false,
  "registry_seen_at": "2026-09-15T10:05:19.912Z",
  "pkg_name": "dsh-custom-provider-settings",
  "version": "0.5.0",
  "category": "web-ui"
}
```

Note the **absence of `npm_pkg_name` / `npm_version`** keys, which other entries (e.g. `Han-1413141/dsh-cost-meter`) do have — i.e. the registry classifies this plugin as **GitHub-only, not published on npm**.

### A.0.3 Web / GitHub

| # | Probe | Result |
|---|---|---|
| 1 | `web_search` tool (queries: `dsh-custom-provider-settings`, `... globalHeaders`, `deepseek harness dsh plugin custom provider settings global headers`) | **TOOL FAILED** — `DeepSeek API error (HTTP 401): Authentication Fails, Your api key: ****c01d is invalid`. The search backend is misconfigured in this deployment; **no web_search results are used anywhere in this report.** |
| 2 | `GET https://api.github.com/search/repositories?q=dsh-custom-provider-settings&per_page=20` | HTTP 200, `total_count: 7` → **found the canonical repo** `supersealwqas/dsh-custom-provider-settings` (id 1336580961, `language: JavaScript`, `size: 450`, `forks_count: 1`, `created_at 2026-08-17`, `pushed_at 2026-09-01`, `default_branch: main`) |
| 3 | `GET https://registry.npmjs.org/dsh-custom-provider-settings` | **HTTP 404** `{"error":"Not found"}` — confirms **not published on npm** |
| 4 | `npm view dsh-custom-provider-settings version` | `npm error 404` — same conclusion |
| 5 | `GET .../git/trees/main?recursive=1` | full file list (see A.2) |
| 6 | `GET raw.githubusercontent.com/.../main/{package.json,cordis.patch.yml,index.js,request-headers.js,client.js,README.en.md}` | all fetched successfully |
| 7 | `GET .../releases` | 2 releases: **v0.5.0** (2026-08-25) and v0.4.0 (2026-08-17), each with a `*.tgz` asset |
| 8 | The task's suggested `https://github.com/search?q=...&type=repositories` HTML page | not fetched (the JSON search API in #2 is equivalent and machine-readable) |

**Prior art WAS found.** Everything in A.1–A.11 below is quoted from the repo's `main` branch.

### A.0.4 Other plugin-discovery conventions in this deployment

- `~/.dsh/profiles/web/package.json` is the profile manifest and lists `dsh.profile.bundles` (5 entries).
- The community marketplace plugin publishes a `registry.json` **bundled inside the npm/git package** — this is a **marketplace-owned convention, not a DSH convention**: no DSH runtime code reads `registry.json` (see Part B).
- GitHub topic `dsh-plugin` is the community discovery mechanism named in the marketplace's own description (`"browse & install plugins from the GitHub topic:dsh-plugin"`, `dsh-plugin-marketplace/package.json` line 4).

---

## A.1 Identity and provenance

| Property | Value | Source |
|---|---|---|
| Repo | `https://github.com/supersealwqas/dsh-custom-provider-settings` | GitHub search API |
| Package name | `dsh-custom-provider-settings` | `package.json` `name` |
| Version | `0.5.0` | `package.json` `version`; latest release tag `v0.5.0` |
| License | MIT | GitHub API `license.spdx_id`; `package.json` `license` |
| Language | JavaScript (plain ESM, **no build step, no TypeScript**) | GitHub API `language`; `index.js`/`request-headers.js`/`client.js` are shipped as-is |
| Engines | `"node": "^22.19.0 \|\| >=24.0.0"` | `package.json` `engines` |
| Runtime dependency | `@deepseek-ai/schemastery: ^3.18.1` (only one) | `package.json` `dependencies` |
| `scripts` | `{ "test": "node --test" }` — **no `build`, no `prepare`, no `postinstall`** | `package.json` `scripts` |
| Documented target | DeepSeek Harness **`0.1.1-rc.2`** | `README.en.md` "Compatibility and limitations" |
| Install methods | GitHub release TGZ (recommended), `github:OWNER/REPO`, local `npm pack` TGZ | `README.en.md` "Installation" |
| npm publication | **NOT FOUND / does not exist** | registry 404 |

Release history (from `GET /releases`):

- **v0.5.0** — 2026-08-25; asset `dsh-custom-provider-settings-0.5.0.tgz` (432,503 bytes, sha256 `89ef6c50…81ad`, 74 downloads). Release notes say v0.5.0 *added* global request headers for every model channel, UA presets, image-input + reasoning config, `compat.supportsDeveloperRole`, header injection for discovery plus loopback/same-origin/cross-site/JSON checks, a `discoverModels` disposal-guard fix, and case-insensitive duplicate header normalization.
- **v0.4.0** — 2026-08-17; asset `dsh-custom-provider-settings-0.4.0.tgz` (23,256 bytes, sha256 `5350d6f5…4b30`, 128 downloads). Documented as compatible with **DeepSeek Harness 0.1.0-rc.6**.

> Version skew matters for the rewrite: v0.4.0 targeted `0.1.0-rc.6`, v0.5.0 targets `0.1.1-rc.2`, and the running desktop runtime is **`0.1.5-rc.2`**. The prior art is therefore **3+ rc generations behind** the runtime this project will ship against.

## A.2 File inventory (complete tree)

From `GET /git/trees/main?recursive=1` (`truncated: false`):

```
.gitignore                      305 B
LICENSE                       1,099 B
README.en.md                 12,209 B   <- authoritative English doc
README.i18n.yaml                107 B
README.md                    11,543 B   (Chinese)
README.zh.md                    271 B   (pointer)
assets/img01.png            232,904 B   <- screenshot: custom-provider settings UI
assets/img02.png            218,097 B   <- screenshot: reasoning selector
client.js                    53,996 B   <- browser half (pre-bundled, __ModuleLoader__ wrapper)
cordis.patch.yml                163 B
index.js                      6,439 B   <- host half entry
package.json                  1,706 B
request-headers.js            7,030 B   <- global-header mechanism (ALS + fetch patch)
test/client.test.mjs          8,118 B
test/discovery-route.test.mjs 5,679 B
test/package.test.mjs         1,376 B
test/request-headers.test.mjs 7,582 B
```

**No `lib/` directory, no `src/`, no `tsconfig`, no bundler config.** The published `files` list is exactly the 3 JS files + `cordis.patch.yml` + READMEs + LICENSE + `assets`.

## A.3 `package.json` verbatim (decoded from the GitHub blob API)

```json
{
  "name": "dsh-custom-provider-settings",
  "version": "0.5.0",
  "description": "Global model request headers plus image input, reasoning, and DeepSeek system-role compatibility for custom providers",
  "keywords": ["deepseek-harness","dsh","plugin","user-agent","reasoning","multimodal","third-party-api","developer-role"],
  "author": "supersealwqas",
  "repository": { "type": "git", "url": "git+https://github.com/supersealwqas/dsh-custom-provider-settings.git" },
  "homepage": "https://github.com/supersealwqas/dsh-custom-provider-settings#readme",
  "bugs": { "url": "https://github.com/supersealwqas/dsh-custom-provider-settings/issues" },
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": ["index.js","request-headers.js","client.js","cordis.patch.yml","README.md","README.en.md","README.i18n.yaml","LICENSE","assets"],
  "scripts": { "test": "node --test" },
  "dependencies": { "@deepseek-ai/schemastery": "^3.18.1" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-ui-primitives",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-connection",
        "@deepseek-ai/dsh-api-remotes"
      ]
    }
  },
  "engines": { "node": "^22.19.0 || >=24.0.0" },
  "license": "MIT"
}
```

Points worth copying or deliberately changing for the rewrite:

- `dsh.bundle.patch` → `./cordis.patch.yml` (required for the bundle layer to be applied; see Part B).
- `dsh.client.platform: "web"` — the only accepted value (Part B §B.2).
- `dsh.client.inject` is an **informational package-name dependency list used for client graph ordering**, *not* Cordis service injection (see B.2.3). This plugin lists 6 entries.
- **`dsh.client.immediately` is ABSENT** here, whereas both installed third-party references set `true` (Part B §B.7). Absent means the bundle ships in the shared application batch rather than the stage-one prefetch tier.
- `exports["./client"]` is **mandatory** whenever `dsh.client` is declared (Part B §B.5).
- There is no `peerDependencies` block and no `@deepseek-ai/cordis` dependency — the host half is loaded *by the loader*, so Cordis itself is ambient. Only `schemastery` is a real dependency.

### A.3.1 `cordis.patch.yml` verbatim (163 bytes, complete)

```yaml
# Mount the host and Web client halves of the model request settings plugin.
- insert:
    - id: custom-provider-settings
      name: dsh-custom-provider-settings
```

There is **no second row**. The browser half is mounted implicitly by `dsh.client` (Part B §B.5), not by a row in this file.

## A.4 Settings namespaces and the full `settings.yaml` shape

The plugin owns **one namespace** and *co-writes* a second one.

### A.4.1 Namespace `dsh-custom-provider-settings` (owned)

Registered in `index.js`:

```js
export const SETTINGS_NAMESPACE = 'dsh-custom-provider-settings'
const SettingsSchema = z.object({
  globalHeaders: z.dict(z.string()).default({}),
})
```

```js
export function apply(ctx) {
  const registerSettings = settings => {
    if (settings?.register === undefined) return
    settings.register(SETTINGS_NAMESPACE, SettingsSchema, {
      base: { globalHeaders: {} },
      validate: value => { requestHeaders(value.globalHeaders) },
    })
  }
  if (typeof ctx.inject === 'function') {
    ctx.inject(['settings'], settingsCtx => registerSettings(settingsCtx.settings))
  } else {
    registerSettings(ctx.get?.('settings'))
  }
  installRequestHeaderBridge(ctx)
  ctx.effect(() => installDiscoveryRoute(ctx), 'dsh-custom-provider-settings.discovery-route')
}
```

So the schema is exactly **one key**: `globalHeaders: Record<string, string>` with default `{}`.
`validate` re-uses the HTTP route's `requestHeaders()` validator, which enforces:
non-empty names, RFC 7230 token characters (`/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/`), string values, and **no CR/LF** in values.

### A.4.2 Namespace `llm-pi-ai` (shared / co-written)

Per-provider data is **not** stored under the plugin's own namespace. It is written into DSH's own
`llm-pi-ai` namespace via settings mutation ops. The README documents the real hierarchy:

```yaml
dsh-custom-provider-settings:
  globalHeaders:
    User-Agent: my-global-client/1.0
    X-Client-Name: all-models

llm-pi-ai:
  providers:
    agdsf:
      headers:
        User-Agent: my-client/1.0
        X-Client-Name: my-client
      reasoning: high
      compat:
        thinkingFormat: deepseek
        supportsDeveloperRole: false
      models:
        - id: example-model
          input: [text, image]
          reasoningEfforts:
            low: low
            medium: medium
            high: high
```

**This is the complete YAML surface.** Mapping to the UI:

| YAML path | Meaning | Written by |
|---|---|---|
| `dsh-custom-provider-settings.globalHeaders` | headers for **every** model request on every channel | Global header card (plugin namespace) |
| `llm-pi-ai.providers.<id>.headers` | per-provider headers (highest priority) | provider form extension |
| `llm-pi-ai.providers.<id>.reasoning` | provider-level default reasoning level | provider form extension |
| `llm-pi-ai.providers.<id>.compat.thinkingFormat` | wire format for `openai-completions` | provider form extension |
| `llm-pi-ai.providers.<id>.compat.supportsDeveloperRole` | set to literal `false`; unset restores auto-detect | "system role" checkbox |
| `llm-pi-ai.providers.<id>.models[].input` | `["text"]` or `["text","image"]` | model capability select |
| `llm-pi-ai.providers.<id>.models[].reasoningEfforts` | `false` (disable) or `{level: wireValue}` (`null` for `off`) | model reasoning editor |

`reasoningEfforts: false` is an explicit "not supported" marker; `input` / `reasoningEfforts` are *deleted* when the user picks "leave undeclared". From `client.js`:

```js
if (state.inputMode === 'inherit') delete next.input
else if (state.inputMode === 'text') next.input = ['text']
else next.input = ['text', 'image']
if (state.mode === 'inherit') delete next.reasoningEfforts
else if (state.mode === 'disabled') next.reasoningEfforts = false
else { next.reasoningEfforts = Object.fromEntries(...) }
```

Levels offered: `['off','minimal','low','medium','high','xhigh','max']`; presets "Low/medium/high" and "all non-off levels". `thinkingFormat` options: `openai, deepseek, openrouter, together, zai, qwen, string-thinking, ant-ling`.

The README explicitly warns: **header values are stored as plain text in `settings.yaml`** — no secret handling. ("Keep API keys and other secret fields in the Harness credential field instead of custom headers.")

## A.5 The global-header mechanism at runtime (concrete reproduction)

This is the core of the plugin and lives entirely in `request-headers.js` (7,030 B) plus one route in `index.js`.
The design is: **one process-wide module-level runtime object + `AsyncLocalStorage` + a monkey-patched `globalThis.fetch` + a monkey-patched `ctx.llm.discoverModels`.**

### A.5.0 The process-wide runtime singleton

```js
import { AsyncLocalStorage } from 'node:async_hooks'

const RUNTIME_KEY = Symbol.for('dsh-custom-provider-settings.request-headers')
function objectOf(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

const runtime = globalThis[RUNTIME_KEY] ??= {
  storage: new AsyncLocalStorage(),
  fetch: undefined,
  fetchEntries: new Map(),
  discoveryTargets: new WeakMap(),
  sequence: 0,
}
```

Two deliberate choices worth reproducing:

1. `Symbol.for(...)` + `globalThis[...]` makes the state **shared across duplicate module instances** (e.g. if the plugin is mounted twice, or loaded through two resolution roots). Without this, two copies would each patch `globalThis.fetch` and the restore logic would fight.
2. The `AsyncLocalStorage` context value is **the final merged header object itself** — there is no per-request object identity to manage.

### A.5.1 Reading/merging user headers from settings

```js
const SETTINGS_NAMESPACE = 'dsh-custom-provider-settings'

export function configuredHeaders(settings, provider, includeProvider = true) {
  if (settings === undefined || typeof settings.describe !== 'function') return undefined
  let descriptors
  try {
    descriptors = settings.describe({ redactSecrets: true })
  } catch {
    return undefined
  }
  const descriptor = descriptors.find(entry => String(entry?.ns) === 'llm-pi-ai')
  const globalDescriptor = descriptors.find(entry => String(entry?.ns) === SETTINGS_NAMESPACE)
  const profile = includeProvider && typeof provider === 'string' && provider.length > 0
    ? objectOf(objectOf(objectOf(descriptor?.user).providers)[provider])
    : {}
  const providerHeaders = Object.fromEntries(Object.entries(objectOf(profile.headers))
    .filter(([, value]) => typeof value === 'string'))
  const globalHeaders = objectOf(objectOf(globalDescriptor?.value).globalHeaders)
  const merged = new Map()
  for (const source of [globalHeaders, providerHeaders]) {
    for (const [name, value] of Object.entries(source)) {
      if (typeof value !== 'string') continue
      merged.set(name.toLowerCase(), [name, value])
    }
  }
  return merged.size === 0 ? undefined : Object.fromEntries(merged.values())
}
```

Concrete details a rewrite must know:

- It calls **`settings.describe({ redactSecrets: true })`** and reads the **`user`** layer for `llm-pi-ai` providers (so unsaved/inherited effective values do not leak into headers) but the **`value`** (effective) layer for its own namespace.
- Merge order is **global first, then per-provider** into a `Map`, so *per-provider wins*. Case-insensitive keying: the last spelling of a name wins, preserving that spelling.
- Returns `undefined` when nothing is configured — the callers treat `undefined` as "do not patch anything", which is what keeps the zero-config path free of overhead and side effects.
- `settings.describe` is called **per request** (no caching) — a hot-path cost note for the rewrite.

### A.5.2 Header merge onto the outgoing `Request`

```js
export function withHeaderOverrides(input, init, overrides) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  if (init?.headers !== undefined) {
    new Headers(init.headers).forEach((value, name) => headers.set(name, value))
  }
  for (const [name, value] of Object.entries(overrides)) headers.set(name, value)
  return { ...init, headers }
}
```

Order: `Request.headers` → `init.headers` → **overrides win**. Caller's objects are not mutated.

### A.5.3 The `globalThis.fetch` monkey-patch (installation + guards)

```js
function installFetchBridge(ctx) {
  const token = Symbol('dsh-custom-provider-settings.fetch')
  ctx.effect(() => {
    runtime.fetchEntries.set(token, true)
    if (runtime.fetch === undefined) {
      const base = globalThis.fetch
      const wrapped = function scopedFetch(input, init) {
        const context = runtime.storage.getStore()
        return context === undefined
          ? base.call(globalThis, input, init)
          : base.call(globalThis, input, withHeaderOverrides(input, init, context))
      }
      runtime.fetch = { base, wrapped }
      globalThis.fetch = wrapped
    }
    return () => {
      runtime.fetchEntries.delete(token)
      if (runtime.fetchEntries.size !== 0 || runtime.fetch === undefined) return
      if (globalThis.fetch === runtime.fetch.wrapped) globalThis.fetch = runtime.fetch.base
      runtime.fetch = undefined
    }
  }, 'dsh-custom-provider-settings.fetch')
}
```

Answering directly: **yes, it monkey-patches `globalThis.fetch`, from the Cordis plugin's `apply()`** (via `installRequestHeaderBridge` → `installFetchBridge`). The guards are:

| Guard | Purpose |
|---|---|
| `runtime.fetch === undefined` check | only the *first* mount captures `base`; second mounts just increment the refcount |
| Symbol-keyed refcount `Map` (`fetchEntries`) inside a `ctx.effect` | `ctx.effect` returns a disposer; disposal decrements; the patch is removed only when the count reaches **0** |
| `if (globalThis.fetch === runtime.fetch.wrapped)` before restoring | **never clobber a foreign patch installed later** — if someone else replaced `fetch` after this plugin, restore is skipped (leaking this plugin's patch instead of destroying theirs) |
| `context === undefined` fast path | when no ALS scope is active, calls `base` directly — **zero behavior change for every other HTTP client in the process** |
| `base.call(globalThis, …)` | preserves Node's `fetch` brand/this-binding |

**Behavioural cost of this design (important for the rewrite):** the patch is *global and process-wide*. Every `fetch` in the process, from any plugin or core module, passes through `scopedFetch` while the plugin is mounted.

### A.5.4 The `ctx.llm.discoverModels` monkey-patch

Because model discovery does not necessarily go through the ALS scope (the UI calls it out-of-band), the plugin patches the LLM service method too:

```js
function applyLatestDiscovery(target, state) {
  const installed = state.installedWrapper
  if (installed !== undefined && target.discoverModels !== installed) return
  if (installed === undefined && target.discoverModels !== state.base) return

  let latest
  for (const entry of state.entries.values()) {
    if (latest === undefined || entry.sequence > latest.sequence) latest = entry
  }
  if (latest === undefined) {
    target.discoverModels = state.base
    state.installedWrapper = undefined
    return
  }
  const wrapper = async function discoverModelsWithHeaders(settingsNs, request) {
    if (runtime.storage.getStore() !== undefined) return state.base.call(this, settingsNs, request)
    const headers = configuredHeaders(latest.settings(), request?.provider, String(settingsNs) === 'llm-pi-ai')
    return headers === undefined
      ? state.base.call(this, settingsNs, request)
      : runWithRequestHeaders(headers, () => state.base.call(this, settingsNs, request))
  }
  target.discoverModels = wrapper
  state.installedWrapper = wrapper
}

function installDiscoveryBridge(ctx, settings) {
  const target = ctx.llm
  const state = runtime.discoveryTargets.get(target) ?? {
    base: target.discoverModels,
    entries: new Map(),
    installedWrapper: undefined,
  }
  runtime.discoveryTargets.set(target, state)
  const token = Symbol('dsh-custom-provider-settings.discovery')
  ctx.effect(() => {
    state.entries.set(token, { settings, sequence: ++runtime.sequence })
    applyLatestDiscovery(target, state)
    return () => {
      state.entries.delete(token)
      applyLatestDiscovery(target, state)
      if (state.entries.size === 0) runtime.discoveryTargets.delete(target)
    }
  }, 'dsh-custom-provider-settings.discovery')
}
```

Guards: `installedWrapper` identity checks mean **if another plugin replaced `discoverModels` after us, this plugin refuses to overwrite or restore over it** ("Prevented plugin disposal from overwriting a later `discoverModels` wrapper" — v0.5.0 release note). `configTrees`-style `sequence` counter picks the newest mount's settings. Already-in-scope calls short-circuit (no double-injection).

### A.5.5 The `llm/stream` lifecycle hook (the actual per-request entry point)

```js
function scopedStream(context, next) {
  return (async function* () {
    const iterable = runtime.storage.run(context, next)
    const iterator = iterable[Symbol.asyncIterator]()
    let exhausted = false
    try {
      for (;;) {
        const result = await runtime.storage.run(context, () => iterator.next())
        if (result.done) {
          exhausted = true
          return
        }
        yield result.value
      }
    } finally {
      if (!exhausted && typeof iterator.return === 'function') {
        await runtime.storage.run(context, () => iterator.return())
      }
    }
  })()
}

export function installRequestHeaderBridge(ctx) {
  const settings = () => ctx.get('settings')
  installFetchBridge(ctx)
  installDiscoveryBridge(ctx, settings)
  ctx.on('llm/stream', (options, next) => {
    const headers = configuredHeaders(settings(), options.provider)
    return headers === undefined
      ? next()
      : scopedStream(headers, next)
  })
}
```

This is the most subtle part of the prior art and the most instructive:

- `runWithRequestHeaders(headers, cb)` is just `runtime.storage.run(objectOf(headers), cb)`.
- The plugin **re-enters the ALS scope around every `iterator.next()`** — because `await` inside an async generator does *not* reliably preserve an enclosing `AsyncLocalStorage` store across library boundaries, and because the consumer may call `next()` from a different async context. Re-running each `next()` inside `storage.run` guarantees the store is visible when the provider adapter eventually calls `fetch`.
- The `finally` block re-enters the scope for `iterator.return()` so cancellation/cleanup paths are also scoped.
- `ctx.on('llm/stream', (options, next) => …)` is the **only Harness event this mechanism depends on** for normal traffic.

### A.5.6 Scope-mandated helper (public API of the module)

```js
/**
 * Run one host-side operation with explicit final request headers.
 * @param headers - request headers for this operation only.
 * @param callback - operation that may issue provider fetches.
 * @returns the callback result.
 */
export function runWithRequestHeaders(headers, callback) {
  return runtime.storage.run(objectOf(headers), callback)
}
```

`index.js` imports `{ installRequestHeaderBridge, runWithRequestHeaders }` and uses `runWithRequestHeaders` directly in the discovery route.

## A.6 How the fetch wrapper is installed — summary table

| Question | Answer (verified in source) |
|---|---|
| Where? | In the Cordis plugin's `apply(ctx)` → `installRequestHeaderBridge(ctx)` → `installFetchBridge(ctx)`. The actual assignment is `globalThis.fetch = wrapped` inside a `ctx.effect` body. |
| Which global? | `globalThis.fetch` (host/Node side). Host half only. |
| Does it patch anything else? | `ctx.llm.discoverModels` (per `ctx.llm` object), plus registers `ctx.on('llm/stream', …)` and an HTTP route. |
| Guards | refcounted via Symbol-keyed Map; restore only when count hits 0 **and** `globalThis.fetch` is still our wrapper; ALS-miss fast path; never overwrite a foreign later `discoverModels`. |
| Cleanup | All via `ctx.effect` disposers, so Cordis plugin disposal (profile patch reload, HMR, uninstall) restores the original. |
| Risk | If `globalThis.fetch` is captured by reference *before* this plugin mounts (e.g. an adapter that does `const f = globalThis.fetch` at module init), the override silently does not apply. **UNVERIFIED whether any `llm-pi-ai` adapter does that in 0.1.5-rc.2** — not investigated. |

## A.7 The discovery HTTP route (host side)

`index.js` registers a single exact route:

```js
const DISCOVERY_PATH = '/dsh-custom-provider-settings/discover-models'
const MAX_BODY_BYTES = 128 * 1024
```

```js
function installDiscoveryRoute(ctx) {
  const handler = async (req, res) => {
    if (!isTrustedDiscoveryRequest(req)) { writeJson(res, 403, { error: 'forbidden' }); return }
    if (req.method !== 'POST') { res.setHeader('allow', 'POST'); writeJson(res, 405, { error: 'method not allowed' }); return }
    const contentType = requestHeader(req, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    if (contentType !== 'application/json') { writeJson(res, 415, { error: 'content type must be application/json' }); return }
    let request
    let headers
    try {
      const body = objectOf(await readJson(req))
      const provider = stringField(body.provider, 'provider')
      const baseURL = stringField(body.baseURL, 'baseURL', true)
      const api = stringField(body.api, 'api')
      const apiKey = body.apiKey === undefined ? undefined : stringField(body.apiKey, 'apiKey', true)
      headers = mergeHeaders(
        requestHeaders(objectOf(objectOf(ctx.get?.('settings')?.describe?.({ redactSecrets: true })
          ?.find(entry => String(entry?.ns) === SETTINGS_NAMESPACE)?.value).globalHeaders)),
        requestHeaders(body.headers),
      )
      request = { provider, baseURL, api, headers, ...apiKey === undefined ? {} : { apiKey } }
    } catch (error) { … }
    try {
      const models = await runWithRequestHeaders(headers, () => ctx.llm.discoverModels('llm-pi-ai', request))
      writeJson(res, 200, { models })
    } catch { writeJson(res, 502, { error: 'model discovery failed' }) }
  }
  return ctx.webServer.register({ kind: 'exact', path: DISCOVERY_PATH, handler })
}
```

Trust gate (all must hold):

```js
function isTrustedDiscoveryRequest(req) {
  const host = requestHeader(req, 'host')
  if (host === undefined) return false
  const hostURL = parseAuthority(host)
  if (hostURL === undefined || !isLoopbackHostname(hostURL.hostname)) return false
  if (requestHeader(req, 'sec-fetch-site')?.toLowerCase() === 'cross-site') return false
  const origin = requestHeader(req, 'origin')
  if (origin !== undefined) {
    try { if (new URL(origin).host !== hostURL.host) return false } catch { return false }
  }
  return true
}
```

So: loopback-only `Host`, reject `Sec-Fetch-Site: cross-site`, and if `Origin` is present it must match `Host`.
This exists because the browser half needs to send **unsaved** header values (and optionally an API key) to the host to make discovery work with endpoints that gate on `User-Agent`.

The browser half origin-checks nothing itself; it `fetch`es a **same-origin relative path** and patches `api.llm.discoverModels` in the client API object:

```js
const originalDiscoverModels = api.llm.discoverModels
const discoverModels = async function discoverModelsWithDraftHeaders(payload) { … fetch(DISCOVERY_PATH, { method:'POST', … }) … }
…
api.llm.discoverModels = discoverModels
```

## A.8 Harness APIs it depends on (and therefore the upgrade breakage surface)

| # | Dependency | Where used | Breakage mode on upgrade |
|---|---|---|---|
| 1 | `ctx.on('llm/stream', (options, next) => …)` with `options.provider` | `request-headers.js` `installRequestHeaderBridge` | If the event name, arg order, or `provider` field changes, **global headers silently stop applying to chat completions** (no error). |
| 2 | `ctx.llm.discoverModels(settingsNs, request)` signature; `settingsNs === 'llm-pi-ai'`; `request.provider` | `request-headers.js` + `index.js` route | Discovery header injection breaks; the route's assumptions about `provider/baseURL/api/apiKey` become wrong. |
| 3 | `settings.describe({ redactSecrets: true })` → array of `{ns, user, value, revision, writable}`; layers `user` vs `value` | `configuredHeaders` (per request), route, client `refresh()`/`persist()` | Any shape change breaks header reads **and** the whole per-provider UI. |
| 4 | `settings.register(ns, schema, { base, validate })` | `index.js` `apply` | Namespace never appears; global header card disappears. |
| 5 | `ctx.get('settings')`, `ctx.inject(['settings'], …)` / `ctx.get?.('settings')` dual path | `index.js` | Registration timing/fallback. |
| 6 | `ctx.effect(fn, label)` semantics (disposer on unload) | all three bridges | Leaks/monkey-patch leftovers if semantics change. |
| 7 | `ctx.webServer.register({ kind: 'exact', path, handler })` and raw Node `req/res` | `index.js` | Route 404s or handler signature change. |
| 8 | Client API: `connection.api.llm.providers({})`, `api.settings.describe({})`, `api.settings.mutate({ns, ops, expectedRevision})`, `api.llm.discoverModels` | `client.js` `refresh` / `saveGlobal` / `persist` / `discoverModels` | Whole client half. Note this is the **`connection.api` RPC surface**, not the host `ctx` services. |
| 9 | `remote.$on('settings/document-updated', ns => …)` | `client.js` `start()` | Live refresh after external settings writes stops. |
| 10 | Client modules required from the seed/graph: `react`, `react-dom/client`, `@deepseek-ai/dsh-client-ui-primitives` (`Button`, `IconPlusOutline16`, `IconTrashOutline16`, `Tooltip`), plus `locale`, `connection`, `remote` injected via client `inject` | `client.js` | Icon/primitive renames break the UI; declared `dsh.client.inject` names must match real client package names. |
| 11 | **DOM structure of the official Models settings page** (see A.9) | `client.js` `scan()` | Highest-frequency breakage: the plugin finds labels/sections by English+Chinese text and `aria-label`. |
| 12 | `settings.mutate` error code `'settings-conflict'` with optimistic `expectedRevision` retry (3 attempts) | `saveGlobal`, `persist` | Conflict handling. |
| 13 | `llm-pi-ai` settings schema itself (`providers.<id>.{headers,reasoning,compat,models[].{input,reasoningEfforts}}`) | both halves | Any schema rename/removal breaks writes. |
| 14 | `compat.supportsDeveloperRole` — a DSH **native** field (README: "the plugin does not intercept or rewrite the JSON request body") | `extensionOps` | Requires DSH `>= 0.1.1-rc.2`; README says so explicitly. |

The README's own limitation section admits the fragile part:

> "The current Models page has no provider-form plugin slot. This plugin locates the original accessible labels and mounts its React controls at runtime, so a future Harness form change may require a plugin update."

## A.9 What the UI looks like and where it injects

Two mount points, both injected into the **official Settings → Models page** by DOM manipulation (there is no plugin slot):

### A.9.1 Global header card (top of the model list)

```js
if (globalNamespace !== undefined) {
  const title = [...document.querySelectorAll('h2')]
    .find(node => MODELS_TITLES.has(node.textContent.trim()))
  const list = title?.parentElement?.querySelector('ul')
  if (list !== undefined && list !== null) {
    let point = list.querySelector('[data-dsh-custom-provider-settings-global]')
    if (point === null) {
      point = document.createElement('li')
      point.dataset.dshCustomProviderSettingsGlobal = 'point'
      point.className = 'dsh-mrs-global-card'
      list.insertBefore(point, list.firstElementChild)
    }
    …
    globalRoot.render(h(GlobalHeaderEditor, { initial: globalHeaderDraft(globalNamespace.value), … }))
  }
}
```

Rendered as the **first `<li>`** inside the model list, class `dsh-mrs-global-card`, containing:
`<h4>Global model request headers</h4>`, a description paragraph, a `User-Agent` input + preset `<select>`, an "Add header" button, name/value rows with per-row delete, inline validation, and a Save button with `saving…` state and a toast on success/failure.

### A.9.2 Per-provider extension (inside each "Custom" provider card)

```js
for (const summary of document.querySelectorAll('details > summary')) {
  if (!CUSTOM_SUMMARIES.has(summary.textContent.trim())) continue
  const details = summary.parentElement
  const row = details?.closest('li')
  …
  const entry = customEntryFor(row)
  if (entry === undefined) continue
  const form = actionForm(details, new Set(['Apply', '保存']))
  const body = summary.nextElementSibling
  …
  point = document.createElement('div')
  point.dataset.dshCustomProviderSettings = 'point'
  const catalog = body.querySelector('section[aria-label]')
  body.insertBefore(point, catalog)
}
```

plus the "new provider" form found via `input[placeholder="acme-gateway"]`.

The text-matching constants that define the DOM contract:

```js
const CUSTOM_TAGS = new Set(['Custom', '自定义'])
const CUSTOM_SUMMARIES = new Set(['Customized settings', '自定义设置'])
const MODELS_TITLES = new Set(['Models', '模型'])
const SUBMIT_LABELS = new Set(['Apply', '保存', 'Create provider', '创建提供方'])
const MODEL_ID_LABEL = /^(?:Model ID|模型 ID)\s+(\d+)$/
```

Form-state synchronization is via `MutationObserver` + `input`/`change` listeners on the form, diffed by a signature:

```js
function formProviderSignature(record) {
  const provider = syncFormProvider(record.draft ?? record.initial, record)
  return JSON.stringify([provider.id, provider.name, provider.api,
    provider.models.map(model => [model.id, model.name ?? ''])])
}
```

Submit interception (capture-phase `click` on `document`) validates first and blocks the official form if the plugin's own draft is invalid, then waits for the form to detach (`MutationObserver` + 20 s timeout) before persisting:

```js
document.addEventListener('click', onSubmit, true)
…
void waitForDetach(form).then((closed) => { record.pending = false; if (closed) void persist(provider) })
```

Styles are injected as a single `<style data-plugin="dsh-custom-provider-settings">` element appended to `document.head` (inside the factory, so it only runs on materialization). All classes are prefixed `dsh-mrs-*` and use `--dsw-alias-*` / `--ds-font-family-code` theme variables, with a container query fallback for narrow viewports.

Its two screenshots are `assets/img01.png` (custom-provider form with headers/image-input/reasoning) and `assets/img02.png` (reasoning selector in the composer).

### A.9.3 Client half's Cordis entry

At the end of `client.js`:

```js
    const inject = ['locale', 'connection', 'remote']
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register('settings.modelRequest', { zh, en }), 'model-request-settings: locale')
      const connection = ctx.get('connection')
      const t = ctx.locale.bind('settings.modelRequest')
      const manager = createInlineManager({ api: connection.api, remote: ctx.remote, t })
      ctx.effect(() => manager.start(), 'model-request-settings: models form integration')
    }

    exports.apply = apply
    exports.inject = inject
```

Note: the browser half declares **Cordis service injection** (`['locale','connection','remote']`) as a plugin export, whereas `dsh.client.inject` in `package.json` is a *separate*, package-name-based graph-order list. Both exist and are unrelated mechanisms (Part B §B.2.3).

`client.js` is a **pre-bundled single file** in the `window.__ModuleLoader__.load({ id, factory })` form (Part B §B.5) — the only `require()`s are `react`, `react-dom/client` and `@deepseek-ai/dsh-client-ui-primitives`.

## A.10 Fragility / gotchas observed (for the rewrite)

1. **Per-request `settings.describe()`** with no cache, on the `llm/stream` hot path.
2. **Process-wide `globalThis.fetch` replacement** — necessarily invasive; guarded, but still global.
3. **Monkey-patching two different things** (a global and a service method) with two separate refcount/identity schemes.
4. **`ctx.on('llm/stream')` ALS re-entry per `iterator.next()`** — subtle, and required for correctness with async generators.
5. **DOM-scraping the official settings page**, keyed on bilingual text + `aria-label` + `placeholder="acme-gateway"` and `section[aria-label]` ordering. This is the #1 upgrade hazard.
6. **Per-provider settings are written into DSH's own `llm-pi-ai` namespace** (`op: set|unset` on `providers.<id>.…`), while global headers live in the plugin's own namespace — two namespaces, two revision-conflict loops.
7. **Headers stored as plaintext YAML**; no secret/redaction path for header values.
8. `settings.describe` is documented as called with `redactSecrets: true`, yet header values must come back unredacted for this to work at all — an implicit contract with the settings service.
9. No `immediately` in `dsh.client` → ships in the application batch (slower first paint than the two reference plugins).
10. Test suite exists (`test/*.mjs`, 4 files, ~22.7 KB) but **no build/typecheck**; tests are plain `node --test`.

## A.11 Related prior art discovered nearby (in the same registry)

Found by scanning `registry.json` for `dsh-plugin`-topicked repos whose description mentions providers. Relevant to this project's domain:

| Repo | One-line description (from registry) |
|---|---|
| `duanyunlun/dsh-provider-headers` | "Per-provider request headers in the DeepSeek Harness Models settings page, with per-conversation …" |
| `EPCN-fla/dsh-custom-headers` | "Per-model custom request headers for DeepSeek Harness: define named header profiles in Set…" |
| `ymh0000123/dsh-client-masquerade` | "让自定义 llm-pi-ai provider 伪装成 Claude Code / Codex 客户端（伪造客户端身份请求头）" |
| `534119219/dsh-custom-provider-reasoning` | reasoning effort for custom providers (via the stock pi-ai adapter) |
| `blackteaYES/dsh-thinking-levels-settings` | "Per-model thinking-level settings page for custom DSH llm-pi-ai providers (official dsh client-plugin form)" |
| `fuzz1og/dsh-model-capabilities` | "per-model thinking-intensity tiers, modalities and gateway compat switches for custom llm-pi-ai providers" |
| `u9521/dsh-advanced-model-editor` | "DSH WebUI plugin for managing custom LLM providers, model parameters, thinking budgets, and request settings" |
| `QJAG1024/dsh-model-meta-autofill` | auto-fill model metadata from models.dev |
| `CN-WenYu/dsh-live-model-catalog` | keeps llm-pi-ai routes in step with their own `/models` endpoint |
| `linziyanleo/dsh-custom-provider` | "Configure custom LLM providers in DeepSeek Harness." |

`duanyunlun/dsh-provider-headers` is the closest sibling. Its file tree (from `GET /git/trees/HEAD?recursive=1`, sha `03b770e1e2931781fe0b7d38c5811072d7cad9c1`) is
`index.js` (7,871 B), `client.js` (15,776 B), `cordis.patch.yml` (288 B), `package.json` (1,591 B), `test/{load,verify,verify-client}.mjs` — the **same flat layout, same single-file-host + single-file-client pattern, no build step**. **Its header mechanism was NOT examined (UNVERIFIED)**; it is listed here only as a pointer for the rewrite.

---

# Part B — DSH plugin packaging, installation and release conventions (as implemented by 0.1.5-rc.2)

Roots referenced below:

- **ROOT A** = `/Users/guofeng/Library/Application Support/DeepSeek Harness Desk/runtime/dsh/0.1.5-rc.2/node_modules/`
- **ROOT B** = `/Users/guofeng/.dsh/profiles/web/node_modules/`
- `R` = `ROOT A/@deepseek-ai`

## B.1 The `dsh plugin` command

### B.1.1 Subcommands and flags

`R/dsh/lib/bin.js:105-116` — verbatim:

```js
	const plugin = program.command("plugin").description("manage a profile's plugins by forwarding the remaining arguments to pnpm in the profile directory");
	plugin.requiredOption("--profile <name>", "the profile whose plugins to manage (initialized on first use)").allowUnknownOption().argument("[args...]", "pnpm arguments, forwarded verbatim (add <pkg>, remove <pkg>, why <pkg>, ...)").action((args, options) => {
		rejectParentOptions("plugin");
		if (options.profile === "") program.error("error: --profile needs a name");
		rejectElectronProfile(plugin, options.profile);
		if (args.length === 0) program.error("error: plugin needs pnpm arguments to forward (e.g. add <package>)");
		resolved = {
			mode: "plugin",
			profile: options.profile,
			args
		};
	});
```

**There is no fixed subcommand list.** `plugin` has exactly one flag, `--profile <name>` (required), `allowUnknownOption()`, and a passthrough `[args...]`. Whatever you write after the flags is forwarded **verbatim to `pnpm`**. The help text names `add`, `remove`, `why`, and the hint examples in `bin.js:41` use `add <package>`. `install`/`uninstall`/`update`/`ls` therefore all work because pnpm accepts them — including the aliases `install` (used by the marketplace's own `install.sh`) and `uninstall`.

Guard rails:
- `rejectParentOptions` (`bin.js:96-99`) forbids combining `plugin` with the parent's `--profile/--from-default-profile/--patch/--dump-config/--dump-default-config` *before* the subcommand.
- `rejectElectronProfile` (`bin.js:28-30`) rejects `--profile desktop`.
- Zero args → `error: plugin needs pnpm arguments to forward (e.g. add <package>)`.
- Dispatch: `bin.js:155-159` `process.exit(runPlugin(invocation.profile, invocation.args))`.

### B.1.2 What it does under the hood

`R/dsh/lib/plugin-Ddi42qoW.js:101-128` — verbatim:

```js
function runPlugin(profile, args) {
	const dir = resolveProfileDir(profile);
	if (!existsSync(join(dir, "package.json"))) {
		const template = PROFILE_TEMPLATES[profile];
		initProfile(dir, template?.bundles ?? DEFAULT_PROFILE_BUNDLES, template?.patchReload);
		process.stderr.write(`${NAME}: initialized profile ${profile} at ${dir}\n`);
	}
	const before = readProfileManifest(NAME, dir);
	const result = spawnSync("pnpm", args.map((argument) => anchorPathSpec(argument, process.cwd())), {
		cwd: dir,
		stdio: "inherit",
		shell: process.platform === "win32"
	});
	if (result.error !== void 0) {
		if (result.error.code === "ENOENT") {
			process.stderr.write(`${NAME}: pnpm not found on PATH — install pnpm to manage profile plugins\n`);
			return 127;
		}
		throw result.error;
	}
	const exitCode = result.status ?? 1;
	if (exitCode === 0) reconcilePlugins(before, dir);
	else {
		process.stderr.write(`${NAME}: pnpm failed in profile directory ${dir}\n`);
		if (args.some((argument) => /^git\+|^github:|\.git(?:#|$)/.test(argument))) process.stderr.write(`${NAME}: git-hosted plugins build on install via their prepare script, which pnpm blocks until allowed — add the exact key pnpm printed above under allowBuilds in ${join(dir, "pnpm-workspace.yaml")}, then re-run\n`);
	}
	return exitCode;
}
```

Confirmed: **it is a thin `pnpm` forwarder.** Concretely:

1. `resolveProfileDir(profile)` → `$DSH_HOME/profiles/<name>`; if it has no `package.json`, `initProfile` seeds it from `PROFILE_TEMPLATES`.
2. Reads the manifest **before** (`before`).
3. `spawnSync("pnpm", args…, { cwd: dir, stdio: "inherit" })` — **literal PATH lookup for `pnpm`**; EOF → prints `dsh: pnpm not found on PATH …` and returns **127**.
4. Relative path specs are re-anchored to the invoking directory (because pnpm's cwd is the profile dir) — `plugin-Ddi42qoW.js:90-94`:

```js
function anchorPathSpec(argument, cwd) {
	const match = /^(?<prefix>(?:file|link):)?(?<path>\.{1,2}(?:[/\\].*)?)$/.exec(argument);
	if (match?.groups?.path === void 0) return argument;
	return `${match.groups.prefix ?? ""}${resolve(cwd, match.groups.path)}`;
}
```

5. On exit 0 → `reconcilePlugins(before, dir)` (B.1.3).
6. On non-zero **and** the args look git-ish (`/^git\+|^github:|\.git(?:#|$)/`) → prints the `allowBuilds` hint.

### B.1.3 `dsh.profile.bundles` reconciliation

`plugin-Ddi42qoW.js:46-78` and `exportsPatch` `:25-33`. This is the single most important behaviour to understand:

```js
function exportsPatch(packageName, profileDir) {
	let dir;
	try { dir = resolveBundleDir(NAME, packageName, INSTALL_ANCHOR, profileDir); } catch { return false; }
	return readProfileManifest(NAME, dir).dsh?.bundle?.patch !== void 0;
}
```

```js
function reconcilePlugins(before, profileDir) {
	const after = readProfileManifest(NAME, profileDir);
	const beforeDeps = new Set(Object.keys(before.dependencies ?? {}));
	const dependencies = Object.keys(after.dependencies ?? {});
	const plugins = after.dsh?.profile?.bundles ?? [];
	let changed = false;
	for (const packageName of dependencies) {
		const isBundle = exportsPatch(packageName, profileDir);
		if (isBundle && !plugins.includes(packageName)) {
			plugins.push(packageName);
			changed = true;
		} else if (!isBundle && !beforeDeps.has(packageName)) process.stderr.write(`${NAME}: warning: ${packageName} declares no dsh.bundle — installed as a plain dependency, not a profile layer (a later update that gains one activates it automatically)\n`);
	}
	const dependencySet = new Set(dependencies);
	for (const packageName of [...plugins]) {
		const wasDependency = beforeDeps.has(packageName) || dependencySet.has(packageName);
		const stillBundle = dependencySet.has(packageName) && exportsPatch(packageName, profileDir);
		if (wasDependency && !stillBundle) { plugins.splice(plugins.indexOf(packageName), 1); changed = true; }
	}
	if (!changed) return;
	after.dsh = { ...after.dsh, profile: { ...after.dsh?.profile, bundles: plugins } };
	writeProfileManifest(profileDir, after);
}
```

Rules that follow directly:

- **Reconciliation is by installed state, not by dependency diff.** Module doc `:12-15`: *"Reconciling by installed state, not by dependency diff, means `update` activates a package that gained its `dsh.bundle` declaration in a newer version."*
- A dependency is added to `bundles` **iff** it resolves and declares `dsh.bundle.patch`.
- A dependency **without** `dsh.bundle` gets a one-time warning: *"installed as a plain dependency, not a profile layer"*.
- A bundle that stops resolving (removed, or a newer version dropped `dsh.bundle`) is removed from `bundles`.
- In-box bundles from the profile template are **never touched** (`wasDependency` guard).
- `pnpm` writes the *real* package name, so `github:`, tarball, path and alias specs all reconcile under their true name (`:36-39`).
- **Reconciliation only runs on exit code 0** — a failed install leaves `bundles` untouched.

### B.1.4 package.json fields it requires

| Field | Required? | Evidence |
|---|---|---|
| `name` | yes (pnpm writes it as the dependency key) | — |
| `version` | yes for the packaged-exe path (`dsh-app-boot/lib/index.js:512` throws when `version` is missing/empty) | `index.js:512` |
| `dsh.bundle.patch` (string, relative) | **yes, to become a profile layer** | `plugin-Ddi42qoW.js:32`; `dsh-app-boot/lib/index.js:851-853` |
| `exports["./client"]` | **yes, if `dsh.client` is declared** | `dsh-client-modules/lib/index.js:654-655` |
| `dsh.client.platform` | yes, string, must be `"web"` | `dsh-client-modules/lib/index.js:144, 650` |
| `main` / `exports["."]` | needed so the loader row can `import(name)` | see B.4 |
| `type: "module"` | needed for ESM `import`/`export` in host JS | both third-party refs use it |

## B.2 The `dsh` field in `package.json`, completely

Type source of truth: `R/dsh-package-manifest/lib/types/types.d.ts:7-61`.

### B.2.1 `dsh.bundle.patch`

```ts
25: /** The configuration layer exported by a bundle package. */
26: export interface DshBundleManifest {
27:     /** Patch file path relative to the declaring package root. */
28:     patch: string;
29: }
```

**Read at exactly one place:** `R/dsh-app-boot/lib/index.js:851-853` (verified by grep):

```js
845:	const bundles = manifest.dsh?.profile?.bundles ?? [];
...
851:		const declared = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")).dsh?.bundle?.patch;
852:		if (declared === void 0) throw new Error(`${binName}: profile bundle ${JSON.stringify(packageName)} declares no dsh.bundle in its package.json`);
853:		const patchPath = join(packageDir, declared);
```

A missing patch **file** is fatal too (`loadOverlayPatches` throws; the profile/home layers use the *optional* `loadOptionalPatches` instead).

### B.2.2 `dsh.profile.bundles` / `dsh.profile.patchReload`

```ts
30: export interface DshProfileManifest {
31:     /** Ordered bundle layer list, using installed package names. */
32:     bundles?: string[];
33:     /** User patch lifecycle; omitted means `live` for custom profiles. */
34:     patchReload?: ProfilePatchReload;
35: }
37: export type ProfilePatchReload = 'live' | 'startup';
```

- Read: `dsh-app-boot/lib/index.js:845` (also normalised at `:779` by `normalizeShippedProfile`, which only touches installation-owned tuples).
- Written by `dsh plugin`: `plugin-Ddi42qoW.js:50, 70-77`.
- Template defaults: `dsh-app-boot/lib/index.js:328-336` — `web: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"], patchReload: "live" }`.
- `patchReload` is validated at `index.js:846-848` (throws unless `"live"`/`"startup"`); `"live"` mounts HMR/timer and watches the user patch files (`profile-boot-Dk-7KqJc.js:321`).

**Layer order** (`profile-boot-Dk-7KqJc.js:213-220`): `bundlePatches (in bundles order)` → `profiles/<name>/cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → `--patch` overlays → telemetry-disable patch. All applied over an **empty root** (`cordis.yml` is rewritten to `[]` on every boot, `profile-boot-Dk-7KqJc.js:124-130, 209`).

**Plugins are `dsh.profile.bundles` entries only — never a plugin name in `cordis.patch.yml` of the profile.** The bundle's own patch file inserts the rows.

### B.2.3 `dsh.client.*`

```ts
39: export interface DshClientManifest {
40:     /** Client platform identifier; the Web consumer selects `web`. */
41:     platform: string;
42:     /** Informational package-name dependencies, not Cordis service injection. */
43:     inject?: string[];
44:     /** Boot phase-one registration barrier; absent means the shared application batch. */
45:     immediately?: boolean;
51:     external?: string[];
52: }
```

Validated in `R/dsh-client-modules/lib/index.js`:

```js
140: function parseDshClient(pkgName, value) {
141: 	if (value === void 0) return void 0;
142: 	if (typeof value !== "object" || value === null) throw new Error(`client-modules: ${pkgName} has a non-object dsh.client declaration`);
143: 	const decl = value;
144: 	if (typeof decl.platform !== "string") throw new Error(`client-modules: ${pkgName} dsh.client.platform must be a string`);
145: 	const inject = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);
146: 	const external = optionalStringArray(pkgName, "dsh.client.external", decl.external);
147: 	if (decl.immediately !== void 0 && typeof decl.immediately !== "boolean") throw new Error(`client-modules: ${pkgName} dsh.client.immediately must be a boolean`);
```

and gated at `:650`:

```js
649: 		const decl = parseDshClient(packageName, dsh !== null && typeof dsh === "object" ? dsh.client : void 0);
650: 		if (decl === void 0 || decl.platform !== "web") { this.pkgMeta.set(sourceKey, null); return null; }
654: 		const clientRel = clientExportOf(packageName, pkg.exports);
655: 		if (clientRel === void 0) throw new Error(`client-modules: ${packageName} declares dsh.client but exports no "./client" bundle`);
```

Semantics:

| Field | Meaning |
|---|---|
| `platform` | Must be the string `"web"`. **Any other value is silently ignored** (the package is not a client module at all). |
| `inject` | **Package-name edges for client graph ordering** — the type doc says explicitly *"Informational package-name dependencies, not Cordis service injection."* Becomes `{inject: [...]}` on the graph row (`graphRow`, `:329-338`) and drives topological ordering (`orderByModuleGraph` `:349-371`). |
| `immediately` | *"Boot phase-one registration barrier; absent means the shared application batch."* Emitted as `immediately: true` on the graph row and consumed by the shell as `prefetchImmediateTier()`. Use it for UI that must exist before the app paints. |
| `external` | Exact non-inject module requests (optional; validated as a string array). |

The browser half re-reads these from the wire, not from `package.json` (`dsh-client-modules/lib/client.js:88-102`).

### B.2.4 `dsh.configTrees` — declaration only

**Reader: NOT FOUND.** Exhaustively, `configTrees` appears in this installation only in:

- `R/dsh/package.json:20-28` — the single real value:

```json
  "dsh": {
    "configTrees": [
      { "mount": "config/agent-presets", "path": "../../packages/preset/agent-presets/presets", "scanRoster": true }
    ]
  },
```

- `dsh-package-manifest` type declarations and README.

`R/dsh-package-manifest/README.md:75`:

```
- **Static typing only.** These declarations do not validate JSON, check file
  existence, or supply defaults. `configTrees` serves the experimental image
  packer, and `sessionFormatMigration` is discovered only for workspace migration
  packages; declaring them does not register external plugin behavior.
```

No packer package is installed under `@deepseek-ai`. **`mount`/`path`/`scanRoster` have no runtime consumer here — do not rely on them.** (`mount`, `path`, `scanRoster` semantics per the type file: mount = unique non-empty destination path in the image; path = non-empty source dir relative to the declaring package root; scanRoster = include the directory's YAML plugin rows in the package roster, absent = false.)

### B.2.5 Minimal correct `dsh` block for a plugin with BOTH a host half and a client half

```json
{
  "name": "my-dsh-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": "./lib/client.js",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": []
    }
  }
}
```

…paired with this `cordis.patch.yml`:

```yaml
- insert:
    - id: my-dsh-plugin
      name: my-dsh-plugin
      inject: [webServer]
```

Rationale for each line:

- `main` + `exports["."]` → the loader row's `name: my-dsh-plugin` is `import()`ed through ordinary Node resolution, so the root entry must resolve.
- `exports["./client"]` → **mandatory** when `dsh.client` is present (`:655` throws otherwise).
- `dsh.bundle.patch` → makes the package a profile layer; without it `dsh plugin add` warns *"declares no dsh.bundle — installed as a plain dependency, not a profile layer"*.
- `dsh.client.platform: "web"` → the only value the Web consumer accepts.
- `dsh.client.immediately: true` → prefetch in the stage-one tier (both installed third-party references do this).
- `inject: [webServer]` in the patch row is **Cordis service injection**; `dsh.client.inject` is a **package-name graph edge**. Do not confuse the two (the installed plugins make the same distinction: marketplace's row has `inject: [webServer]` while its `dsh.client.inject` lists two `@deepseek-ai/*` package names).

## B.3 `cordis.patch.yml`: what it is, schema, when you need one

**What it is:** the profile bundle's configuration layer — a top-level YAML **array of loader patch entries** that are flattened with every other layer and applied, in order, over an empty root entry list. A plugin needs one **iff** it wants to appear in the profile as a mounted Cordis row (which is the only way a host half loads, and the only way its `dsh.client` half gets discovered — see B.4/B.5).

**Patch entry type** — `R/cordis-plugin-include/src/index.ts:145-156`:

```ts
/** Runtime patch applied to entries loaded from an included config file. */
export interface PatchOptions {
  id?: string
  insert?: EntryOptions[]
  name?: string
  config?: any
  group?: boolean | null
  disabled?: boolean | null
  inject?: any
  intercept?: any
  isolate?: any
  [key: string]: any
}
```

**Row type** — `R/cordis-plugin-loader/src/config/entry.ts:9-22`:

```ts
export interface EntryOptions {
  /** Stable id inside the containing entry tree. */
  id: string
  /** Module specifier imported by the entry tree. */
  name: string
  /** Config passed to the plugin. */
  config?: any
  /** Marks this entry as a nested group. */
  group?: boolean | null
  /** Prevents this entry and descendants from running. */
  disabled?: boolean | null
  /** Required services or service intercept config for this entry. */
  inject?: Inject | null
}
```

**Application semantics** (identical implementation at `cordis-plugin-include/src/index.ts:58-125` and `dsh-app-boot/lib/index.js:59-108`):

| Construct | Behaviour |
|---|---|
| `- insert:` (no `id`) | appends rows to the **root** entry list |
| `- insert:` + `id:` | appends rows into that **group** row's `config` array; warns and skips if the id is unknown or the target is not a group |
| any other patch | **requires `id`** else `warn('patch: id is required for non-insert patches')` |
| `name` alongside `id` | an **assertion**; mismatch → warn + skip the whole patch |
| any other key (`config`, `disabled`, `inject`, `group`, `isolate`, `intercept`) | raw override written onto the row (`config` **replaces wholesale**, not merged) |
| target not found | warn only (`patch: entry %C not found`) — shared overlays need not match every tree |
| later patches may target rows an earlier patch inserted | inserted rows are re-indexed |

**Dialect:** custom `!!js` scalar; `disabled: !!js process.platform === 'win32'` is evaluated at entry activation (`entry.ts:104-108`). Top-level shape is validated loudly (`dsh-app-boot/lib/index.js:1192-1204`): must be an array of mappings; `name` values in inserts that are relative/absolute are rewritten to `file:` URLs (`:1170-1178`).

**Real, complete examples**

`ROOT B/dsh-workbench-ecs/cordis.patch.yml` (13 lines, complete):

```yaml
# dsh-workbench-ecs — profile bundle patch layer
# ==============================================
# 由 dsh.bundle.patch 声明, 经 `dsh plugin --profile web add dsh-workbench-ecs`
# 安装后作为 profile 组合层之一被应用 (写入 profiles/<name>/cordis.patch.yml
# 或 bundles 层均可)。
#
# 该行处于 host 平面: 随 dsh web 启动即挂载 ——
#   * 注册 7 个模型可见工具 (ecs_list / ecs_exec / ecs_upload / ecs_download /
#     ecs_diagnose / ecs_deploy / ecs_session);
#   * 注册设置页同源 RPC 路由 /dsh-workbench-ecs/*;
#   * 浏览器半 (lib/client.js) 在设置页出现「Workbench ECS」选项卡。
- insert:
    - id: workbench-ecs
      name: dsh-workbench-ecs
```

`ROOT B/dsh-plugin-marketplace/cordis.patch.yml` (9 lines, complete):

```yaml
# dsh-plugin-marketplace 的 bundle 补丁层（官方安装方式专用）
# 声明本插件如何挂载进 web profile，供以下命令使用：
#   dsh plugin --profile web install bradeGithub/DSH-Plugins-Marketplace
# 由 harness 的 dsh CLI 在安装时 reconcile 进 dsh.profile.bundles；
# 市场面板自带的安装流程（复制 + 注册到 profile patch）不受影响。
- insert:
    - id: plugin-marketplace
      name: dsh-plugin-marketplace
      inject: [webServer]
```

A mixed real example, `ROOT A/@deepseek-ai/dsh-acp-app/cordis.patch.yml` (21 lines, complete):

```yaml
# The automation-only ACP application over dsh-base. Stdout belongs to ACP.

- id: system-prompt
  config:
    personaSuffix: Your working directory is {{cwd}}.
    personaPrefix: >-
      You are a coding agent powered by the {{model}} model.

- id: session-title-llm
  disabled: true

- insert:
    - id: acp-app-startup
      name: '@deepseek-ai/dsh-acp-app'

    - id: acp
      name: '@deepseek-ai/dsh-acp'
      inject: [acpAppStartup]
      config:
        provider: deepseek-official
        model: deepseek-v4-flash
```

**Packages in this installation that declare `dsh.bundle.patch` (exhaustive over 241 `@deepseek-ai` packages):** `@deepseek-ai/dsh-base`, `dsh-web-app`, `dsh-acp-app`, `dsh-headless`, `dsh-sdk-app`, `dsh-sdk-minimal` — all `./cordis.patch.yml`. Plus the two third-party references. (69 `@deepseek-ai` packages declare `dsh.client` with `platform: "web"`.)

Sizes for context: `dsh-base/cordis.patch.yml` is 487 lines (one `- insert:` at `:15`, then ~30 `id:`-targeted overrides from `:456`); `dsh-web-app/cordis.patch.yml` is 484 lines (overrides `:16-38`, one `- insert:` at `:44`, ~40 `- id: X / disabled: true` rows `:368-471`, final `- insert:` `:480-484`).

## B.4 How plugin packages are discovered and loaded at runtime

### B.4.1 The chain

`dsh/lib/bin.js:144-148` → `runProfile` (`profile-boot-Dk-7KqJc.js:279`) → `composeProfile` (`:232`) → `@deepseek-ai/dsh-app-boot` `loadProfileDirectory` (`index.js:843-871`).

Per bundle name (`dsh-app-boot/lib/index.js:845-861`):

1. `resolveBundleDir(binName, packageName, installAnchor, profileDir)` — resolves the **directory**, install-anchor first, then the profile dir (`:826-832`); uses `createRequire(anchor).resolve.paths()` (`:807-813`) so `./package.json` need **not** be exported.
2. `readFileSync(join(packageDir, "package.json"))` → `dsh.bundle.patch` (throws if absent, `:852`).
3. `loadOverlayPatches(binName, join(packageDir, declared))` — parses that YAML as a patch list; **missing file throws** (`:1160-1168`).

`INSTALL_ANCHOR` is `@deepseek-ai/dsh/package.json` (`profile-boot-Dk-7KqJc.js:120`). The bundle package's **module is never imported** at this stage — only its patch file is read.

Then `composeEntries` (`index.js:904-909`) flattens all layers and `applyEntryPatches` builds the tree, mounted as the `cordis:include` root (`:1322-1349`), and `boot` (`:1525-1547`) awaits `ctx.get("loader").await()` and then **fails loudly** via `assertEntriesActivated` (`:1465-1494`) if any non-disabled entry has no fiber or is not ACTIVE.

### B.4.2 What `main` / `exports` must point to

- **Host half:** nothing in the boot path inspects `main`/`exports` — the row's `name` is `import()`ed through ordinary Node ESM/CJS resolution (`cordis-plugin-loader/src/config/tree.ts:145-162` → `ctx.loader.internal.import(name, baseUrl, {})`). So `exports["."]` (or `main`) must resolve. Subpath exports are legal and used in-box (e.g. `'@deepseek-ai/dsh-web-app/startup'` at `dsh-web-app/cordis.patch.yml:128`).
- **Packaged (`pkg`) executables** get an explicit check instead — `dsh-app-boot/lib/index.js:510-531` (`packageProxySource`) requires a non-empty `version` and falls back to `main`/`index` when `exports` is absent. (Not relevant to a plugin.)
- **Client half:** `exports["./client"]` is **mandatory** — B.2.3/B.5.

### B.4.3 How `dsh.client` triggers the client bundle to be served

Only `@deepseek-ai/dsh-client-modules` (node half) enumerates `dsh.client`. Its `ClientModuleRegistry extends Service` (`dsh-client-modules/lib/index.js:440-492`) injects `["loader"]`, seeds from `ctx.loader.entries()`, and subscribes to `ctx.on("internal/plugin", …)` for incremental rescans. Grep confirms **zero** `dsh.client` hits in `dsh-client-resources`, `dsh-host-frontend-static`, `dsh-web-app`, `dsh-web-frontend`.

For each mounted row whose `name` resolves to a package with `dsh.client.platform === "web"`, it:

1. resolves `exports["./client"]` → an on-disk path (`clientExportOf` `:155-166`, used at `:654-659`);
2. registers that package as a client module with `{inject, external, immediately}`;
3. registers a **`/plugins` prefix HTTP route** on `webServer` (`:480-486`, verified: `path: "/plugins"` at `:483`) and serves pre-built script bytes from it;
4. injects `window.__ModuleLoader__` (a queue facade), `<link rel=preload>`/blocking `<script>` tags and the `window.__DSH_BOOT__` graph into the HTML index through `ctx.on("webserver/index-inject", …)` → `bootInjections` (`:387-432`, `:489-491`).

Critically: **the mount is what triggers all of this.** A package that declares `dsh.client` but is not mounted as a row is never enumerated — the registry walks *loader entries*.

## B.5 Does the WebUI serve `lib/client.js` directly? Exact filename and wrapper format

**Yes, it serves the file over HTTP — but not from a plain static path.**

### B.5.1 The route

`dsh-client-modules/lib/index.js:480-486`:

```js
		const registerWebCarrier = (webCtx) => {
			webCtx.effect(() => webCtx.webServer.register({
				kind: "prefix",
				path: "/plugins",
				handler: this.serveBundle
			}), "client-modules: bundle route");
		};
```

`serveBundle` → `bundleResource` (`:857-877`) looks up `${pathname}${search}` in an in-memory `responses` map (plus `previousBatchResponses`), returning `200` with the concatenated script or **`404`**.

### B.5.2 The exact URL form

Every key is minted by `comboUrl` (`:182-184`, verified):

```js
function comboUrl(ids, rev, sourceMap = false) {
	return `/plugins/??${ids.map((id) => `${id}/client.js${sourceMap ? ".map" : ""}`).join(",")}&rev=${rev}`;
}
```

- single bundle: `/plugins/??<package-name>/client.js&rev=<12hex>`
- source map: `/plugins/??<package-name>/client.js.map&rev=<12hex>`
- batch: `/plugins/??<id1>/client.js,<id2>/client.js&rev=<rev>` (partitioned at 3 KiB, `MAX_COMBO_URL_BYTES`)

**A bare `/plugins/<name>/client.js` is NOT a route and returns 404.** The comment in `dsh-web-app/cordis.patch.yml:173` ("serves `/plugins/<id>/client.js`") is imprecise shorthand; the combo form is authoritative.

### B.5.3 Expected filename / path convention

**There is no fixed filename.** The served path segment is always `<package-name>/client.js`, but the actual file is whatever `exports["./client"]` resolves to, joined to the package dir:

```js
function clientExportOf(pkgName, exportsField) {
	if (typeof exportsField !== "object" || exportsField === null) return void 0;
	const client = exportsField["./client"];
	if (client === void 0) return void 0;
	if (typeof client === "string") return client;
	if (typeof client === "object" && client !== null) {
		const fallback = client.default;
		if (typeof fallback === "string") return fallback;
	}
	throw new Error(`client-modules: ${pkgName} exports["./client"] must be a string or an object with a string default`);
}
```

`clientPath = join(dirname(pkgJsonPath), clientRel)` (`:659`). `clientExportOf` is at `:156-166`. In practice all three plugins studied use `"./lib/client.js"` (the two third-party refs) or `"./client.js"` (the prior art), so **`lib/client.js` is convention, not requirement**.

A **missing bundle is a loud error**, not a silent 404: `CLIENT_BUNDLE_BUILD_INSTRUCTION = "run \`pnpm run build\` before launch"` and `MissingClientBundleError` (`:90-105`).

### B.5.4 Wrapper format — YES, required

The file must be a **classic script** that calls `window.__ModuleLoader__.load({ id, factory })` at top level. The module doc (`dsh-client-modules/lib/index.js:16-23`) states the lazy-CJS model:

> *Lazy CJS model: executing a plugin bundle only REGISTERS its factory (`window.__ModuleLoader__.load({id, factory})`); every module body side effect — including CSS injection — lives inside the factory closure and runs at materialization, not at script execution.*

The served bytes are the file **concatenated verbatim** into the combo script; only `//# sourceMappingURL=` / `//# sourceURL=` trailers are stripped (`comboSource` `:207-218`). Registration is validated by id at load time (`client.js:230-232, 247-250`):

```js
return transport.then(() => {
  if (!this.factories.has(id)) throw new Error(`client-modules: bundle ${url} loaded without registering "${id}" via __ModuleLoader__.load`);
```

So the `id` **must equal the package name** (the same string used in the URL and in `require("<name>")`), and `factory(require)` must return `module.exports` with `apply`/`inject` for Cordis.

There is **no manifest file on disk**: the index is the in-memory `window.__DSH_BOOT__` graph (`{rev, entries[], batches[]}`, validated in `client.js:71-130`), emitted as an inline queue facade + preload/script tags + a `kind:"global"` injection by `bootInjections` (`:387-432`), registered via `ctx.on("webserver/index-inject", …)` (`:489-491`) and rendered by `dsh-host-webserver/lib/index.js:74-93` from the fallback seat of `dsh-host-frontend-static` (`lib/index.js:82-96`). `require` is **synchronous** factory-form CJS; only seed words resolve out of the box (`react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-dockkit`); anything else must be declared via `dsh.client.inject`/`external` and arrive as a graph row.

### B.5.5 Verbatim wrappers from the two working references

`ROOT B/dsh-workbench-ecs/lib/client.js:1-22` (769 lines, 60,305 B, pre-built, no sourcemap trailer):

```js
// ============================================================================
// lib/client.js —— dsh-workbench-ecs 浏览器半 (单文件 client bundle)
// ----------------------------------------------------------------------------
// 以 DSH 客户端模块系统的工厂形式注册: window.__ModuleLoader__.load({id, factory})。
// 仅 require 平台种子 'react'; 宿主交互全部走同源路由 /dsh-workbench-ecs/rpc
// (host 侧由 lib/index.js 的 webServer.register 提供, 见 cordis.patch.yml)。
// ...
window.__ModuleLoader__.load({
  id: 'dsh-workbench-ecs',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
```

`ROOT B/dsh-plugin-marketplace/lib/client.js:1-8` (1559 lines, 101,559 B, pre-built):

```js
window.__ModuleLoader__.load({
  id: "dsh-plugin-marketplace",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var react = require("react");
    var h = react.createElement;
```

The prior-art plugin's `client.js` uses the identical shape, with `id: 'dsh-custom-provider-settings'` and `factory: (require) => { … }` (A.9.3).

## B.6 GitHub specs, npm names, and whether a build step runs on install

**GitHub spec (`github:OWNER/REPO`):** forwarded **verbatim** to pnpm — there is **no parsing, no rewriting**. The only argument transformation is `anchorPathSpec` for relative paths. The string is inspected *only* to decide whether to print the `allowBuilds` hint (bold text in the code below).

**npm name:** likewise forwarded verbatim; `pnpm add <name>` resolves it from the registry.

**Reconciliation** then runs by installed state, so the git spec's *real* package name lands in `dsh.profile.bundles` (`plugin-Ddi42qoW.js:36-39`: *"pnpm has already written the real installed names (so a git/path/tarball/alias spec on the command line reconciles by its true package name)"*). Real, working evidence in this profile: `~/.dsh/profiles/web/package.json` has `"dsh-plugin-marketplace": "github:bradeGithub/DSH-Plugins-Marketplace"` and `dsh-plugin-marketplace` in `bundles`.

**Build step on install — the answer that matters for a TypeScript plugin:**

- `dsh plugin add github:OWNER/REPO` makes pnpm install a **git dependency**, and pnpm's git-dependency pipeline runs the package's `prepare` script after checkout. **pnpm 10+ blocks build scripts by default** and requires an allowlist.
- DSH's only handling of this is a **diagnostic message**, `plugin-Ddi42qoW.js:125` (verified by grep):

```
dsh: git-hosted plugins build on install via their prepare script, which pnpm blocks until allowed — add the exact key pnpm printed above under allowBuilds in /Users/guofeng/.dsh/profiles/web/pnpm-workspace.yaml, then re-run
```

- **`grep -rn "allowBuilds\|onlyBuiltDependencies"` over `@deepseek-ai/dsh/lib` and `@deepseek-ai/dsh-app-boot/lib` returns only that one string.** DSH never writes the key; the user must hand-edit `pnpm-workspace.yaml`. The live profile's file (5 lines) still has no such key:

```yaml
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
```

**Practical consequences for this project (TypeScript):**

1. Shipping a **`prepare`/`build` script and relying on it during `dsh plugin add github:…` will fail on a default pnpm 10+/11 profile** until the user adds `allowBuilds` (or `onlyBuiltDependencies`) to `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`. That is a bad UX for a plugin we want to be one-command installable.
2. Therefore **prebuilt JS must be committed / published** (the choice both working references — and the prior art — made). `dsh-plugin-marketplace`'s `package.json` has **no `scripts` field at all**, and `git ls-files lib/client.js` confirms `lib/client.js` is a tracked artifact.
3. Installing from a **release `.tgz`** or from npm avoids the git `prepare` path entirely — which is exactly why the prior art's README makes TGZ the "recommended" option.
4. If a build step is genuinely needed, the alternative is to install from a local directory/`file:` spec after building (`npm pack` → `dsh plugin add ./dist/<name>.tgz`), as the prior art documents for development.

## B.7 The two installed third-party plugins as real references

Layout:

```
ROOT B/dsh-workbench-ecs/
  package.json            main: lib/index.js, exports "." -> ./lib/index.js, "./client" -> ./lib/client.js
  cordis.patch.yml        - insert: [{id: workbench-ecs, name: dsh-workbench-ecs}]
  lib/index.js            host half (prebuilt)
  lib/client.js           browser half (prebuilt, __ModuleLoader__ wrapper, 60 KB)
  lib/{common,runbooks,settings-api,steps-engine}.js
  lib/tools/ecs-{list,exec,log,upload,download,diagnose,deploy,runbook,session}.js
  lib/types/index.d.ts
  templates/runbooks/*.json
  README.md README.zh.md LICENSE
```

`dsh` block (`dsh-workbench-ecs/package.json`):

```json
  "dsh": {
    "client": { "platform": "web", "immediately": true, "inject": [] },
    "bundle": { "patch": "./cordis.patch.yml" }
  }
```

Its `scripts` are **test-only** (`test`, `test:unit`, `test:ui`, `test:e2e`, `build:body`) — there is **no build script that produces `lib/*.js`**; the shipped `lib/` is committed. `exports` includes `"."` with `types`/`default`, `"./client"`, `"./package.json"`. It also declares `peerDependencies` on `@deepseek-ai/dsh-tools` and `@deepseek-ai/cordis`.

```
ROOT B/dsh-plugin-marketplace/
  package.json            main: lib/index.js, exports "." -> ./lib/index.js, "./client" -> ./lib/client.js
  cordis.patch.yml        - insert: [{id: plugin-marketplace, name: dsh-plugin-marketplace, inject: [webServer]}]
  lib/index.js            59,528 B (host half, prebuilt)
  lib/client.js          101,559 B (browser half, prebuilt, __ModuleLoader__ wrapper)
  lib/{app,client-src,domain,http,infra}/…
  registry.json          10.7 MB marketplace data (NOT read by DSH)
  registry.json.gz, skills.json, skills.json.gz, install.sh, install.ps1,
  STANDARD.md, README.md, audit-expected.json, installability-report.json, adaptor.json, docs/, scripts/
```

`dsh` block:

```json
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-settings"],
      "immediately": true
    }
  }
```

Crucially: **this package has no `scripts` field at all** — `lib/client.js` is a committed build artifact. The installed copy is a full git clone (it carries `.git/`, `.github/`, `install.sh`) with a clean working tree. `lib/client-src/` is retained beside the built `lib/client.js`, which is a nice convention for a TypeScript/JSX plugin that must ship prebuilt output.

**Summary both references share:** flat-ish `lib/` with `lib/index.js` (host) + `lib/client.js` (client), `cordis.patch.yml` with a single root `- insert:`, `dsh.bundle.patch` + `dsh.client{platform:"web", immediately:true}`, prebuilt committed client bundle, no install-time build.

## B.8 The local pnpm gotcha — verified state and the workable install command

**The documented workaround directory does NOT currently exist.** Verified:

```
$ ls -la /private/tmp/pnpm11
NOT FOUND: /private/tmp/pnpm11
```

Verified toolchain state:

| Item | Value |
|---|---|
| `pnpm` on PATH | **8.9.2** (`/Users/guofeng/.volta/bin/pnpm`, also `/Users/guofeng/Library/pnpm/pnpm`) |
| `node` | v24.19.0 |
| `npm` | 11.17.0 |
| `corepack` | 0.35.0 (at `…/runtime/node/24.19.0/bin/corepack`) |
| pnpm store the profile was built with | `storeDir: /Users/guofeng/Library/pnpm/store/v11`, `packageManager: "pnpm@11.24.0"` (from `~/.dsh/profiles/web/node_modules/.modules.yaml`) |
| profile lockfile | `lockfileVersion: '9.0'` |
| `dsh` launcher | `~/.local/bin/dsh` → `/bin/sh` wrapper exec'ing `…/runtime/node/24.19.0/bin/node …/@deepseek-ai/dsh/lib/bin.js "$@"` |
| npm registry has pnpm 11.24.0 | `npm view pnpm@11.24.0 version` → `11.24.0` |

So the conflict is real and reproducible: `dsh plugin` spawns PATH `pnpm` = **8.9.2** (store v3) against a profile materialized by **pnpm 11.24.0** (store v11) → `ERR_PNPM_UNEXPECTED_STORE`.

**Exact working install command** (recreate the shim dir first, since it is gone):

```bash
# one-time: rebuild the pnpm 11 shim directory (verified: npm 11.17.0 can resolve pnpm@11.24.0)
npm install --prefix /private/tmp/pnpm11 pnpm@11.24.0

# then every plugin operation:
PATH="/private/tmp/pnpm11/node_modules/.bin:$PATH" dsh plugin --profile web add <pkg>
```

Concrete examples:

```bash
# from a GitHub repo (main branch)
PATH="/private/tmp/pnpm11/node_modules/.bin:$PATH" dsh plugin --profile web add github:OWNER/REPO

# from a release tarball
PATH="/private/tmp/pnpm11/node_modules/.bin:$PATH" dsh plugin --profile web add https://github.com/OWNER/REPO/releases/download/v0.1.0/pkg-0.1.0.tgz

# from a local checkout (npm pack first)
PATH="/private/tmp/pnpm11/node_modules/.bin:$PATH" dsh plugin --profile web add ./dist/pkg-0.1.0.tgz

# remove
PATH="/private/tmp/pnpm11/node_modules/.bin:$PATH" dsh plugin --profile web remove <pkg>
```

Notes:

- `dsh plugin --profile web install …` is the same command (`install` is just a pnpm alias; the marketplace's own `install.sh` uses it).
- Because `spawnSync("pnpm", …)` uses `stdio: "inherit"`, pnpm's own output (including any `allowBuilds` key name) is printed verbatim to your terminal — read it.
- **UNVERIFIED / not attempted here:** actually running the install (this task forbids modifying anything outside the report). Only the *resolvability* of `pnpm@11.24.0` from npm was verified in this session. A corepack-based alternative (`corepack prepare pnpm@11.24.0 --activate`) was **not tested** and is recorded as an option, not a verified path.
- After install, restart `dsh web` (the launcher rewrites `cordis.yml` and applies layers at boot; the marketplace README and the prior art README both instruct stopping the WebUI first).

## B.9 Distilled checklist for this project's packaging

1. `package.json`: `type: "module"`, `main`/`exports["."]` → host entry, `exports["./client"]` → client entry, `exports["./package.json"]`.
2. `dsh.bundle.patch: "./cordis.patch.yml"`, and the file must contain a root `- insert:` with `id`/`name` (optionally `inject`, `config`). A missing patch file is a **fatal boot error**.
3. `dsh.client: { platform: "web", immediately: true, inject: [...] }` — `inject` entries are **package names** and must match real client packages; `immediately` puts the bundle in the stage-one prefetch tier.
4. Client entry must be **pre-bundled** as `window.__ModuleLoader__.load({ id: '<package-name>', factory: (require) => { … return module.exports } })`, with `exports.apply`/`exports.inject` for Cordis, and only platform seed words `require`d (or declared as graph edges).
5. Ship **prebuilt JS in git and in the npm/tgz artifact**; do not depend on a `prepare` build running at install time (pnpm blocks it; DSH only prints a hint).
6. Put the package in the profile with `dsh plugin --profile web add …` under the pnpm-11 `PATH`, then restart `dsh web`.
7. Expect `dsh` to add the package to `dsh.profile.bundles` automatically — only if it declares `dsh.bundle.patch` and pnpm exits 0.
8. `dsh.configTrees` and `dsh.client.platform` values other than `"web"` are inert here: do not use them.
