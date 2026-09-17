# DSH WebUI client-plugin runtime — recon report (0.1.5-rc.2)

Read-only reconnaissance for `dsh-advanced-provider-settings`. Every claim below is
quoted from an installed file with an exact path and line number. Where something
was not discoverable it says **NOT FOUND** and lists what was searched.

## 0. Path legend and environment

| Alias | Exact path |
|---|---|
| `RUNTIME` | `/Users/guofeng/Library/Application Support/DeepSeek Harness Desk/runtime/dsh/0.1.5-rc.2/node_modules/@deepseek-ai` |
| `DIST` | `RUNTIME/dsh-web-frontend/dist/assets/index-BKQ_L1z6.js` (single-line minified, 556 KB) |
| `PROFILE` | `/Users/guofeng/.dsh/profiles/web` |
| `PROJ` | `/Users/guofeng/Code/solo/dsh-advanced-provider-settings` |

Version of every `@deepseek-ai` package inspected: `0.1.5-rc.2`.
Marketplace reference plugin: `PROFILE/node_modules/dsh-plugin-marketplace` v1.6.0.

Two important conveniences for the implementation:

- The type packages that are **not published to npm as runtime deps of DSH** but *are*
  installed in `PROJ/node_modules/@deepseek-ai/`: `dsh-client-ui-slots`,
  `dsh-client-store`, `dsh-client-ui-primitives`, `dsh-client-locale`,
  `dsh-client-ui-settings`, `dsh-client-ui-settings-models`. Their `.d.ts` files are the
  authoritative contract and are quoted below. (`RUNTIME` itself does **not** ship
  `dsh-client-ui-slots` or `dsh-client-store` as packages — the shell inlines them; see §1.)
- `DIST:114` contains the whole boot kernel including the platform seed table. Call it
  `DIST:114` for every quote taken from it.

---

## 1. `window.__ModuleLoader__` — where it comes from, and what it can `require`

### 1.1 The facade is injected by the host into `<head>`

`RUNTIME/dsh-client-modules/lib/index.js` (node half) emits the index `<head>` rows.
Function `bootInjections`, **lines 387–409**:

```js
function bootInjections(graph) {
	const queue = `(()=>{
const pendingQueue=[]
window.__ModuleLoader__={
  mode:"queue",
  pendingQueue,
  load(registration){pendingQueue.push(registration)},
  create(options){
    if(this.mode!=="queue")throw new Error("client-modules: window.__ModuleLoader__.create called after module-system boot")
    const index=pendingQueue.findIndex(registration=>registration.id===${JSON.stringify(CLIENT_MODULES_ID)})
    ...
    return exports.createClientModuleSystem(this,{id:registration.id,exports},options)
  }
}
})()`;
```

`CLIENT_MODULES_ID` is `"@deepseek-ai/dsh-client-modules"` (`lib/index.js:373`:
`const CLIENT_MODULES_ID = "@deepseek-ai/dsh-client-modules";`).

Index row order (`lib/index.js:410–430`): the queue script, then `script-preload`
application combos, then parser-blocking `script-src` bootstrap combos, then
`global: __DSH_BOOT__` = the graph. So `window.__ModuleLoader__` exists before any plugin
bundle runs, in **queue mode**: `load()` only pushes into `pendingQueue`.

`DIST:114` is the shell that calls `create()`:

```js
async run(){ ... const t=globalThis, r=t.__ModuleLoader__;
  if(r===void 0)throw new Error("web boot: window.__ModuleLoader__.bootstrap facade is missing");
  const i=globalThis.__DSH_TRANSPORT__;
  this.modules=r.create({boot:t.__DSH_BOOT__,staticModules:by(), ...this.seams}), ...
```

### 1.2 The platform seed table — the exact allowlist of always-available specifiers

`DIST:114`, function `by()` (this is what the client-modules README calls
`PLATFORM_MODULES`, `RUNTIME/dsh-client-modules/README.md:42`):

```js
function by(){return{
  react: ec,
  "react/jsx-runtime": ic,
  react-dom: cc,
  "react-dom/client": fc,
  "@deepseek-ai/cordis": Ha,
  "@deepseek-ai/dsh-client-store": Hc,
  "@deepseek-ai/dsh-client-ui-slots": Ac,
  "@deepseek-ai/dsh-client-ui-primitives": Zg,
  "@deepseek-ai/dsh-client-ui-dockkit": Ey
}}
```

That is the **complete, closed list — 9 specifiers**:

1. `react`
2. `react/jsx-runtime`
3. `react-dom`
4. `react-dom/client`
5. `@deepseek-ai/cordis`
6. `@deepseek-ai/dsh-client-store`
7. `@deepseek-ai/dsh-client-ui-slots`
8. `@deepseek-ai/dsh-client-ui-primitives`
9. `@deepseek-ai/dsh-client-ui-dockkit`

Exports of the two most relevant seeds (from the same `Object.freeze` literals in `DIST`):

- `Hc` (`dsh-client-store`) = `{ createSnapshotStore, defineStore, notifySubscribers, shallowEqual }`
  (types: `PROJ/node_modules/@deepseek-ai/dsh-client-store/lib/types/index.d.ts`).
- `Ac` (`dsh-client-ui-slots`) = `{ SlotCore, SlotOwnershipError, StaleAuthorizationError,
  resolveSlotLabel, standardHookPropName }` (`DIST:56`, `const Ac=Object.freeze(...)`).
  The **runtime** `ctx.slots` service is not in this seed; it is a cordis service
  (§4). The seed export is the pure core, useful only to the renderer.

`@deepseek-ai/dsh-client-ui-primitives` (`Zg` in `DIST:114`) is the full component kit:
`Button, Input, Switch, Modal, Menu, Pill, Tag, Tooltip, Toast, StateDot, DisclosureRow,
MarkdownText, CodeBlock, DiffBlock, TerminalBlock, SearchBlock, ReadBlock, WebBlock,
JsonBlock/JsonTree, HoverCard, FileTypeIcon, FishLogo, BrandWordmark, ConnectionIndicator,
risk/onboarding surfaces, ~60 `Icon*` components, `classifyFileType`, `relativeTime`, …`
(full list extracted from the `Object.freeze` literal at `DIST:114`).

### 1.3 Additional specifiers: boot-graph rows, declared via `dsh.client.external`

Everything else must be an installed+enabled package that itself declares
`dsh.client.platform === "web"`. Such a package becomes a **graph row** and its bundle
can be required by bare package name or `<pkg>/client` (`/client` is stripped:
`lib/client.js:61-63`).

The consumer must declare the request in `dsh.client.external`, validated by
`parseDshClient` (`lib/index.js:140-155`):

```js
const inject = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);
const external = optionalStringArray(pkgName, "dsh.client.external", decl.external);
```

Only two shipped packages use it (`RUNTIME/*/package.json`):

```json
"@deepseek-ai/dsh-api-session-controller": { "external": ["@deepseek-ai/dsh-api-gateway/client"], ... }
"@deepseek-ai/dsh-api-workspace-controller":  { "external": ["@deepseek-ai/dsh-api-gateway/client"], ... }
```

`orderByModuleGraph` (`lib/index.js:349-370`) orders rows so an `external` supplier
precedes its consumer, and rejects self-requests and cycles. Note the exact safety
property: **a missing supplier is silently ignored at composition time**

```js
const dependency = rowsById.get(name) ?? rowsById.get(stripClientSuffix(name));
if (dependency === entry) throw new Error(`... requests module "${name}" that it answers itself ...`);
if (dependency !== void 0) visit(dependency);      // <-- no throw when undefined
```

So a bogus `external` entry does not fail boot; it fails at `require` time.

### 1.4 What happens on an unknown specifier

Synchronous require, `RUNTIME/dsh-client-modules/lib/client.js:300-309`:

```js
makeRequire(edges) {
  return (spec) => {
    edges.add(spec);
    if (this.seed.has(spec)) return this.seed.get(spec);
    const id = stripClientSuffix(spec);
    const record = this.loadCache.get(id);
    if (record !== void 0) return record.exports;
    if (this.factories.has(id)) return this.materialize(id).exports;
    throw new Error(`client-modules: require("${spec}") missed the module table — not a platform seed word, not a materialized module, and no registered package factory (a build-time externals drift, or a dynamic dependency that did not arrive)`);
  };
}
```

Async import, same file lines 311–320: throws
``client-modules: cannot resolve "${specifier}" — not a seed word, not a materialized module, and not a row in the boot graph (the runtime mirror of the bundle purity gate)``.

There is **no second allowlist object**. Resolution order is exactly: seed word →
memoized record → registered factory (sync) / graph row then materialize (async).
Anything else throws loudly at runtime. The "bundle purity gate" that would reject a bad
import at *build* time lives in `packages/client/tsdown.client.ts`, which is **NOT
FOUND** in any installed artifact (see §8.3).

### 1.5 Empirical proof: what shipped bundles actually require

`grep -rho 'require("[^"]*")' RUNTIME/*/lib/client.js | sort | uniq -c`:

```
  42 require("react")
  40 require("react/jsx-runtime")
  38 require("@deepseek-ai/dsh-client-ui-primitives")
  30 require("@deepseek-ai/dsh-client-store")
  15 require("@deepseek-ai/cordis")
   9 require("react-dom")
   6 require("@deepseek-ai/dsh-client-ui-slots")
   2 require("@deepseek-ai/dsh-api-gateway/client")   <- the only cross-plugin value import
   1 require("react-dom/client")
   1 require("@deepseek-ai/dsh-client-ui-dockkit")
   1 require("url")                                    <- inside a document-preview polyfill bundle
   1 require("${spec}")                                <- template literal in a dynamic-require wrapper
```

**Consequence for this project:** you may **not** `require("@deepseek-ai/dsh-client-locale")`
or `require("@deepseek-ai/dsh-client-ui-settings")` in the normal case. They are graph rows,
not seeds, and no shipped plugin does it. Cross-plugin collaboration is via cordis
services (`ctx.locale`, `ctx.settingsScope`) — stated as policy at
`RUNTIME/dsh-client-ui-settings/lib/types/client/settings-scope.d.ts:96-98`:
"the client bundle purity gate forbids cross-plugin value imports and directs cross-plugin
collaboration through cordis services (`packages/client/tsdown.client.ts`)".

---

## 1a. `dsh.client` — the failures that are silent, and the ones that are fatal

Two discovery paths locate a package's manifest, and they differ in what they
require of the package. `locatePkgJson`
(`RUNTIME/dsh-client-modules/lib/index.js:672-713`):

1. **Real Loader** (`ctx.loader.internal.resolveSync` present — the server):
   resolve the entry name to a module URL, then `nearestPackage` walks up from
   that file to the nearest `package.json` whose `name` matches. This needs
   `exports['.']` to resolve, but **not** `exports['./package.json']`.
2. **Fallback** (no Node internals): `createRequire(baseUrl).resolve("<pkg>/package.json")`.
   This needs `exports['./package.json']` to exist **and** be exported.

> A package that fails either path is **skipped in silence**. `resolveMeta`
> returns `null`, `resolveSource` returns `undefined`, the source is never added,
> and nothing is logged or thrown — the plugin simply has no browser half, with
> no diagnostic anywhere. Publishing both `exports['.']` and
> `exports['./package.json']` makes the package survive either path, which is
> cheap insurance against a failure that would otherwise be unobservable.

By contrast, a package that *does* resolve but whose declaration is malformed is
fatal and loud. `ClientModuleRegistry`'s constructor aggregates every failure and
throws one `ClientPackageCompositionError`, so the blast radius is the **whole
web plugin table**, not one plugin. The triggers, each verified against the real
implementation in `tests/composition.test.ts`:

| Trigger | Message fragment |
|---|---|
| No `exports["./client"]` while declaring `dsh.client` | `declares dsh.client but exports no "./client" bundle` |
| `exports["./client"]` neither a string nor `{default: string}` | `must be a string or an object with a string default` |
| `dsh.client.inject` not a string array | `inject must be a string array` |
| `dsh.client.immediately` not a boolean | `immediately must be a boolean` |
| `exports["./client"]` resolves but the file is absent | `client bundles not found; run \`pnpm run build\` before launch` (names package + path) |

The last row is the reason this package commits its built bundles: the loader
does not build, and a missing artifact is a boot failure for every plugin.

## 1b. `dsh.client` — what the loader actually does with `inject` and `immediately`

Both fields are validated by `parseDshClient`
(`RUNTIME/dsh-client-modules/lib/index.js:139-153`), and the two are consumed
very differently. Getting this backwards is the difference between a bundle that
loads and one that silently does not.

**`inject` is an ARRIVAL edge, not a require edge.** The browser system walks it
in `arriveGraphRow` (`lib/client.js:252-270`): for each name in `row.inject` it
recursively arrives that package's bundle *before* arriving this one. It does
**not** make the package requirable — that is `external`'s job, and only the nine
item static seed table plus declared `external` edges are answerable from
`makeRequire`. So `inject` only ever buys ordering, and a name that matches no
graph row is skipped in silence.

**`immediately` is parsed and then never read.** It is validated at
`lib/index.js:147`, threaded into the row at `:335` and `:662`, re-validated on
the wire at `lib/client.js:90` and `:101` — and that is the last of it. The
batching decision does not consult it: `ClientModuleRegistry.compose()`
(`lib/index.js:586-593`) puts the client-modules bootstrap into the `bootstrap`
phase and **every other row** into the `application` phase, preloaded via
`<script-preload>` in `bootInjections` (`:410-423`). A plugin bundle therefore
always loads at boot whether it declares `immediately: true`, `false`, or nothing
at all.

This is worth knowing for two reasons. A plugin cannot rely on `immediately:
false` to defer its cost (nothing defers), and it cannot rely on absence from the
application batch to stay unloaded — every `dsh.client` package is in it. The
`ctx.slots.inject` parking behaviour, not the manifest, is what actually makes
late-declared slots safe to target.

## 2. The plugin client-module contract: which exports are read

### 2.1 Normalization: `unwrapExports` — and yes, `default` is used

`RUNTIME/cordis-plugin-loader/lib/index.js:745-751` (the loader the shell installs;
`DIST:114` does `await t.plugin(Ba)` where `Ba` is this loader's client bundling):

```js
/** Normalize ESM/CJS/default export shapes before applying a plugin. */
unwrapExports(exports) {
  if (isNullable(exports)) return exports;
  exports = exports.default ?? exports;
  if (!exports.__esModule) return exports;
  return exports.default ?? exports;
}
```

Bundle wrappers set `Symbol.toStringTag` but **not** `__esModule`
(`RUNTIME/dsh-client-locale/lib/client.js:6`:

```js
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
```

so `exports.__esModule` is `undefined` → falsy → the loader returns the whole
`module.exports` object. The first line `exports.default ?? exports` still means a
bundle that wants to export a bare plugin object may set `exports.default` instead of
`exports.apply`.

### 2.2 What Cordis reads off the plugin object

`RUNTIME/cordis/lib/index.js:1445-1447`:

```js
function isApplicable(object) {
  return object && typeof object === "object" && typeof object.apply === "function";
}
```

`RUNTIME/cordis/lib/index.js:1532-1537`:

```js
resolve(plugin) {
  try {
    if (typeof plugin === "function") return plugin;
    if (isApplicable(plugin)) return plugin.apply;
  } catch {}
}
```

`RUNTIME/cordis/lib/index.js:1618-1636`:

```js
plugin(plugin, config, getOuterStack = buildOuterStack()) {
  const callback = this.resolve(plugin);
  if (!callback) throw new Error("invalid plugin, expect function or object with an \"apply\" method, received " + typeof plugin);
  ...
  let name = plugin.name;
  if (name === "apply") name = void 0;
  runtime = { name, callback, fibers: new DisposableList(), Config: plugin.Config };
  ...
  const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack);
```

`RUNTIME/cordis/lib/index.js:1066-1070`:

```js
if (isConstructor(runtime.callback)) {
  const instance = new runtime.callback(this.ctx, this.config);
  ...
} else return runtime.callback(this.ctx, this.config);
```

**Full contract:**

| Export | Read? | Meaning |
|---|---|---|
| `apply` | **yes, required** | `apply(ctx, config)`; must be a function (or the object must have `apply`) |
| `inject` | **yes** | cordis service names: array or `{name: config}`; `Inject.resolve(plugin.inject)` |
| `name` | optional | runtime/diagnostics label (ignored when it is literally `"apply"`) |
| `Config` | optional | schemastery schema for the entry config |
| `default` | **yes, via `unwrapExports`** | alternative to `apply` if it points at a function/object plugin |
| `dispose` | **NO — never read** | teardown is `ctx.effect(...)` / `ctx.on(...)`; fiber disposal runs the returned disposers |

Empirical check across all shipped client bundles: `exports.dispose = ` occurs **0**
times; `exports.apply`/`exports.inject` in ~55 bundles; `exports.name` ×2;
`exports.Config` ×1. The marketplace bundle is the same shape
(`PROFILE/node_modules/dsh-plugin-marketplace/lib/client.js` tail):

```js
exports.apply = apply;
exports.inject = ["slots", "locale"];
return module.exports;
```

`inject` is best-effort at the module level: the shell's boot audit reports
`<pkg>: pending (waiting for service: ...)` and the whole page fails with
`web boot: N entries did not activate` (`DIST:114`, `assertEntriesActive`).

---

## 3. The `ctx` object: every service, its inject name, and its signatures

### 3.1 Always available (core cordis `Context`, no inject needed)

From `RUNTIME/cordis/lib/types/`:

| Call | Signature | Source |
|---|---|---|
| `ctx.get(name, strict?)` | read a service without declaring a dependency | `reflect.d.ts:14-16` |
| `ctx.provide(name, value)` | register a service; returns disposer | `reflect.d.ts:41-43` |
| `ctx.inject(deps, cb)` | start a child fiber once services resolve | `registry.d.ts:185` |
| `ctx.plugin(plugin, config?)` | start a plugin | `registry.d.ts:195+` |
| `ctx.effect(fn, label?)` | `fn: () => Disposable \| Iterable<Disposable> \| Promise<...>`; returns `Disposable<Promise<void>>` | `fiber.d.ts:157-159` |
| `ctx.on(event, listener, opts?)` | subscribe; returns disposer | `events.d.ts:197` |
| `ctx.emit / parallel / bail / waterfall` | event dispatch | `events.d.ts:136-167` |
| `ctx.logger(name?)` | `LoggerService` | `context.d.ts:27` |
| `ctx.reflect` | service store (`provide`, `get`, `set`, accessors) | `context.d.ts:29` |
| `ctx.registry`, `ctx.loader`, `ctx.fiber` | plugin registry / loader / this fiber | `context.d.ts:30-31` |
| `ctx.isolate(name, label?)`, `ctx.intercept`, `ctx.extend(meta)` | scoped child contexts | `context.d.ts:83-99` |

For client plugins, `ctx.effect` is the standard teardown route, e.g.
`RUNTIME/dsh-client-locale/lib/client.js:1390`:
`ctx.effect(() => locale.subscribe(sync), "locale: language row and document synchronization");`

### 3.2 Injectable client services

The full inject-name → service map, harvested from every shipped client bundle's
`const inject = [...]`:

| inject name | Service on `ctx` | Provided by | Notes |
|---|---|---|---|
| `slots` | `SlotRegistry` | `ui-renderer` | §4 — the UI contribution API |
| `locale` | `LocaleRuntime` | `dsh-client-locale` | §6 |
| `settingsScope` | `SettingsScopeBinder` | `dsh-client-ui-settings` | §7 |
| `settingsSchema` | `SettingsSchemaService` | `dsh-client-ui-settings` | schema introspection |
| `remote` | `ClientRemote` | `dsh-api-remotes` | all Host RPC namespaces |
| `theme` | theme service | `dsh-client-ui-theme` | `getTheme()`, `theme/change` event |
| `layout` | `LayoutController` | `dsh-client-ui-layout` | |
| `sessions` | session controller | `dsh-api-session-controller` | |
| `uiSession` / `uiConversation` / `uiWorkspace` | UI domain services | respective packages | |
| `connection` | connection handle | `dsh-client-connection` | |
| `fileUpload` | upload service | `dsh-client-file-upload` | |
| `modules` | `ClientModuleSystem` | `dsh-client-modules` | internal |
| `loader` | cordis loader | core | internal |
| `resources` | resource service | `dsh-client-resources` | |
| `inputTriggers` | input trigger registry | `dsh-client-ui-input-trigger` | |
| `commandUi`, `sidebarRight`, `sidebarRightTabs`, `documentPreviews`, `modelDirectories`, `dynamicCordisRunner`, `cordisInspect`, `sessionLogDownload`, `sessionFeedback` | domain services | respective packages | |

`remote.*` are sub-namespaces of the one `remote` service, e.g.
`remote.settings`, `remote.credentials`, `remote.llm`, `remote.session`,
`remote.workspace`, `remote.pluginInventory`. The Host's context also declares
`ctx.settings` — that is the **Host-side** seam in `@deepseek-ai/dsh-settings`
(`RUNTIME/dsh-settings/lib/types/index.d.ts`), not available in the browser. See §7.

A plugin's runtime `inject` list is only a *service wait*; it is independent of
`dsh.client.inject` in package.json, which is only a **bundle-arrival ordering edge**
(`RUNTIME/dsh-client-modules/lib/client.js:253-268`, `arriveGraphRow`:

```js
async arriveGraphRow(row, open = [], visited = new Set()) {
  ...
  for (const packageName of row.inject ?? []) {
    const dependency = this.graphRows.get(packageName);
    if (dependency !== void 0) await this.arriveGraphRow(dependency, [], visited);
  }
```

). `dsh.client.inject` entries naming no installed row are silently skipped — which is
why the marketplace can list the non-existent `@deepseek-ai/dsh-client-runtime`
(`PROFILE/node_modules/dsh-plugin-marketplace/package.json`) with no error. Our project's
`package.json` currently lists `@deepseek-ai/dsh-client-ui-settings` and
`...-models` there; both exist as rows, so those edges are real and harmless.

### 3.3 Component props produced by the framework (not inject names)

Every slot component receives the four-share intersection
(`PROJ/.../dsh-client-ui-slots/lib/types/index.d.ts:385`):

```ts
export type ComposedProps<K, EntryKey, S, H, I, M = never, N = undefined> =
    PropsRuntime<K, EntryKey> & PropsRenderSlots<S> & PropsStore<H>
  & InjectFace<I> & MatchedShare<SlotMap[K], M> & PropsLocale<N>;
```

Runtime order at `RUNTIME/dsh-client-ui-renderer/lib/client.js`, `renderEntry`:

```js
return (0, react_jsx_runtime.jsx)(Comp, { ...kit, ...injected, ...slotInjected.props, ...ownerProps });
```

- `kit` = standard props (`useResource`, `useWorkspaces`, `usePanelInfo`, `useSessions`,
  `useSessionPendingInteraction` for root scope; plus session hooks for session scope),
  plus `t` when `locale:` was declared, plus `useStore`/`actions` when `store:` was
  declared, plus `renderSlot`/`renderSlotChain`/`SessionProvider` when `children:` was
  declared.
- `injected` = the registrant's own `inject:` factory return (with `hooks` bound to
  `use<Name>` hooks).
- `slotInjected.props` = the slot-level inject face declared by the parent.
- `ownerProps` = whatever the owner passed to `renderSlot` (owner wins on collision).

---

## 4. `ctx.slots` — the full API

### 4.1 The service

`RUNTIME/dsh-client-ui-renderer/lib/client.js:995` — `super(ctx, "slots");` inside
`class SlotRegistry extends Service`. Type surface:
`PROJ/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/types/index.d.ts` (`SlotCore`)
and `RUNTIME/dsh-client-ui-renderer/lib/types/client/registry.d.ts` (`SlotRegistry`).

| Method | Signature (from `registry.d.ts`) |
|---|---|
| `register(options, Component)` | `SlotCore['register']` — prototype method so `ctx.effect` binds to the caller's fiber (`registry.d.ts:84`) |
| `inject(key, callback)` | `(key: keyof SlotMap & string, callback: () => (() => void) \| Iterable<() => void>) => () => void` (`registry.d.ts:100`) |
| `install(renderer)` | boot-once (`:107`) |
| `installLocale(face)` | boot-once (`:115`) |
| `provideRoot(contribution)` | `(c: RootStandardSourceContribution) => () => void` (`:122`) |
| `installScope(scope, adapter)` | `:129` |
| `bindStoreScope(binding)` | `:139` |
| `renderSlot(key, owner)` | shell-only; `key` must be `'root'` (`:148`) |
| `entries(key)` | `readonly StoredEntry[]` (`:154`) |
| `entriesOfSlot(key)` | winners per cell (`:164`) |
| `snapshot(root?)` | `LiveSlotNode[]` (`:170`) |
| `onEntryError(fn)` | `:182` |
| `spec(key)` | `:190` |
| `subscribe(key, fn)` | `:197` |
| `getVersion(key)` | `:203` |

`register` returns an **idempotent disposer**; it is wrapped in the caller's effect, so
fiber unload cascades automatically (`client.js`, `SlotRegistry.prototype.register`,
line 1388):

```js
SlotRegistry.prototype.register = function register(rawOptions, component) {
  const options = rawOptions;
  return this.ctx.effect(() => this["_register"](options, component), "slots.register()");
};
```

### 4.2 `register(options, Component)` — every option field

Runtime validation lives in `SlotCore.register` (`DIST:56`, `var Vc=class{...}`), which is
byte-identical in structure to the typed overloads at
`PROJ/.../dsh-client-ui-slots/lib/types/index.d.ts:591` and `:604`. The option object is:

| Field | Required | Type | Meaning |
|---|---|---|---|
| `name` | **yes** | `keyof SlotMap & string` | target slot key |
| `id` | list only | `string` | cell key ("Your cell key"; same id + same priority throws) |
| `key` | keyed only | `string` | cell key dispatched by the owner's `renderSlot(..., {entryKey})` |
| `order` | list only (opt) | `number` | ascending display position, default 0 |
| `label` | list only (opt) | `string \| (() => string)` | display text; thunks re-read per projection (locale-safe) |
| `priority` | opt | `number` | shadowing rank, ascending, default 0, **lowest renders** |
| `select` | chain only | `(owner) => unknown \| null` | pure routing selector |
| `locale` | opt | namespace key | declares this entry's copy namespace → injects `t` |
| `inject` | opt | `(...args) => object` | registrant business face; args derive from scope+store |
| `children` | opt | `ChildrenDecl` | declares (and authorizes rendering) child slots |
| `store` | opt | handle or factory | store seat (see §4.6) |
| `registrant` | opt | `string` | diagnostics label; the Service wrapper stamps the caller's fiber name |

Exact runtime errors from `DIST:56` (verbatim):

```js
if(!i?.spec)throw new Error(`slot "${t.name}" is not declared (a parent entry's children table must declare it)`);
...
case"keyed":{ if(t.key===void 0)throw new Error(`keyed slot "${t.name}" requires options.key`); ...
case"list":{ if(t.id===void 0)throw new Error(`list slot "${t.name}" requires options.id`); ...
case"chain": if(t.select===void 0)throw new Error(`chain slot "${t.name}" requires options.select`); ...
if(t.children)for(const m of Object.keys(t.children)){ ... throw new Error(`slot "${m}" is already declared (by ...)`) }
```

Kind semantics (`index.d.ts:569-579`): single/keyed/list entries **shadow** by cell —
same cell at distinct priorities coexist and the lowest live one renders; a second
registration at the *same* priority throws naming the occupant. Chain entries are all
consumed by election.

Recorded entry shape (`index.d.ts:464-485`, `StoredEntry`) plus `select`, `inject`,
`children`, `store`, `locale`, `registrant`.

### 4.3 `children` — declaring slots (used by slot *owners*, not by leaf plugins)

Example, `RUNTIME/dsh-client-ui-layout/lib/client.js` (`apply`):

```js
const disposeRegistration = ctx.slots.register({
  name: "root",
  locale: "common",
  children: {
    "sidebar":       { kind: "single", scope: "root" },
    "main":          { kind: "keyed",  scope: "root" },
    "rightbar":      { kind: "single", scope: "root" },
    "shell.overlay": { kind: "list",   scope: "root" }
  },
  store
}, AppFrame);
```

Declaring claims: the declaring entry is the only one allowed to render those keys; the
declaration collapses on disposal. `SlotSpec` = `{ kind, scope, inject? }`
(`index.d.ts:119-130`). The component must consume `renderSlot` (`RendersCheck`,
`index.d.ts:436-440`).

### 4.4 `inject(key, callback)` — wait for a declaration

`RUNTIME/dsh-client-ui-renderer/lib/client.js`, `inject(key, callback)`. Behaviour
(from its own JSDoc and code): if the slot is already declared the callback runs
**synchronously**; otherwise it runs inside the declaring `register()` call after the
declaration commits. Collapse disposes the effect and a later declaration runs it again.
The controller belongs to the caller's fiber. This is the pattern every leaf plugin uses
(`RUNTIME/dsh-client-locale/lib/client.js:1399-1406`, and the marketplace):

```js
ctx.slots.inject("settings.section", function () {
  return ctx.slots.register({ name: "settings.section", id: "dsh-plugin-marketplace",
                              order: 30, locale: NS, label: function(){ return t("sectionLabel"); } },
                            MarketplaceSection);
});
```

> **PITFALL — `register({ name })` is the target SLOT KEY, not a label for your
> registration.** Confirmed in the registry's own typing,
> `RUNTIME/dsh-client-ui-slots/lib/types/index.d.ts` (`BaseOptions`):
> `/** Target slot key (the entry contributes INTO this slot). */ name: K`.
> `SlotCore.register` resolves it against its declaration table and throws
> `registering into an undeclared slot` on a miss — at **load** time, from inside
> the `inject` callback, so the whole client half fails to materialise. Every real
> call site passes the key verbatim (`name: "settings.section"`,
> `name: "settings.general.item"`, `name: "root"`). A descriptive value such as
> `"my-plugin:provider-card"` reads like a name and is a defect.
>
> The entry's own identity rides the kind-shape fields, all core-validated:
> keyed → `key`; list → `id` (+ optional `order`, `label`); chain → `select`.
> Every kind also accepts `priority` (cell shadowing rank, ascending, lowest
> renders; a second registration at an occupied cell's exact priority throws
> naming the occupant), `registrant` (diagnostics label), `children`, `store`,
> `locale`, and `inject`.
>
> `label` may be a plain string **or a thunk re-read per projection**
> (`SlotLabel = string | (() => string)`, resolved by `resolveSlotLabel`) — the
> in-box settings sections pass `label: () => ctx.locale.bind(NS)("nav")`, which
> is what makes a nav row follow a language switch without re-registration.
>
> **PITFALL — declaring `locale: NS` is not free.** It makes the renderer
> synthesize the `t` prop through `LocaleNamespaceMap`, the compile-time table
> merged by dictionary owners; a namespace outside that table has no typed seat,
> and the synthesis "fails loud" when no locale face is installed. This plugin
> binds its namespace against the locale service directly
> (`ctx.locale.bind(NS)`) and subscribes to the service revision, which yields
> the same function with neither coupling.

### 4.5 Keyed slots: `entryKey` is a dispatch selector, NOT a delivered prop

Owner dispatch site (`RUNTIME/dsh-client-ui-settings-models/lib/client.js`, three call
sites, e.g. `renderSlot("settings.models.provider-card", { provider: row.entry,
configured: row.configured, keyConfigured: keyConfiguredOf(row) },
{ entryKey: row.entry.settingsNs })`).

Renderer lookup (`RUNTIME/dsh-client-ui-renderer/lib/client.js`):

```js
if (spec.kind === "keyed") {
  const entry = host.entriesOfSlot(slotKey).find((e) => e.options.key === opts?.entryKey);
  if (!entry) return entries.some((e) => e.options.key === opts?.entryKey) ? deadCell() : <>{opts?.fallback ?? null}</>;
  return guarded(entry, entryKeyOf(entry));
}
```

`entryKeyOf` (line ~19162) is a **React remount key only**:

```js
let nextEntryKey = 0; const entryKeys = new WeakMap();
function entryKeyOf(entry) { let key = entryKeys.get(entry); if (key === void 0) { key = nextEntryKey++; entryKeys.set(entry, key); } return key; }
```

`guarded(entry, key, owner = ownerProps)` passes `ownerProps` unchanged; `renderEntry`
spreads `kit/injected/slotInjected/ownerProps` — **`entryKey` is never added as a prop**.
The typed API agrees: `RenderOpts.entryKey` is an *input* only
(`index.d.ts:201-208`), and `PropsRuntime` contains no `entryKey`
(`index.d.ts:199`). A keyed registrant learns which cell it is serving from the **owner
props** the owner chose to pass (e.g. `ProviderCardExtrasOwnerProps.provider`, whose
`settingsNs` is what the owner keys on).

`KeyPropsOf` (`index.d.ts:150-153`) is the *optional* mechanism for per-key owner props
(declared as `keyProps?: Record<string, object>` on the SlotMap entry, `index.d.ts:99`);
the shipped `settings.models.provider-card` does not use it (`keyProps` is absent from
its `SlotEntryDef`), so its owner props are the same for every key.

### 4.6 Store seat (`store:`) and diagnostics

`SlotRegistry._register` (`RUNTIME/dsh-client-ui-renderer/lib/client.js`):

```js
_register(options, component) {
  const store = typeof options.store === "function" ? options.store() : options.store;
  const registrant = options.registrant ?? this.ctx.fiber?.name;
  const erased = { ...options, ...store !== void 0 ? { store } : {}, ...registrant !== void 0 ? { registrant } : {} };
  const dispose = this._core.register(erased, component);
  if (store !== void 0) { const scope = this._core.specDynamic(options.name).scope; this._acquire(store, scope); }
  ...
}
```

So a **factory** (`store: createXxxStore`) is minted once per entry; a **handle**
(`store`) is shared by identity across registrations and mounted on the scope axis.
The component then receives `useStore(state => …)` plus the baked `actions`.

Store contract (`PROJ/node_modules/@deepseek-ai/dsh-client-store/lib/types/`):

```ts
export declare function defineStore<T, A extends ActionsDecl<T>>(decl: StoreSpec<T, A> & { actions: A & ActionsDecl<T> }): EngineStoreHandle<T, A>;
export declare function createSnapshotStore<T>(init: T, opts?: { flush?: 'raf'|'sync'; persist?: { name: string } }): SnapshotStore<T>;
export interface EngineStoreHandle<T, A> extends StoreHandle<T, A> { create(scopeKey?: string): EngineStoreInstance<T, A>; }
```

Real usage — `RUNTIME/dsh-client-locale/lib/client.js:1380-1406`:
`const store = createLanguageRowStore();` then
`ctx.slots.register({ name: "settings.general.item", id: "language", order: 0, store,
locale: SETTINGS_NS, inject: injected }, LanguageRow)`. Its store declaration is
`PROJ/.../dsh-client-locale/lib/types/client/settings-store.d.ts`:
`createLanguageRowStore(): EngineStoreHandle<LanguageRowState, LanguageRowActions>`.

`host.call(...)` mentioned in some slot docs is **not** a slot-component API: it belongs
to the dynamic cordis runner sandbox
(`RUNTIME/dsh-cordis-client-runner/lib/client.js:54-68`). Prebuilt plugins use
`ctx.remote` / `ctx.settingsScope`.

---

## 5. Every declared slot in this DSH build

Source: `RUNTIME/dsh-cordis-client-runner/lib/client.js:2201` — `const CLIENT_SLOT_API = [...]`,
the generated catalogue (`dsh-cordis-client-runner/lib/types/client/slot-catalog.d.ts`
says "Generated by scripts/gen-client-catalog.ts"). Extracted as pure data: **61 keys**.
`kind` / `scope` / replace risk:

```
conversation.approval.detail                 single  session        shadows-shipped-ui
conversation.chat.assistant-actions          list    session        none
conversation.chat.commandview                keyed   session        none
conversation.chat.node                       keyed   session        shadows-shipped-ui
conversation.chat.turnTail                   chain   session        none
conversation.composer                        chain   session        none
conversation.composer.bar                    single  session-maybe  shadows-shipped-ui
conversation.composer.dock                   list    session        none
conversation.hero.agentPreset                single  root           shadows-shipped-ui
conversation.hero.brand.mark                 single  root           none
conversation.hero.workspace                  single  root           shadows-shipped-ui
conversation.hero.workspace.directoryFlow    single  root           shadows-shipped-ui
conversation.input.attachments               single  session-maybe  shadows-shipped-ui
conversation.input.dock                      list    session        none
conversation.input.left                      list    session        none
conversation.input.model                     single  session        shadows-shipped-ui
conversation.input.overlay                   list    session        none
conversation.input.plan                      single  session        shadows-shipped-ui
conversation.input.right                     list    session        none
conversation.message.images                  single  session        shadows-shipped-ui
conversation.session                         single  session        shadows-shipped-ui
conversation.session.header                  single  session        shadows-shipped-ui
conversation.session.header.actions          list    session        none
conversation.session.header.corner           single  session        shadows-shipped-ui
conversation.session.header.lineage          single  session        shadows-shipped-ui
conversation.session.header.utilities        list    session        none
conversation.trajectory.images               single  session        shadows-shipped-ui
conversation.view                            list    session        none
main                                         keyed   root           shadows-shipped-ui
main.conversation                            single  session-maybe  shadows-shipped-ui
rightbar                                     single  root           shadows-shipped-ui
rightbar.session                             single  session        shadows-shipped-ui
root                                         single  root           shadows-shipped-ui
settings.action                              list    root           none
settings.close                               single  root           shadows-shipped-ui
settings.general.item                        list    root           none
settings.header                              single  root           shadows-shipped-ui
settings.models.footer                       list    root           none
settings.models.provider-card                keyed   root           none
settings.onboarding                          list    root           none
settings.plugin.item                         keyed   root           none
settings.plugins.tab                         list    root           none
settings.section                             list    root           none
settings.trigger                             single  root           shadows-shipped-ui
shell.overlay                                list    root           none
sidebar                                      single  root           shadows-shipped-ui
sidebar.brand.mark                           single  root           shadows-shipped-ui
sidebar.brand.name                           single  root           shadows-shipped-ui
sidebar.footer.action                        list    root           none
sidebar.panellist                            list    root           none
sidebar.right.pane.tab                       keyed   session        none
sidebar.right.pane.tab.title                 keyed   session        none
sidebar.right.tab.document                   keyed   session        none
sidebar.right.tab.guide                      chain   session        none
sidebar.right.tab.menu.item                  list    session        none
sidebar.settings                             single  root           shadows-shipped-ui
sidebar.workspaces                           single  root           shadows-shipped-ui
sidebar.workspaces.directoryFlow             single  root           shadows-shipped-ui
tool.call.images                             single  session        shadows-shipped-ui
tool.call.toolview                           keyed   session        shadows-shipped-ui
tool.view.cordis                             keyed   session        none
```

Note `settings.general.item` is declared at runtime by ui-settings-general but **typed in
the locale package** (`RUNTIME/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:80-84`).

### 5.1 `settings.section` (the marketplace's seat)

- kind `list`, scope `root`, replace risk `none`
- declared by: *"an entry in 'sidebar.settings' (client-ui-settings-general), so it exists
  while that entry is mounted"*
- register options: `id` (required, string), `order` (optional, number),
  `label` (optional, `string | (() => string)`)
- owner props: `SettingsSectionOwnerProps { close: () => void }`
- occupants: `agent-presets`, `general`, `models`, `plugins`
- canonical example (verbatim from the catalogue):

```js
return {
  inject: ['slots'],
  apply(ctx) {
    ctx.slots.inject('settings.section', () => ctx.slots.register(
      { name: 'settings.section', id: 'my-entry', order: 100, label: 'My entry' },
      () => React.createElement('div', null, 'hello'),
    ))
  },
}
```

### 5.2 `settings.models.footer`

- kind `list`, scope `root`, replace risk `none`, **no occupants**
- declared by: *"an entry in 'settings.section' (client-ui-settings-models)"*, i.e. it
  exists while the Models section entry is mounted and lives only inside the Models tab
- register options: `id`, `order?`, `label?`
- owner props: `ModelsFooterOwnerProps { children?: never }` — **the section passes
  nothing**; the component reads and writes everything through its own services

### 5.3 `settings.models.provider-card`

- kind `keyed`, scope `root`, replace risk `none`, **no occupants**
- declared by: same Models section entry
- register options: `key` (required, string); key domain:
  *"open: any string the owner dispatches (no compile-time key set), none are taken yet"*
- dispatch: `entryKey = settingsNs` (the row's owning settings namespace) on every card
  that renders a directory row — saved rows and the add-provider draft card; the
  hand-declared draft card dispatches nothing until saved
- owner props (verbatim):

```ts
export interface ProviderCardExtrasOwnerProps {
  provider: ProviderDirectoryEntry   // route id, display name, settings address, live state
  configured: boolean                // any layer configures this provider (profile resolves)
  keyConfigured: boolean             // the row's referenced api-key credential is confirmed configured
}
```

- `ProviderDirectoryEntry` comes from `ROUTINE/dsh-client-ui-settings-models/lib/types/client/store.d.ts`;
  refs are listed but deliberately not expanded in the catalogue
  (`slot-catalog.d.ts:42-43`).

Other settings-domain slots: `settings.action`, `settings.close`, `settings.header`,
`settings.onboarding`, `settings.plugin.item` (keyed by settings namespace),
`settings.plugins.tab`, `settings.trigger`, `settings.general.item`
(declarations in `RUNTIME/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts`).

---

## 6. `ctx.locale` — API and re-render mechanics

Service class `LocaleRuntime`, provided by
`RUNTIME/dsh-client-locale/lib/client.js:1378` (`ctx.provide("locale", locale);`).
Types: `PROJ/node_modules/@deepseek-ai/dsh-client-locale/lib/types/client/index.d.ts`.

| Method | Signature |
|---|---|
| `getLocale()` | `() => LocaleSnapshot` = `{ active: LocaleId; locales: readonly LocaleDefinition[]; revision: number }` (`:119`) |
| `getSnapshot()` | same, the `LocaleFace` observable side (`:125`) |
| `subscribe(fn)` | `() => () => void` — fires on locale switch **and** on dictionary registration (`:133`) |
| `setLocale(id)` | `void`; unknown ids throw; the only user-preference write (`:146`) |
| `addLanguage(input)` | `{ id, label, fallback } => () => void` (`:159`) |
| `register(ns, {zh, en})` | typed: `Record<BuiltInLocaleId, LocaleDictOf<N>> => () => void` (`:188`) |
| `register(ns, locale, dict)` | untyped single-locale form (`:198`) |
| `bind(ns)` | typed overload `TranslateNS<N>`; untyped overload `Translate`; **stable identity per namespace** (`:208`, `:215`) |

`Translate<K> = (key: K, params?: Record<string, unknown>) => string`
(`dsh-client-ui-slots/lib/types/index.d.ts:42`). Lookup walks the active language's
fallback chain in the namespace, then repeats in `common`, then shows the key.

The marketplace uses the defensive untyped path
(`PROFILE/.../dsh-plugin-marketplace/lib/client-src/07-entry.fragment:5-20`):

```js
var dispose = ctx.locale.register(NS, { zh: DICT_ZH, en: DICT_EN });
if (typeof ctx.effect === "function") ctx.effect(() => dispose, "dsh-plugin-marketplace: dictionaries");
try { t = ctx.locale.bind(NS); } catch (e) { /* 保持回退翻译 */ }
langCurrent = ctx.locale.getLocale().active || langCurrent;
if (typeof ctx.locale.subscribe === "function") { ctx.locale.subscribe(function () { ... notifyLocaleChange(); }); }
```

Note: `register(ns, {zh, en})` requires **both** built-in locales when going through the
typed overload (bilingual balance enforced at registration).

### How a component actually re-renders on language switch

Three mechanisms exist; the *canonical* one is the framework `t` seat:

1. **Declared `locale:` + framework `t` seat (recommended).** Register with
   `locale: "<ns>"`; `standardKit` injects `t`:

   ```js
   if (entry.locale !== void 0) {
     const face = host.locale;
     if (face === void 0) throw new SlotAssemblyError(`entry declares locale namespace '${entry.locale}' but no locale face is installed ...`);
     kit["t"] = localeSeat(face, entry.locale);
   }
   ```

   and `SlotOutlet` subscribes to the locale revision:

   ```js
   function SlotOutlet({ slotKey, ownerProps, opts }) {
     const host = useHost();
     useSyncExternalStore((fn) => host.subscribe(slotKey, fn), () => host.getVersion(slotKey));
     useLocaleRevision(host.locale);
     ...
   ```

   `LocaleFace` (`dsh-client-ui-slots/lib/types/renderer.d.ts:19-31`) = `getSnapshot()`
   of `{revision}` + `subscribe` + `bind(ns)`. The renderer re-derives each entry's `t`
   from `(namespace, revision)`, so a switch hands out new references and memoized
   components re-render naturally. The locale plugin installs the face via
   `ctx.slots.installLocale(locale)` (`dsh-client-locale/lib/client.js:1379`) — so
   `slots` must be injected for `t` to work, and `locale` must be injected to reach
   the service in `apply`.
2. **`label: () => string`** on list entries — the owner resolves it per projection with
   `resolveSlotLabel` (`dsh-client-ui-slots/lib/types/index.d.ts:493`), so nav/tab text
   follows the locale without re-registering.
3. **Manual** `ctx.locale.subscribe(...)` + your own store (`ctx.effect(() => …)`) when
   you hold texts outside a slot component.

---

## 7. Client-side settings: there is **no** `ctx.settings` in the browser — it is `ctx.settingsScope`

`RUNTIME/dsh-settings/lib/types/index.d.ts` declares `settings` on the Cordis Context,
but `@deepseek-ai/dsh-settings` is a Host-only package with no `dsh.client` declaration
and no `lib/client.js`. The browser service is:

**`ctx.settingsScope: SettingsScopeBinder`**, provided by
`@deepseek-ai/dsh-client-ui-settings/client` (`RUNTIME/dsh-client-ui-settings/lib/client.js:1333`
— `const inject = ["remote", "remote.settings"];`).

### 7.1 Binder API

`RUNTIME/dsh-client-ui-settings/lib/types/client/settings-scope.d.ts:100-140`:

```ts
export declare class SettingsScopeBinder extends Service {
    describe(): SettingsDescribeFace;
    bind<T>(spec: SettingsScopeSpec<T>): SettingsScope<T>;
}
```

`bind` runs on the **caller's fiber** (the scope's disposer belongs to the caller), and
reads come from the shared `settings.describe` mirror — binding does not perform a wire
read of its own.

```ts
export interface SettingsScopeSpec<T> { namespace: string; decode?: (section: unknown) => T | undefined; }
```

### 7.2 Scope API — read AND write, with revisions

`RUNTIME/dsh-client-ui-settings/lib/types/client/settings-contract.d.ts:50-85`:

```ts
export interface SettingsScope<T> {
    getSnapshot(): SettingsScopeSnapshot<T>;
    subscribe(listener: () => void): () => void;
    mutate(ops: readonly SettingsPathOpView[], expectedRevision?: number): Promise<void>;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}
```

```ts
export interface SettingsScopeSnapshot<T> {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;     // last accepted schema-resolved section
    base: unknown;            // composition layer
    user: unknown;            // raw user layer; presence marks a field overridden
    revision: number | undefined;   // namespace revision fencing the next write
    writable: boolean;        // false in memory mode
    mode: 'host' | 'memory';
}
```

Controller semantics (`settings-scope.d.ts:20-86`): writes are **serialized** (a queue
with a tail), each carries the latest known namespace revision, answers fold back into
the mirror, only the latest settlement publishes, and a rejected/failed latest write
triggers a Host reload instead.

### 7.3 The wire underneath

`remote.settings` (from `@deepseek-ai/dsh-api-settings-controller/remote`), generated
contract `RUNTIME/dsh-api-settings-controller/lib/typert.remote-client.d.ts:17-25`:

```ts
describe: () => Promise<RemoteResult<SettingsDescribeValue>>
mutate:   (ns: string, ops: SettingsPathOpView[], expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
update:   (ns: string, patch: Record<string, JsonValue>, expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
replace:  (ns: string, section: Record<string, JsonValue>, expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
```

`SettingsPathOpView` (`RUNTIME/dsh-settings/lib/types/types.d.ts:55-62`):

```ts
export type SettingsPathOpView =
  | { op: 'set';   path: string[]; value: JsonValue }
  | { op: 'unset'; path: string[] };
```

`SettingsNamespaceView.revision` = "Monotonic revision of the raw user section this view
was read at. Send it back as `expectedRevision` on a write so a stale editor is refused
rather than silently overwriting a concurrent change"
(`dsh-settings/lib/types/types.d.ts:44-50`). Refusals are typed:
`settings/conflict` (`{ns, expected, actual}`) and `settings/rejected` (`{ns}`)
(`RUNTIME/dsh-api-settings-controller/lib/types/types.d.ts:15-25`).

**Answer: yes, a client-side settings mutation API exists** — `ctx.settingsScope.bind({namespace})`
then `scope.set/unset/mutate(...)`, revision-fenced, over `remote.settings`.

### 7.4 Also available: `settingsSchema`

`ctx.settingsSchema: SettingsSchemaService` (`inject: "settingsSchema"`), provided by the
same package (`dsh-client-ui-settings/lib/types/client/schema.d.ts`); `ui-settings-models`
and `ui-permission-presets` inject it to render schema-driven editors. Source of the
schema is `SettingsNamespaceView.schema` (a serialized schemastery envelope).

---

## 8. How a plugin is built into the `window.__ModuleLoader__.load` format

### 8.1 The exact wrapper

Every shipped bundle and the marketplace bundle use the same shape
(`RUNTIME/dsh-client-locale/lib/client.js:1-6`):

```js
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-locale",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		... // whole bundle body, lazily
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
```

Hard requirements:

1. **`id` must equal the npm package name** (it is the module-table key; `arrive()`
   throws ``bundle <url> loaded without registering "<id>" via __ModuleLoader__.load``,
   `lib/client.js:248`).
2. It must be a **classic script**, not an ES module: the default transport is
   `document.createElement("script"); el.async = true; el.src = url;` with no `type`
   (`lib/client.js:147-149`).
3. The whole body must live **inside** `factory` — module-body side effects (including
   CSS injection) run at materialization, not at script execution
   (`dsh-client-modules/README.md:57-61`).
4. `factory` receives a **synchronous** `require`; `require` cycles throw
   (``require cycle through "<id>" (factory-form CJS cannot deliver partial exports)``,
   `lib/client.js:278`).
5. The source map is an **external** `client.js.map` referenced by an absolute
   `/plugins/<id>/client.js.map` URL added by the combo builder; a missing/invalid map is
   tolerated (`sourceMapSnapshot` returns `undefined`; `readSourceMapSnapshot` logs and
   continues). `sourceMappingURL` and `sourceURL` trailers are stripped before combo
   assembly (`lib/index.js`, `comboSource`).
6. `package.json` must expose `exports["./client"]` as a string or `{default: string}`,
   or activation throws `client-modules: <pkg> declares dsh.client but exports no
   "./client" bundle` (`lib/index.js:156-166`, `:654-656`).

### 8.2 externals: which requires stay external

Every specifier outside the seed table (`§1.2`) must stay **unbundled** and be emitted as
`require(...)`, and must be listed in `dsh.client.external`. Practically, for this
project the external set is exactly:

```
react
react/jsx-runtime
react-dom
react-dom/client
@deepseek-ai/cordis
@deepseek-ai/dsh-client-store
@deepseek-ai/dsh-client-ui-slots
@deepseek-ai/dsh-client-ui-primitives
@deepseek-ai/dsh-client-ui-dockkit
```

(You only need the ones you import.) Everything else — including any helper library —
must be bundled in.

### 8.3 The official build preset is NOT published

- `RUNTIME/dsh-client-ui-settings-plugins/lib/types` README (line 96, verbatim):
  *"the browser half must be a `dsh.client` package built in the client module system's
  lazy-CJS factory format, and the `clientBundle` preset that emits it lives in
  `../../../packages/client/tsdown.client.ts` rather than a published package, so a plugin
  outside this repository has to reproduce that build itself."*
- Same pointer from `RUNTIME/dsh-client-ui-settings/lib/client.js:1122-1124`.
- `RUNTIME/dsh-api-remotes/README.md:56` names the API: `clientBundle(..., { hostPhase: true })`.
- **NOT FOUND** on this machine: any file named `tsdown.client.ts`, `clientBundle`, or
  `PLATFORM_MODULES` outside the inlined `DIST` seed map and the two README quotes above.
  Searched: all of `RUNTIME`, all of `PROFILE`, `PROJ/node_modules`. `tsdown` is not
  installed anywhere (`RUNTIME/.bin` has no `tsdown`; no `tsdown` directory).
- Consequently a plugin must reproduce the wrapper itself. Two viable routes:
  - **esbuild (already a devDependency of this project)**: `format: 'iife'`, `bundle: true`,
    `external: [<seed list>]`, `jsx: 'automatic'` → then post-wrap the output in the
    `window.__ModuleLoader__.load({id, factory: (require) => { var module={exports:{}}; var exports=module.exports; <body>; return module.exports; }})`
    envelope, mapping the bundler's ESM/CJS require calls onto the injected `require`.
  - **the marketplace's route** (deterministic fragments + `scripts/assemble-client.mjs`,
    `PROFILE/.../docs/CODING_STANDARDS.md:9-11`), explicitly called out as that project's
    own exception, not the official pattern.

### 8.4 Is JSX precompiled? Yes

The shell ships React and `react/jsx-runtime` as seed words; no transform runs in the
browser. Shipped bundles contain compiled calls
(`RUNTIME/dsh-client-ui-settings-models/lib/client.js:6`:
`let react_jsx_runtime = require("react/jsx-runtime");`, then
`react_jsx_runtime.jsx(...)` throughout). So the build must compile JSX with the
**automatic runtime** (classic `React.createElement` also works — the marketplace does
that by hand) and leave `react/jsx-runtime` external.

### 8.5 The `dsh` CLI does not build anything

`RUNTIME/dsh/lib/plugin-Ddi42qoW.js` (whole file, 130 lines) is a **thin pnpm
forwarder**:

```js
const result = spawnSync("pnpm", args.map((argument) => anchorPathSpec(argument, process.cwd())), {
  cwd: dir, stdio: "inherit", shell: process.platform === "win32"
});
```

It then reconciles `dsh.profile.bundles` against installed state via
`exportsPatch()` (a dependency counts as a bundle layer when its manifest declares
`dsh.bundle.patch`). There is **no** `dsh plugin build` and no client-bundle step. The
`dsh` CLI's other files (`bin.js`, `profile-boot-*.js`, `dump-config-*.js`) contain no
client-bundle tooling. Host-side bundles build with the package's own
`"bundle": "tsdown"` script; the client bundle must be committed/published.
The failure mode when it is missing is loud and actionable
(`lib/index.js:91`, `:94-104`; `MissingClientBundleError` → `ClientPackageCompositionError`):

```
client-modules: client bundle not found; run `pnpm run build` before launch:
  package: <pkg>
  path: <abs path>
```

### 8.6 How the package gets mounted (host side)

A plugin needs more than `dsh.client`: for the web profile it must be a **bundle layer**.
`PROFILE/node_modules/dsh-plugin-marketplace/cordis.patch.yml`:

```yaml
- insert:
    - id: plugin-marketplace
      name: dsh-plugin-marketplace
      inject: [webServer]
```

and its `package.json`:

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-settings"], "immediately": true }
}
```

`PROFILE/package.json` then lists it in `dsh.profile.bundles`. `PROJ/package.json` already
declares `dsh.client` with `"platform": "web"` and `exports["./client"]`, and ships
`cordis.patch.yml` in `files` — but it currently has **no `dsh.bundle.patch`
declaration**, so as-is it would install as "a plain dependency, not a profile layer"
(`plugin-Ddi42qoW.js` warning path). Worth flagging to the parent.

---

## 9. CSS

### 9.1 The official (build-generated) pattern

Every shipped bundle that owns CSS emits an idempotent style tag during materialization.
Verbatim, `RUNTIME/dsh-client-ui-open-in-app/lib/client.js`:

```js
//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-open-in-app/src/client/OpenInAppAction.module.css.mjs
const css = ".CAgGvG_split{...}";
const tagId = "@deepseek-ai/dsh-client-ui-open-in-app/OpenInAppAction.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-open-in-app";
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}
var OpenInAppAction_module_css_default = { "chevron": "CAgGvG_chevron", "icon": "CAgGvG_icon", ... };
//#endregion
```

So the preset turns each `*.module.css` into a virtual `.css.mjs` module that (a) injects
one `<style data-plugin="<pkg>" data-plugin-css="<pkg>/<file>.module.css">` and (b)
exports the hashed class-name map. This is why the shell can inventory and remove styles:

- Module system inventories them at materialization
  (`dsh-client-modules/lib/client.js:170-176`, `claimStyles`: untagged `<style>` elements
  are claimed for the materializing plugin, tagged ones read back via `data-plugin-css`).
- HMR removes them on invalidation (`RUNTIME/dsh-client-hmr/lib/client.js:53-55`):

  ```js
  /** Remove every `<style data-plugin>` tag owned by `id` ... */
  for (const el of document.querySelectorAll("style[data-plugin]")) if (el.getAttribute("data-plugin") === id) el.remove();
  ```

**Recommended for this project:** reproduce that convention in the build wrapper — ship
CSS as a JS string and inject `<style data-plugin="<pkg>" data-plugin-css="<pkg>/<file>">`
from inside `factory` (so it is lazy and HMR-removable), guarding against duplicates.

### 9.2 The marketplace's approach

`PROFILE/.../dsh-plugin-marketplace/lib/client.js`, `injectStyles()`, called first in
`apply` (fragment `07-entry.fragment:2`):

```js
function injectStyles() {
  var css = [ ... ].join("\n");
  var el = document.getElementById("dshm-styles");
  if (el) { el.textContent = css; return; }      // idempotent + HMR refresh
  el = document.createElement("style");
  el.id = "dshm-styles";
  el.textContent = css;
  document.head.appendChild(el);
}
```

Note it uses a plain `id`, **not** `data-plugin`/`data-plugin-css`. That is *not* the
official pattern; the tag is untagged, so the module system's `claimStyles` will stamp
`data-plugin="dsh-plugin-marketplace"` on it at materialization (thereby making HMR
cleanup work anyway) but `data-plugin-css` is absent, so per-file bookkeeping is coarser.
For a new plugin, prefer `data-plugin` + `data-plugin-css`.

The marketplace documents its own build as an explicit exception
(`PROFILE/.../docs/CODING_STANDARDS.md:9-11`, `docs/DEVELOPMENT.md:41-43`,
`README.md:325`): fragments `lib/client-src/*.fragment` concatenated by
`scripts/assemble-client.mjs` into the lane-committed `lib/client.js`; "禁止 TypeScript
依赖" — no TypeScript, no extra compiled artifacts.

---

## 10. Gaps / NOT FOUND

| Item | Status | What was searched |
|---|---|---|
| `packages/client/tsdown.client.ts` (official `clientBundle` preset) | **NOT FOUND** on this machine; referenced only in README prose | whole `RUNTIME`, whole `PROFILE`, `PROJ/node_modules`; `tsdown` binary absent |
| `PLATFORM_MODULES` as a named symbol | **NOT FOUND** — only the inlined `by()` seed map in `DIST:114` | grep of all `.js`/`.d.ts`/`.md` |
| Any runtime *allowlist object* beyond seed + graph — none exists; resolution is seed → memoized → factory | verified by reading `makeRequire`/`import` | `RUNTIME/dsh-client-modules/lib/client.js` |
| `@deepseek-ai/dsh-client-runtime` (listed in the marketplace's `dsh.client.inject`) | **does not exist**; silently ignored by graph composition (`RUNTIME/dsh-client-modules/lib/client.js:261-268`) | `RUNTIME`, `PROFILE` |
| `dsh-client-ui-slots` / `dsh-client-store` as published packages inside the DSH runtime | not present in `RUNTIME`; present in `PROJ/node_modules/@deepseek-ai/` (used for types) and inlined in `DIST` as `Ac`/`Hc` | directory listing |
| A published `dsh client`/build CLI command | **does not exist** — `dsh plugin` forwards to pnpm only | `RUNTIME/dsh/lib/*.js` |
| `ProviderDirectoryEntry` full field list | not expanded in the slot catalogue by design; it is declared in `RUNTIME/dsh-client-ui-settings-models/lib/types/client/store.d.ts` (read it there when implementing) | `slot-catalog.d.ts:42-43` |
| `dsh-client-ui-primitives` `.d.ts` | present in `PROJ/node_modules/@deepseek-ai/dsh-client-ui-primitives` — not enumerated here | — |
