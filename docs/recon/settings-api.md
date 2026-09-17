# DSH Settings API — Read-Only Reconnaissance

Scope: DSH `0.1.5-rc.2`, installed at
`/Users/guofeng/Library/Application Support/DeepSeek Harness Desk/runtime/dsh/0.1.5-rc.2/`.
No source code was created or modified. Every claim below cites an exact file and line.

## Path legend (all paths below are exact, abbreviated only for readability)

| Token | Absolute path |
|---|---|
| `PKGS` | `/Users/guofeng/Library/Application Support/DeepSeek Harness Desk/runtime/dsh/0.1.5-rc.2/node_modules/@deepseek-ai` |
| `PROFILE` | `/Users/guofeng/.dsh/profiles/web/node_modules` |
| `SETTINGS_YAML` | `/Users/guofeng/.dsh/settings.yaml` |

Machine: macOS (darwin), DSH 0.1.5-rc.2, profile `web`.

---

## 0. The live file `~/.dsh/settings.yaml`

`SETTINGS_YAML` is 1844 bytes, mode `0600`, last modified 2025-09-17 15:21.

**Top-level namespaces present (6):**

| Namespace | Live content summary | Registered by (owner) |
|---|---|---|
| `ui-onboarding` | `welcomeNoticeVersion: 2026-08-13.1` | client plane: `dsh-client-ui-settings-general` |
| `llm-deepseek` | `models: []`, full `retryPolicy` | `dsh-llm-deepseek` |
| `agent-default-model` | `provider: router`, `model: opencode.ai/deepseek-v4.1-flash` | `dsh-agent-default-model` |
| `llm-pi-ai` | `providers:` map (`deepseek-v4-flash`, `router`), each with `displayName`/`apiKeyEnv`/`api`/`baseURL`/`models`/`retryPolicy` | `dsh-llm-pi-ai` |
| `agent-loop` | `maxParallelToolCalls: 4` | `dsh-agent-loop` |
| `permission` | `defaultPreset: danger-full-access` | `dsh-permission-presets` |

**Secrets in the live file: none.** The only credential-adjacent keys are
`apiKeyEnv: DEEPSEEK_V4_FLASH_API_KEY` and `apiKeyEnv: ROUTER_API_KEY` — these are
*environment-variable names*, not secret values. Actual secret values live in
`/Users/guofeng/.dsh/.credentials.yaml` (not read). Had any literal secret been
present it would be shown as `<redacted>`.

Verbatim excerpt (`SETTINGS_YAML` lines 20–27, 40–44):

```yaml
llm-pi-ai:
  providers:
    deepseek-v4-flash:
      displayName: Ark
      apiKeyEnv: DEEPSEEK_V4_FLASH_API_KEY          # env var NAME, not a secret
      api: openai-responses
      baseURL: https://ark.cn-beijing.volces.com/api/coding/v3
```
```yaml
    router:
      displayName: Router
      apiKeyEnv: ROUTER_API_KEY                     # env var NAME, not a secret
      api: openai-responses
      baseURL: http://127.0.0.1:3456/v1
```

Notable: the file contains **two multi-line YAML comments** (lines 48–49 and 53–54).
They survive because the provider does leaf-level diffs on a comment-preserving
YAML `Document` (see §4).

---

## 1. Host-side `ctx.settings` — exact API surface

Service declaration: `PKGS/dsh-settings/lib/types/index.d.ts:111-115`

```ts
declare module '@deepseek-ai/cordis' {
    interface Context {
        settings: SettingsProvider;
    }
}
```

Class: `PKGS/dsh-settings/lib/index.js:223` → `var SettingsProvider = class extends Service`
(registered as service name `"settings"`: `PKGS/dsh-settings/lib/index.js:238`
`super(ctx, "settings")`).

### 1.1 Full method inventory (signatures verbatim from the `.d.ts`)

| Member | Signature | File:line | Notes |
|---|---|---|---|
| `register` | `register<const Namespace extends string, T>(ns, schema: z<T>, options?: SettingsRegisterOptions<T>): SettingsScope<T>` | `dsh-settings/lib/types/index.d.ts:216` | owner scope; fiber-scoped effect |
| `installSection` | `installSection<const Namespace extends string, T>(owner: Context, ns, schema: z<T>, entry: T, hooks: SettingsSectionHooks<T>): void` | `:228` | optional-service wiring |
| `describe` | `describe(options?: SettingsDescribeOptions): SettingsDescriptor[]` | `:236` | one descriptor per registered ns |
| `get` | `get<const Namespace extends string>(ns): unknown` | `:243` | resolved value or `undefined` |
| `update` | `update<const Namespace extends string>(ns, patch: object, expectedRevision?: number): Promise<void>` | `:256` | **deep merge** into the user layer |
| `replace` | `replace<const Namespace extends string>(ns, section: object, expectedRevision?: number): Promise<void>` | `:268` | wholesale user-section replace |
| `mutate` | `mutate<const Namespace extends string>(ns, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<void>` | `:282` | ordered `{op:'set'\|'unset', path}` edits |
| `documentPath` | `get documentPath(): string \| undefined` | `:186` | file providers only |
| `prepareDocument` | `prepareDocument(): Promise<string \| undefined>` | `:193` | materialize absent file for a native editor |
| `writable` | `abstract readonly writable: boolean` | `:178` | provider capability |
| `get` (private) | `private section(ns)` / `private resolve(...)` / `private write(...)` / `private bumpRevision(...)` / `private commit(...)` / `private emitDocumentUpdated(...)` | `:294,296,284,304,308,306` | not public |
| `load` / `persist` | `protected abstract load(): Promise<Record<string, unknown>>` / `protected abstract persist(ns, section): Promise<void>` | `:198,204` | **provider** hooks only |
| `publish` | `protected publish(doc, source?: SettingsUpdateSource): void` | `:292` | **provider** hook: push external doc |

**Deliberately NOT present:** `set`, `patch`, `delete`, `unset`, `watch` on the
provider, `subscribe`, `onChange`, `ifRevision`.

- There is **no `ctx.settings.set`**. `set` exists only as a `SettingsPathOp`
  variant and as a *client-side scope* method (`dsh-client-ui-settings`).
- There is **no `ctx.settings.watch`**. Watching exists on the **owner scope**
  returned by `register()` (`SettingsScope.watch`, `:96`) and as Cordis events
  `settings/updated` / `settings/document-updated`
  (`dsh-settings/lib/types/types.d.ts:89,101`).
- There is **no `delete`**. Removal is `mutate(ns, [{op:'unset', path}])` or
  `replace(ns, {})`.
- There is **no `ifRevision`**. The CAS parameter is positional
  `expectedRevision` (§2).

### 1.2 `SettingsScope<T>` (what a namespace owner gets from `register`)

`PKGS/dsh-settings/lib/types/index.d.ts:84-110`

```ts
export interface SettingsScope<T> {
    get(): T;
    watch(callback: (next: T, prev: T) => void | Promise<void>): () => void;
    update(patch: object): Promise<void>;
    replace(section: object): Promise<void>;
}
```

Implementation `PKGS/dsh-settings/lib/index.js:298-314`. **Critical nuance:**
`scope.update` / `scope.replace` are *unfenced* — they forward with no revision:

```js
// dsh-settings/lib/index.js:312-313
update: (patch) => this.update(parsedNs, patch),
replace: (section) => this.replace(parsedNs, section)
```

So **an owner using only its `SettingsScope` cannot express optimistic
concurrency.** Revision-safe writes require the flat provider API
(`ctx.settings.update(ns, patch, expectedRevision)`) plus a revision read from
`ctx.settings.describe()` (§2.4). There is **no `scope.mutate`** and **no
`scope.describe`** for a host plugin.

### 1.3 The `installSection` contract (optional-service pattern)

`PKGS/dsh-settings/lib/index.js:327-343`. Registers the namespace with `entry` as
`base`, publishes `scope.get()` through `hooks.setSource`, re-publishes `entry`
on detach (unless the consumer fiber is unloading), calls `hooks.onChange()` after
every commit. `SettingsSectionHooks` is declared at
`dsh-settings/lib/types/index.d.ts:315-334`:

```ts
export interface SettingsSectionHooks<T> {
    setSource(current: () => T): void;
    onChange(): void;
    validate?: (value: T) => void;
}
```

---

## 2. Revision semantics

### 2.1 Is there a counter? Where?

**Per-namespace, in-memory, monotonic, process-local.** It is *not* persisted and
*not* derived from file mtime/content hash.

Registration record initialization — `PKGS/dsh-settings/lib/index.js:284-293`:

```js
const registration = {
    ns: parsedNs,
    schema,
    base: options?.base,
    applies: options?.applies ?? "live",
    ...options?.validate === void 0 ? {} : { validate: options.validate },
    resolved: deepFreeze(this.resolve(schema, options?.base, this.section(parsedNs), options?.validate)),
    revision: 0,
    watchers: /* @__PURE__ */ new Set()
};
```

So `revision` starts at `0` on every process start, regardless of file content.

Increment rule (RAW section comparison, independent of the resolved-value check):

```js
// dsh-settings/lib/index.js:521-525
bumpRevision(registration, before, after) {
    if (deepEqualJson(before, after)) return;
    registration.revision += 1;
    this.emitDocumentUpdated(registration.ns, registration.revision);
}
```

`bumpRevision` is called from exactly two places:
- after a successful in-process write — `dsh-settings/lib/index.js:466`
- on every provider `publish` (external edit) — `dsh-settings/lib/index.js:497`

### 2.2 How is it exposed?

1. `describe()` descriptors — `PKGS/dsh-settings/lib/index.js:361-369`
   (`revision: registration.revision`); declared field at
   `dsh-settings/lib/types/index.d.ts:57-61`:
   > "Monotonic revision of the raw user section this descriptor was read at.
   > Send it back as `expectedRevision` on a write to refuse a stale one."
2. Event `settings/document-updated (ns, revision)` —
   `dsh-settings/lib/types/types.d.ts:101`, emitted from
   `dsh-settings/lib/index.js:527-547`.
3. Over the wire as `SettingsNamespaceView.revision` —
   `dsh-settings/lib/types/types.d.ts:43-48`, projected at
   `dsh-api-settings-controller/lib/index.js:287`.

### 2.3 Compare-and-swap on write — the actual check

There is no `ifRevision` option; the *third positional argument* is the fence.
`PKGS/dsh-settings/lib/index.js:443-472` (`write`, the single write path for
`update`/`replace`/`mutate`):

```js
write(ns, input, mode, expectedRevision) {
    const verb = mode === "merge" ? "update" : mode === "replace" ? "replace" : "mutate";
    const registration = this.registrations.get(ns);
    if (registration === void 0) throw new Error(`settings namespace "${ns}" is not registered`);
    if (this.isStopped()) throw new Error(`settings service is disposed: "${ns}" cannot be written`);
    if (!this.writable) throw new Error(`settings provider is read-only: "${ns}" cannot be updated in-process`);
    let payload;
    if (mode === "mutate") payload = { ops: input };
    else {
        if (!isPlainObject(input)) throw new TypeError(`settings ${verb} for "${ns}" must be a plain object`);
        payload = input;
    }
    const snapshot = cloneJsonShaped(payload, (label, path) => new TypeError(
        `settings ${verb} for "${ns}" must contain only JSON-compatible data (found ${label} at ${path})`));
    const run = (this.writeQueues.get(ns) ?? Promise.resolve()).catch(() => void 0).then(async () => {
        if (this.isStopped()) throw new Error(`settings service was disposed before the queued "${ns}" ${verb} ran`);
        if (this.registrations.get(ns) !== registration) throw new Error(
            `settings namespace "${ns}" registration was disposed before the queued ${verb} ran`);
        const current = this.section(ns) ?? {};
        if (expectedRevision !== void 0 && expectedRevision !== registration.revision)
            throw new SettingsConflictError(ns, expectedRevision, registration.revision);
        const section = mode === "merge" ? mergeLayers(current, snapshot)
            : mode === "replace" ? snapshot
            : snapshot["ops"].reduce(applyPathOp, current);
        const next = deepFreeze(this.resolve(registration.schema, registration.base, section, registration.validate));
        await this.persist(ns, section);
        this.document[ns] = section;
        if (this.registrations.get(ns) === registration && !this.isStopped()) {
            this.bumpRevision(registration, current, section);
            this.commit(registration, next, "update");
        }
    });
    this.writeQueues.set(ns, run);
    return run;
}
```

Key semantics, precisely:

- **The fence is judged at the front of the per-namespace queue**, not at call
  time (`dsh-settings/lib/index.js:456,460`). Reason stated in
  `dsh-settings/README.md:92`: "expectedRevision is judged at the front of the
  queue, where the service can tell a fresh writer from one holding a stale
  snapshot."
- `expectedRevision === undefined` ⇒ **unconditional write** (no CAS). This is
  why `scope.update` is unfenced.
- Mismatch ⇒ `SettingsConflictError` with `code = "SETTINGS_CONFLICT"`,
  `expected`, `actual` — `dsh-settings/lib/index.js:92-110`:
  ```js
  var SettingsConflictError = class extends Error {
      code = "SETTINGS_CONFLICT";
      expected;
      actual;
      constructor(ns, expected, actual) {
          super(`settings namespace "${ns}" changed since it was read (expected revision ${String(expected)}, now ${String(actual)})`);
          this.name = "SettingsConflictError";
          this.expected = expected;
          this.actual = actual;
      }
  };
  ```
- The conflict is thrown **before** resolution/validation/persist — nothing is
  written.
- Writes to one namespace are serialized by `writeQueues` (`:228`, `:456`,
  `:470`); a failed write never poisons the chain (`.catch(() => void 0)` at
  `:456`).
- `cloneJsonShaped` (`:173-202`) rejects `Date`, `Map`, `BigInt`, non-finite
  numbers, class instances and cycles with a `$`-rooted path, **synchronously at
  call time** (`:455`) before queuing.

### 2.4 Cross-process CAS: NOT PROVIDED

`PKGS/dsh-settings/README.md:151`:

> **Cross-process concurrency is provider-defined** — the service serializes
> writes per namespace in-process only; concurrent processes converge by provider
> behavior (the file provider read-modify-writes under a writer lock, so
> namespaces survive concurrent writers and same-namespace conflicts resolve
> last-write-wins).

The file provider's `persistSection` re-reads disk under a `wx` lock *after* the
in-memory revision check (`dsh-settings-file/lib/index.js:168-176`), so an
external edit to the **same** namespace that lands in that window is
last-write-wins; a foreign **other** namespace is preserved. Revisions reset to 0
on restart, so they are session-scoped fencing tokens, not durable version
numbers.

---

## 3. Minimal patch / deep merge semantics

Two distinct layers of merging, in different files.

### 3.1 Service-level: user-layer deep merge

`PKGS/dsh-settings/lib/index.js:210-216` — **the** merge function:

```js
function mergeLayers(under, over) {
    if (over === void 0) return under;
    if (!isPlainObject(under) || !isPlainObject(over)) return over;
    const merged = { ...under };
    for (const [key, value] of Object.entries(over)) merged[key] = key in merged ? mergeLayers(merged[key], value) : value;
    return merged;
}
```

Behavior:
- plain objects merge **recursively**;
- **arrays and scalars replace wholesale** (documented in the JSDoc at
  `:203-209`: "plain objects merge recursively, every other value (arrays
  included) replaces the lower layer wholesale");
- `undefined` entries are stripped earlier by `cloneJsonShaped`
  (`dsh-settings/lib/index.js:193` `if (entry === void 0) continue;`) so a sparse
  patch cannot erase lower keys.

`update` uses it on the **user section only**: `mergeLayers(current, snapshot)`
(`:461`) where `current = this.section(ns) ?? {}` (`:459`). The composition
`base` is **never** written.

Resolution layering — `PKGS/dsh-settings/lib/index.js:509-513`:

```js
resolve(schema, base, section, validate) {
    const value = schema(mergeLayers(base, section));
    validate?.(value);
    return value;
}
```

Order: schema defaults → `base` → user section.

### 3.2 Does it replace the whole namespace? — No.

`update` deep-merges into the stored section. `replace` is the wholesale path and
is the *only* way to remove keys other than `mutate`/`unset`
(`dsh-settings/lib/types/index.d.ts:257-268`). `replace({})` re-inherits
everything.

### 3.3 Unknown fields

Persisted data is the **raw merged section**, not the schema-resolved value:

```js
// dsh-settings/lib/index.js:462-464
const next = deepFreeze(this.resolve(registration.schema, registration.base, section, registration.validate));
await this.persist(ns, section);
this.document[ns] = section;
```

Because `section` (the raw record) goes to `persist`, keys the schema does not
declare **survive in `settings.yaml`**. `section()` only rejects non-object
sections (`dsh-settings/lib/index.js:501-507`). The JSDoc on `publish` also
states unregistered sections are preserved (`:288-289`, "unregistered sections
preserved"), so namespaces of unloaded plugins are never dropped — confirmed by
the fact that `ui-onboarding` (registered by a *client* plugin) persists in the
host document.

*Not verified:* whether schemastery's `object()` keeps or strips unknown keys in
the **resolved value** returned by `get()`/`describe().value`. The persisted file
is unaffected either way. Treat `get()` as schema-shaped.

### 3.4 `mutate` path ops

`PKGS/dsh-settings/lib/index.js:118-151` (`applyPathOp`) implements
`{op:'set', path}` / `{op:'unset', path}`:

```js
function applyPathOp(section, op) {
    const [head, ...rest] = op.path;
    if (head === void 0) {
        if (op.op === "unset") return {};
        if (!isPlainObject(op.value)) throw new TypeError("settings mutate: setting the section root requires a plain object");
        return { ...op.value };
    }
    if (rest.length === 0) {
        if (op.op === "set") return { ...section, [head]: op.value };
        const { [head]: _removed, ...kept } = section;
        return kept;
    }
    const child = section[head];
    if (!isPlainObject(child)) {
        if (op.op === "unset") return section;
        return { ...section, [head]: applyPathOp({}, { ...op, path: rest }) };
    }
    return { ...section, [head]: applyPathOp(child, { ...op, path: rest }) };
}
```

`set` creates intermediate objects; `unset` on a missing path is a no-op; ordering
matters ("later ops observe earlier ones", `dsh-settings/lib/index.js:437`).
Op shape is validated in `mutate` (`:433-441`). Rationale for `mutate` existing
at all (`dsh-settings/lib/index.js:135-142`): a caller holding a **redacted**
view must be able to name one field without restating (and thereby deleting)
secrets it never received.

---

## 4. Persistence of `settings.yaml`

Provider: `FileSettingsProvider` — `PKGS/dsh-settings-file/lib/index.js:70`.
Default path resolution (`:31-41`):

```js
const filename = resolve(config.path ?? join(resolveDshHome(config.dshHome), "settings.yaml"));
const format = FORMATS[extname(filename)];
if (format === void 0) throw new Error(`settings-file: extension "${extname(filename)}" is not supported (use .yaml, .yml, or .json)`);
return { filename, format, watch: config.watch ?? true, debounceMs: config.debounceMs ?? 100 };
```

### 4.1 YAML library: `yaml` (eemeli), NOT `js-yaml`, and comments ARE preserved

Import — `PKGS/dsh-settings-file/lib/index.js:6`: `import { Document, parseDocument } from "yaml";`

Write cycle — `PKGS/dsh-settings-file/lib/index.js:163-177`:

```js
async persistSection(ns, section) {
    await mkdir(dirname(this.spec.filename), { recursive: true, mode: 448 });
    await withFileLock(this.spec.filename, async () => {
        await this.reconcileFromDisk();
        const output = this.spec.format === "yaml" ? this.renderYaml(ns, section) : this.renderJson(ns, section);
        await writeFileAtomic(this.spec.filename, output, { mode: 384, dirMode: 448 });
        this.text = output;
    });
}
```

Comment preservation — `PKGS/dsh-settings-file/lib/index.js:270-276`:

```js
renderYaml(ns, section) {
    if (this.text === void 0) return new Document({ [ns]: section }).toString();
    const document = parseDocument(this.text);
    const root = document.toJS();
    patchNode(document, [ns], isMapLike(root) ? root[ns] : void 0, section);
    return document.toString();
}
```

and the leaf-level diff — `PKGS/dsh-settings-file/lib/index.js:53-60`:

```js
function patchNode(document, path, current, next) {
    if (isMapLike(current) && isMapLike(next)) {
        for (const key of Object.keys(current)) if (!(key in next)) document.deleteIn([...path, key]);
        for (const [key, value] of Object.entries(next)) patchNode(document, [...path, key], current[key], value);
        return;
    }
    if (!deepEqualJson(current, next)) document.setIn([...path], next);
}
```

So: only changed leaves `setIn`, only removed keys `deleteIn`. Comments, anchors
and formatting survive on **untouched nodes and on the key node of every changed
pair**. Caveat from the JSDoc `:48-52`: a changed array or other non-map value is
replaced wholesale, "taking any comments inside them along". JSON documents
re-serialize with no comments (`renderJson`, `:278-282`; README
`dsh-settings-file/README.md:57`).

This is verified live: `SETTINGS_YAML` still carries the two Chinese comments in
the `llm-pi-ai` section (lines 48–49, 53–54) despite repeated writes.

### 4.2 Atomic write

`writeFileAtomic` — `PKGS/dsh-atomic-write/lib/index.js:60-76`: random-suffix
sibling (`${filename}.${randomBytes(6).toString("hex")}.tmp`) written with
`flag: "wx"` and the caller's mode, then `rename` over the target, with bounded
retries for transient Windows `EACCES`/`EBUSY`/`EPERM` (`:30-43`); temp file
removed on failure. fsync/crash durability explicitly out of scope (`:55`).
File mode `384` = `0600`; directory mode `448` = `0700`.

Cross-process writer lock — `withFileLock` (`PKGS/dsh-atomic-write/lib/index.js:122-145`):
`wx`-created `<filename>.lock` sibling containing the pid, exponential backoff
from 20 ms to 200 ms, `DEFAULT_LOCK_WAIT_MS = 2000` deadline (`:105`), orphan
locks never removed. Readers are lock-free because the rename is atomic.

### 4.3 Reload / watch

`chokidar` watch (`PKGS/dsh-settings-file/lib/index.js:3`, `:180-200`) with
`ignoreInitial: true` and `awaitWriteFinish` stability = `debounceMs` (default
100 ms). Reloads and writes share one settled-tail operation chain
(`operations`, `:91`; `enqueue`, `:151-155`), so a write can never render from
text a reload is replacing. Self-write suppression is **content comparison**
against the cached last-good `text` (`reconcileFromDisk`, `:245-262`, `:253`
`if (text === this.text || this.isClosed()) return;`).

Boot vs. runtime failure policy (`PKGS/dsh-settings-file/README.md:53`):
an invalid document **at boot fails plugin load**; once live, an unreadable or
unparsable edit warns and keeps the last good sections
(`refresh`, `:229-238`), while a **write** fails loud rather than overwriting the
user's manual edit (`reconcileFromDisk` rethrows for the write path).

---

## 5. Shipped namespaces, schema validation, and plugin-defined namespaces

### 5.1 Namespace grammar

`PKGS/dsh-settings/lib/index.js:82-86`:

```js
const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*$/;
function parseSettingsNamespace(value) {
    if (!NAMESPACE_PATTERN.test(value)) throw new TypeError(`settings namespace "${value}" must match ${String(NAMESPACE_PATTERN)}`);
    return value;
}
```

Validated both at TS type level (`SettingsNamespaceInput`, `dsh-settings/lib/types/index.d.ts:15-19`)
and at runtime in `register`/`get`/`update`/`replace`/`mutate`.

### 5.2 Namespaces shipped/recognized in this install

From `grep` over `installSection(` / `settings.register(` call sites:

| Namespace | Schema | Owner file |
|---|---|---|
| `agent-loop` | `AGENT_LOOP_SETTINGS_SCHEMA` | `PKGS/dsh-agent-loop/lib/index.js:1520` |
| `agent-default-model` | `AGENT_DEFAULT_MODEL_SETTINGS_SCHEMA` | `PKGS/dsh-agent-default-model/lib/index.js:45` |
| `agent-presets` | `AgentPresetSettingsSchema` | `PKGS/dsh-agent-presets/lib/index.js:1312` |
| `permission` | `settingsSchema` | `PKGS/dsh-permission-presets/lib/index.js:123` |
| `shell` | `ShellExecutor.Config` | `PKGS/dsh-shell/lib/index.js:64`; consumers `dsh-bash-local/lib/index.js:148`, `dsh-pwsh-local/lib/index.js:230` |
| `subagent-model-selection` | `SUBAGENT_MODEL_SELECTION_SETTINGS_SCHEMA` | `PKGS/dsh-tool-subagent/lib/model-selection-settings.js:65` |
| `web-search-deepseek` | `Config` | `PKGS/dsh-web-search-deepseek/lib/index.js:296` |
| `llm-deepseek` | `Config` | `PKGS/dsh-llm-deepseek/lib/index.js:2080` |
| `llm-pi-ai` | `Config` | `PKGS/dsh-llm-pi-ai/lib/index.js:2661` |
| `ui-conversation` | `ConversationSettingsSchema` | `PKGS/dsh-client-ui-conversation/lib/index.js:23` |
| `ui-onboarding` | `OnboardingSettingsSchema` | `PKGS/dsh-client-ui-settings-general/lib/index.js:10` |
| `ui-theme` | `ThemeSettingsSchema` | `PKGS/dsh-client-ui-theme/lib/index.js:88` |
| `ui-chat` | `ChatSettingsSchema` | `PKGS/dsh-client-ui-chat/lib/index.js:20` |
| `locale` | `LocaleSettingsSchema` | `PKGS/dsh-client-locale/lib/index.js:23` |

Note the split: several namespaces (`ui-*`, `locale`) are registered by **client**
plugins, yet persist in the host file — they write through the Remote API.

### 5.3 Is there a schema per namespace, and is it enforced before write?

Yes. `register(ns, schema: z<T>)` requires a **schemastery** schema
(`@deepseek-ai/schemastery`, imported as `z` at
`dsh-settings/lib/types/index.d.ts:9`).

Enforcement points:
1. **On write** — `dsh-settings/lib/index.js:462` resolves+validates the candidate
   with `deepFreeze(this.resolve(...))` which calls `schema(...)` and
   `validate?.(value)`, and this happens **before** `await this.persist(...)` at
   `:463`. A throw rejects the write and nothing is persisted. Doc:
   `dsh-settings/lib/types/index.d.ts:246-247` ("A validation failure rejects
   before anything is persisted").
2. **On external publish/reload** — `publish` (`:488-499`) catches the failure,
   logs `settings: keeping last good "%s" after invalid stored section` and
   `continue`s, so one bad namespace does not block others.
3. **At registration** — `register` calls `this.resolve(...)` eagerly at `:290`;
   a stored section that already fails rejects the registration itself
   (`dsh-settings/lib/types/index.d.ts:208-209`).
4. **Extra cross-field validation** — `SettingsRegisterOptions.validate`
   (`dsh-settings/lib/types/index.d.ts:47`) receives the schema-valid resolved
   value and throws to refuse the write; same reload/registration policy as a
   schema failure (`:39-44`).

Registration return / duplicate handling —
`PKGS/dsh-settings/lib/index.js:281-297`:

```js
register(ns, schema, options) {
    const parsedNs = parseSettingsNamespace(ns);
    if (this.registrations.has(parsedNs)) throw new Error(`settings namespace "${parsedNs}" is already registered`);
    ...
    this.ctx.effect(() => {
        this.registrations.set(parsedNs, registration);
        return () => this.registrations.delete(parsedNs);
    }, `settings.register(${JSON.stringify(String(parsedNs))})`);
```

### 5.4 Can a plugin register its OWN namespace + schema? — Yes

Fully supported and is the intended extension point. Registration is a fiber
effect: disposing the plugin's fiber removes the namespace and its observers
(`dsh-settings/lib/types/index.d.ts:205-209`). No central registry file to edit.

### 5.5 Read-only providers

`abstract readonly writable` (`dsh-settings/lib/types/index.d.ts:178`). A
non-writable provider rejects in-process writes with
`settings provider is read-only: "${ns}" cannot be updated in-process`
(`dsh-settings/lib/index.js:448`). `FileSettingsProvider` is always writable
(`dsh-settings-file/lib/index.js:104-106`). Remote writes are blocked from the
client only when Host `writable === false` (`SettingsDescribeValue.writable`,
`dsh-settings/lib/types/types.d.ts:66`).

---

## 6. How a plugin obtains `ctx.settings` in `apply(ctx)`

Two supported patterns, both present in shipped packages.

### Pattern A — optional dependency via `ctx.inject` (the common one)

`PKGS/dsh-llm-pi-ai/lib/index.js:2659-2685` (verbatim, abridged at the end):

```js
ctx.inject(["settings"], (settingsCtx) => {
    let registering = true;
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
        validate: (value) => {
            if (registering) resolveProfiles(value.providers, "deferred");
            else assertServiceable(value, current());
        },
        setSource: (source) => {
            current = source;
        },
        onChange: () => {
            try {
                ensureRegistrationFacts();
            } catch (error) {
                ctx.logger.error("llm-pi-ai: keeping the previously registered routes after a refused update");
                ctx.logger.error(error);
            }
            try {
                ensureDirectory();
            } catch (error) {
                ctx.logger.error("llm-pi-ai: keeping the previous configurable-provider directory after a refused update");
                ctx.logger.error(error);
            }
        }
    });
    registering = false;
});
```

where the namespace constant is `PKGS/dsh-llm-pi-ai/lib/index.js:2531-2533`:

```js
const name = "llm-pi-ai";
const inject = ["llm"];
const NS = "llm-pi-ai";
```

Note the plugin's **declared** `inject` is only `["llm"]`; `settings` is obtained
optionally through `ctx.inject(["settings"], …)` so the plugin still works when
no settings provider is mounted. Identical pattern in
`PKGS/dsh-llm-deepseek/lib/index.js:2079-2080`.

### Pattern B — `register` directly (owner keeps its own scope)

`PKGS/dsh-agent-presets/lib/index.js:1311-1313`:

```js
ctx.inject(["settings"], (settingsCtx) => {
    this.settings = settingsCtx.settings.register(SETTINGS_NAMESPACE, AgentPresetSettingsSchema, { base: { default: config.default } });
```

Client-plane example (same host service, browser side):
`PKGS/dsh-client-ui-settings-general/lib/index.js:10`
`settingsCtx.settings.register(ONBOARDING_SETTINGS_NAMESPACE, OnboardingSettingsSchema);`

There is **no `inject` name other than the service name itself**: the inject key is
literally `"settings"` (Cordis service name, `dsh-settings/lib/index.js:238`).
Other keys seen in the same packages are unrelated: `"llm"`, `"remote"`,
`"remote.settings"`, `"webServer"`.

---

## 7. Wire protocol — how the client learns about changes and revisions

### 7.1 Host service that owns the Remote namespace

`PKGS/dsh-api-settings-controller/lib/index.js:412`:
`super(ctx, "settingsController", { namespace: "settings" })` — i.e. the wire
namespace is `settings`, distinct from the local Cordis service name
`settingsController`. A sibling `CredentialsController` is mounted via
`ctx.plugin(CredentialsController)` (`:416`) with namespace `credentials`
(`:146`).

### 7.2 Endpoint enumeration (generated)

`PKGS/dsh-api-settings-controller/lib/typert.remote-client.d.ts:30-36` — the
complete `settings` route set:

```ts
'settings/canOpenAgentPresetDirectory': () => Promise<RemoteResult<boolean>>
'settings/describe': () => Promise<RemoteResult<SettingsDescribeValue>>
'settings/mutate': (ns: string, ops: SettingsPathOpView[], expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
'settings/openAgentPresetDirectory': (agentPreset: string, signal?: AbortSignal) => Promise<RemoteResult<AgentPresetDirectoryOpenValue>>
'settings/openSettingsDocument': (signal?: AbortSignal) => Promise<RemoteResult<SettingsDocumentOpenValue>>
'settings/replace': (ns: string, section: Record<string, JsonValue>, expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
'settings/update': (ns: string, patch: Record<string, JsonValue>, expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
```

and the `credentials` namespace: `credentials/describe`, `credentials/set`,
`credentials/unset` (`:27-29`). Every method carries `expectedRevision` explicitly
(incl. `undefined`); an `AbortSignal` final parameter opts into cooperative
cancellation (`dsh-typert-protocol/README.md:45`).

Host implementations: `describe` `dsh-api-settings-controller/lib/index.js:424-431`
(always `redactSecrets: true`), `update` `:447-449`, `replace` `:458-460`,
`mutate` `:471-473`, unified `write` `:532-547`.

### 7.3 What the client receives

Reads: `describe()` returns
`{ writable, hasDocument, namespaces: [SettingsNamespaceView] }` —
`SettingsDescribeValue` at `dsh-settings/lib/types/types.d.ts:64-71`. Every view
carries `revision` and `secrets: {path, set}[]`; secret **values** never cross
(`namespaceView` projection at `dsh-api-settings-controller/lib/index.js:275-289`).

Change notification: one forwarded Cordis event,
`settings/document-updated (ns, revision)` —
allowlist entry `PKGS/dsh-api-remotes/lib/types/remote-events.d.ts:63-66`:

```ts
}, {
    readonly event: "settings/document-updated";
    readonly mode: "emit";
},
```

**`settings/updated` is NOT in the forwarded allowlist** — the client never sees
the resolved-value event, only the raw-section/revision invalidation and must
re-`describe`. Client subscription —
`PKGS/dsh-client-ui-settings/lib/client.js:1344-1356`:

```js
ctx.effect(() => {
    const disposers = [ctx.remote.$on("settings/document-updated", () => {
        mirror.load();
    }), ctx.on("connection/reset", () => {
        mirror.load();
    })];
    mirror.ensure();
    return () => {
        for (const dispose of disposers) dispose();
    };
}, "ui-settings: describe mirror invalidations");
```

### 7.4 Failure taxonomy

`PKGS/dsh-api-settings-controller/lib/types/types.d.ts:15-26`:

```ts
'settings/rejected': { readonly ns: string };
'settings/conflict': { readonly ns: string; readonly expected: number; readonly actual: number };
```

Classification — `PKGS/dsh-api-settings-controller/lib/index.js:559-580`:
`settingsConflictOf` structurally recognizes `code === "SETTINGS_CONFLICT"` plus
numeric `expected`/`actual` (works across module/realm copies), and `rejected`
maps it to `settings/conflict`, everything else to `settings/rejected`.

Client handling — `PKGS/dsh-client-ui-settings-models/lib/client.js:2599-2612`:

```js
writeSettings: async (ns, ops, expectedRevision) => {
    const response = await ctx.remote.settings.mutate(ns, ops, expectedRevision);
    if (response.ok) return { kind: "written", view: response.value };
    const { code, message } = response.error;
    return code === "settings/conflict" ? { kind: "conflict", message } : { kind: "refused", message };
},
```

### 7.5 Physical transport

- Remote **unary** calls: HTTP POST. "The browser uses HTTP POST for Remote unary
  calls." — `PKGS/dsh-client-connection/README.md:32`.
- Remote **streams / forwarded events**: `PKGS/dsh-api-gateway/lib/index.js:11`
  ```js
  const REMOTE_STREAM_MUX_PATH = "/api/remote.mux";
  ```
- The `/api` prefix (and `/api/<anything>`) is owned by the Web carrier of
  `dsh-client-connection` (`PKGS/dsh-client-connection/lib/index.js:12`
  `/** Route prefix owning every api request (`/api` and `/api/<anything>`). */`).
  Typert Gateway "claims generated Remote endpoints"; unclaimed `/api` requests
  return 404 (`dsh-client-connection/README.md:32`).
- Browser auth: signed cookie bound to hostname+port, plus `Host`/`Origin` trust
  checks; every RPC requires a browser session
  (`dsh-client-connection/README.md:36`). Static assets are public.
- Client inject for the settings surface —
  `PKGS/dsh-client-ui-settings/lib/client.js:1333`:
  ```js
  const inject = ["remote", "remote.settings"];
  ```

### 7.6 Client write path with revision fencing (real code)

`PKGS/dsh-client-ui-settings/lib/client.js:1040-1052`:

```js
mutate(ops, expectedRevision) {
    const ownedOps = structuredClone(ops);
    const generation = ++this.writeGeneration;
    return this.enqueue(async () => {
        const revision = expectedRevision ?? this.pendingRevision ?? this.getSnapshot().revision;
        const response = await this.ctx.remote.settings.mutate(this.spec.namespace, ownedOps, revision);
        if (!response.ok) {
            await this.recover(generation);
            return;
        }
        if (this.disposed) return;
        if (generation === this.writeGeneration) {
            this.pendingRevision = void 0;
            this.mirror.acceptView(response.value);
        } else this.pendingRevision = response.value.revision;
    });
}
```

Note: a committed write folds its returned view into the mirror without a re-read;
a failed write triggers exactly one recovery `describe`
(`recover`, `:1054-1060`); a superseded write defers recovery to its successor.

---

## 8. Public/documented plugin API — README inventory

All four packages ship `README.md` + `README.zh.md` with YAML front-matter
(`kind: "package-reference"`) and an implementation-internals `<details>` block.

| README | Key intended-usage statements |
|---|---|
| `PKGS/dsh-settings/README.md` | Mount a provider, register a namespace, read/watch, write through the owner scope. §"Registering a namespace" (`:46-58`) shows `register('ui-theme', ThemeSchema, { base: config })` + `scope.get()` + `scope.update({density:'compact'})`. §"Writing values" (`:64-68`) enumerates `update` deep-merge, `replace` wholesale/reset, `mutate` path ops, JSON-only rejection, and `expectedRevision` → `SettingsConflictError`. §"Configuration surfaces" (`:70-72`) documents `describe()` and redaction. §"Events and failures" (`:74-76`) documents the two events. Limitations (`:149-151`) include single user layer, `redactSecrets` not a proven wire boundary, cross-process last-write-wins. |
| `PKGS/dsh-settings-file/README.md` | One YAML/JSON document under the harness home; live external edits; comment-preserving writes; unknown/unloaded namespaces never dropped; boot fails loud, live reload keeps last good. Config table (`:42-47`). Write semantics (`:55-59`): leaf-level diffs, 2 s lock deadline, `0600`/`0700`, atomic replace. |
| `PKGS/dsh-client-ui-settings/README.md` | Client settings-namespace scope service + schema service + canonical slot types. §"Binding a namespace" (`:30-32`): `ctx.settingsScope.bind(spec)`, snapshot carries resolved/base/user/revision/writability, each write fenced as `expectedRevision`. §"The describe mirror" (`:52-54`): one shared mirror, refreshed on forwarded `settings/document-updated` and `connection/reset`. Limitation (`:97`): non-loopback pages get no durable settings (memory mode). |
| `PKGS/dsh-api-settings-controller/README.md` | Host Remote owner for the configuration surfaces. (4 KB; the authoritative details are in the `.d.ts` + implementation cited above.) |
| `PKGS/dsh-api-remotes/README.md` | BFF selecting Remote capabilities; §"Forwarded Host events" (`:38-45`) documents the single allowlist and that adding one event is a build-time change here; limitation (`:71-72`): "the capability set is fixed by explicit build-time value imports". |
| `PKGS/dsh-typert-protocol/README.md` | §"Exposing a Host method" (`:30-45`): `@Remote` / `@RemoteScope` + `TypertRemoteService`; `signal: AbortSignal` final param. §"Reporting and reading a Remote failure" (`:51-64`): `RemoteError` + merge-extensible `RemoteErrorDetailsMap`. |
| `PKGS/dsh-host-webserver/README.md` | §"Registering routes" (`:43-45`): `register`, `registerUpgrade`, fallback seat; §"The fallback seat" (`:47-51`). |
| `PKGS/dsh-atomic-write/README.md` | Atomic replacement + writer coordination. |
| `PROFILE/dsh-plugin-marketplace/README.md`, `STANDARD.md`, `docs/REFERENCE.md` | Third-party, but the most concrete end-to-end example of host HTTP routes + a bespoke client (§9). |

There is **no standalone public "plugin API" guide shipped inside the npm
packages** for settings beyond these package READMEs. NOT FOUND: a top-level
`docs/` tree in the installed runtime (the READMEs link to `../../../docs/...`
paths that exist only in the DSH source repository, not in the distributed
`node_modules`).

---

## 9. Host endpoints callable from a plugin's own client half

### 9.1 The official typed mechanism (`ctx.remote.settings`-style)

Mechanism: mark a public instance method with `@Remote`, make the owning service
extend `TypertRemoteService`, bind a wire namespace, and let the Typert generator
produce the `/remote` client artifact — `PKGS/dsh-typert-protocol/README.md:30-45`:

```text
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export class GoalService extends TypertRemoteService {
  @Remote
  async create(agentId: string, objective: string): Promise<GoalResult> {
    ...
  }
}
```

Runtime dispatch: `TypertGatewayService` (`PKGS/dsh-api-gateway/lib/types/index.d.ts:48-106`),
which "Resolve[s] strict generated definitions or conservative SRC markers against
current Cordis Services and Typert providers" (`claimsEndpoint`, `collectSrcClaims`,
`resolveSrcDescriptor`, `srcDescriptor`). Client side: `ctx.remote.<namespace>.<method>`
via `TypertClientRemote`, which exposes **only** `$mount()` and `$on()`
(`PKGS/dsh-typert-protocol/lib/types/types.d.ts:230-244`) — mounting is done by the
assembly, not by a feature plugin.

**Is there an official `ctx.remote` / `ctx.api` host service?** For the host:
**no generic `ctx.remote`/`ctx.api` service exists**; there is `ctx.typertGateway`
(the dispatcher) and `ctx.typert` (the registry, `PKGS/dsh-typert-registry/lib/types/index.d.ts`).
For the client: **yes**, `ctx.remote` is a real service with namespace members
(`remote.settings`, `remote.credentials`, `remote.llm`, …).

**Critical limitation for a drop-in third-party plugin:** adding a *new* Remote
namespace requires a DSH source build (Typert generation) **and** an explicit
entry in the `dsh-api-remotes` assembly, which is a fixed build-time set:

> "The capability set is fixed by explicit build-time value imports; the Client
> does not discover the Host's active Services or Remote definitions at runtime.
> Additional capabilities require an explicit `/remote` value import and mount in
> this assembly."
> — `PKGS/dsh-api-remotes/README.md:71-72`

Consequently a plugin installed only into `~/.dsh/profiles/web` (like the
marketplace plugin or `dsh-workbench-ecs`) **cannot** add a `ctx.remote.*`
namespace. That is why such plugins use plain HTTP routes.

### 9.2 The practical mechanism for a third-party plugin: `ctx.webServer`

Service: `WebServer` — `PKGS/dsh-host-webserver/lib/types/index.d.ts:67`, injected
as `ctx.webServer` (`:15-18`). Registration API (`:90`, `:97`, `:106`, `:114`):

```ts
register(route: WebRoute): () => void;                       // { kind: 'exact'|'prefix', path, handler }
registerUpgrade(route: WebUpgradeRoute): () => void;         // exact-path HTTP upgrade
registerFallback(handler: WebRoute['handler']): () => void;  // one owner only
tapIndex(transform: (html: string) => string): () => void;   // raw HTML index transform
```

Route handlers receive Node `IncomingMessage`/`ServerResponse` and "retain direct
response ownership" (`:6`, `:38`). Matching is exact table → longest prefix →
fallback (`dsh-host-webserver/README.md:45`). Duplicate `(kind, path)` throws.

#### Real example: `dsh-plugin-marketplace`

`PROFILE/dsh-plugin-marketplace/lib/index.js:80-82` — declared dependency:

```js
/** 声明依赖 webServer 服务：cordis 会先启动该服务再执行 apply()，
 *  避免 ctx.get("webServer") 同步取值为 undefined 导致插件树加载失败 */
export const inject = ["webServer"];
```

`PROFILE/dsh-plugin-marketplace/lib/index.js:1237-1245` — service acquisition and
index injection:

```js
function apply(ctx) {
  const webServer = ctx.get("webServer");
  if (webServer === void 0) throw new Error("dsh-plugin-marketplace: webServer service unavailable");

  // 写操作会话 token 注入页面（LAN 模式校验用；回环模式注入无害）。
  if (typeof webServer.tapIndex === "function") {
    webServer.tapIndex((html) => html.replace("</head>", `<script>window.__DSH_MP_TOKEN__="${auth.getToken()}"</script></head>`));
  }
```

`PROFILE/dsh-plugin-marketplace/lib/http/routes.js:75-78` — one of 17 routes:

```js
webServer.register({
  kind: "exact",
  path: "/api/marketplace/self-update",
  handler: async (req, res) => {
    const lang = langOf(req, { lang: "" });
    if (req.method === "GET") { ... }
    if (req.method !== "POST") return marketplaceJson(res, 405, { error: t(lang, "methodNotAllowed") });
    if (!(await isWriteAllowed(req))) return marketplaceJson(res, 403, { error: t(lang, "forbidden") });
    ...
  }
});
```

Full route inventory (`PROFILE/dsh-plugin-marketplace/lib/http/routes.js`, all
`kind: "exact"`, all under `/api/marketplace/`): `self-update` (:77), `list`
(:128), `skills` (:205), `backup` (:295), `restore/diff` (:308),
`backup/webdav` (:323), `restore/webdav` (:345), `logs` (:367),
`feedback/pending` (:380), `feedback` (:391), `feedback/token` (:420),
`env-keys` (:444), `profile` (:477), `check-update` (:518), `env-edit` (:574),
`install` (:605), `uninstall` (:711).

The plugin's client half is a normal `webServer`-served asset that `fetch`es the
same-origin routes and is explicitly marked `"immediately": true` in
`PROFILE/dsh-plugin-marketplace/package.json` (`dsh.client.inject` =
`["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-settings"]`).

The marketplace additionally rolls **its own** CSRF/session-token and
Host/Origin write guard (`PROFILE/dsh-plugin-marketplace/lib/http/auth.js`,
referenced at `lib/index.js:18` `createAuth`), because `webServer` deliberately
ships "No server-wide TLS, authentication, or origin policy"
(`PKGS/dsh-host-webserver/README.md:113`) — route owners enforce their own policy.
`dsh-client-connection` already authenticates every `/api` request with a signed
cookie (`PKGS/dsh-client-connection/README.md:36`), but routes registered
directly on `webServer` do not automatically inherit that; only Gateway-claimed
`/api/remote.*` endpoints do.

### 9.3 Summary table for question 9

| Need | Mechanism | Officially supported for a drop-in plugin? |
|---|---|---|
| Typed RPC callable as `ctx.remote.X.y()` on client | `@Remote` + `TypertRemoteService` + Typert generator + mount in `dsh-api-remotes` | ❌ requires DSH source build (fixed build-time capability set) |
| Custom HTTP endpoint from client | `export const inject = ["webServer"]` → `ctx.get("webServer").register({kind, path, handler})` | ✅ works today (marketplace is the proof) |
| WebSocket endpoint | `webServer.registerUpgrade({path, handler})` | ✅ |
| Serve the SPA fallback | `webServer.registerFallback(handler)` | ✅ (single owner; already taken in the shipped composition) |
| Inject bootstrap data into index.html | `webServer.tapIndex(fn)` or the `webserver/index-inject` event | ✅ |
| Reuse DSH's own settings transport | `ctx.remote.settings.{describe,update,replace,mutate}` (client) / `ctx.settings.*` (host) | ✅ and is the intended path |

---

## 10. Worked example — read namespace X, then write a minimal patch with revision safety

The most valuable finding is a **host-side gap**: the owner `SettingsScope` cannot
fence. Revision-safe host writes must go through the flat provider API with a
revision read from `describe()`. The example below is assembled strictly from the
real signatures and code paths cited (§1.1, §2.3, §2.4, §5.2), plus the real
registry pattern from `PKGS/dsh-llm-pi-ai/lib/index.js:2659-2685`.

```ts
// ── host-side plugin (Node/Cordis face) ────────────────────────────────────
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SettingsConflictError } from '@deepseek-ai/dsh-settings'

export const name = 'my-provider-settings'
// settings is OPTIONAL, exactly as dsh-llm-pi-ai does it: the plugin still works
// when no settings provider is mounted.
export const inject = ['llm']   // <- real example: dsh-llm-pi-ai/lib/index.js:2532

const NS = 'my-provider-settings'   // must match /^[a-z][a-z0-9-]*$/  (dsh-settings/lib/index.js:82)

const Config = z.object({
  providers: z.dict(z.object({
    displayName: z.string(),
    apiKeyEnv: z.string(),
    baseURL: z.string(),
  })),
})
type ConfigT = z.infer<typeof Config>

export function apply(ctx: Context, config: ConfigT) {
  // 1) REGISTER once — schema defaults → base(=composition config) → user layer.
  //    dsh-settings/lib/index.js:281-315 ; dsh-agent-presets/lib/index.js:1312
  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(NS, Config, { base: config })

    // Observer form (equivalent to scope.watch) — dsh-settings/lib/types/types.d.ts:89
    ctx.on('settings/updated', (ns, next, prev, source) => {
      if (ns !== NS) return
      // source is 'update' (in-process write) or 'provider' (external edit)
    })

    // 2) READ a namespace resolved value (deep-frozen): dsh-settings/lib/index.js:388-390
    const current: ConfigT = scope.get()

    // 3) READ the revision for CAS: describe() -> descriptor.revision
    //    dsh-settings/lib/index.js:351-369, field at dsh-settings/lib/types/index.d.ts:57-61
    const descriptor = settingsCtx.settings.describe({ redactSecrets: true })
      .find((d) => d.ns === NS)
    const revision = descriptor?.revision

    // 4) WRITE a MINIMAL PATCH with revision safety.
    //    update() deep-merges into the USER section only (never `base`):
    //    dsh-settings/lib/index.js:403-405 -> write(..., 'merge', expectedRevision)
    //    merge site: dsh-settings/lib/index.js:461  mergeLayers(current, snapshot)
    //    CAS check : dsh-settings/lib/index.js:460
    scope.update({ providers: { router: { displayName: 'Router (edited)' } } })
      .catch(async (error) => {
        if (error instanceof SettingsConflictError) {   // error.code === 'SETTINGS_CONFLICT'
          // someone else wrote first: re-read descriptor and retry deliberately
          const fresh = settingsCtx.settings.describe({ redactSecrets: true })
            .find((d) => d.ns === NS)
          // ... re-apply against `fresh.revision`
          return
        }
        throw error
      })

    // The FENCED variant — the only revision-safe host path. Note that scope.update
    // above is UNFENCED (dsh-settings/lib/index.js:312 forwards no revision).
    const patch = { providers: { router: { displayName: 'Router (fenced)' } } }
    settingsCtx.settings.update(NS, patch, revision)   // dsh-settings/lib/index.js:403
      .then(() => { /* persisted, validated, committed */ })
      .catch((error) => {
        if (error instanceof SettingsConflictError) {
          console.warn('settings moved:', error.expected, '->', error.actual)
          return
        }
        throw error
      })

    // MINIMAL REMOVAL (cannot delete fields you never saw): path ops.
    // dsh-settings/lib/index.js:433-441, applyPathOp at :118-151
    settingsCtx.settings.mutate(NS, [
      { op: 'set',   path: ['providers', 'router', 'baseURL'], value: 'http://127.0.0.1:3456/v1' },
      { op: 'unset', path: ['providers', 'router', 'displayName'] },
    ], revision)
  })
}
```

Client-side equivalent, verbatim from the shipped UI (revision fencing is built in):

```js
// PROFILE/../@deepseek-ai/dsh-client-ui-settings/lib/client.js:1040-1052
mutate(ops, expectedRevision) {
    const ownedOps = structuredClone(ops);
    const generation = ++this.writeGeneration;
    return this.enqueue(async () => {
        const revision = expectedRevision ?? this.pendingRevision ?? this.getSnapshot().revision;
        const response = await this.ctx.remote.settings.mutate(this.spec.namespace, ownedOps, revision);
        if (!response.ok) { await this.recover(generation); return; }
        ...
    });
}
```

### Checklist for a correct host write

1. `ns` must match `/^[a-z][a-z0-9-]*$/` and be registered exactly once, otherwise
   `TypeError` / `settings namespace "X" is not registered`
   (`dsh-settings/lib/index.js:446`, `:84`).
2. Payload must be cloneable JSON: no `Date`, `Map`, `BigInt`, non-finite number,
   cycle, or class instance — rejected **synchronously** with a `$`-rooted path
   (`dsh-settings/lib/index.js:455`, `cloneJsonShaped` `:173-202`).
3. `undefined` object entries are silently dropped (sparse-patch semantics);
   `undefined` inside an array is **rejected** (`:184`, `:193`).
4. Validation failure ⇒ rejection before persist; nothing written
   (`dsh-settings/lib/index.js:462-463`).
5. Omit `expectedRevision` only if you deliberately want last-write-wins.
6. Catch `SettingsConflictError` (by `code`, not `instanceof`, if it may cross a
   realm boundary — the Host Remote layer uses the structural
   `settingsConflictOf`, `dsh-api-settings-controller/lib/index.js:559-563`).

---

## 11. Answers to the 9 questions, one line each

1. **API surface.** `ctx.settings` (`SettingsProvider`): `register`, `installSection`,
   `describe`, `get`, `update`, `replace`, `mutate`, `documentPath`, `prepareDocument`,
   `writable`; plus `scope.get/watch/update/replace` from `register`. No `set`,
   `patch`, `delete`, `watch`, `subscribe`, `onChange`, `ifRevision` on the provider.
2. **Revision.** Per-namespace, in-memory, monotonic, starts at 0 at process start,
   bumped only when the **raw** section changes (`dsh-settings/lib/index.js:521-525`);
   exposed via `describe().revision`, `settings/document-updated (ns, revision)`, and the
   client view's `revision`. Optimistic concurrency is the positional
   `expectedRevision` (not `ifRevision`), checked at the front of the per-namespace
   queue (`:460`), throwing `SettingsConflictError` (`code: 'SETTINGS_CONFLICT'`,
   `expected`, `actual`). `undefined` = unconditional. No cross-process CAS.
3. **Merge.** `update` deep-merges plain objects recursively into the **user section
   only**; arrays/scalars replace wholesale (`mergeLayers`, `dsh-settings/lib/index.js:210-216`).
   `replace` is the wholesale/reset path; `mutate` gives ordered path ops. Unknown
   keys survive in the file because the **raw merged section** is persisted
   (`:463-464`).
4. **Persistence.** `dsh-settings-file` + the `yaml` package's `parseDocument`/`Document`
   (not `js-yaml`), leaf-level `setIn`/`deleteIn` diffs (`:53-60`, `:270-276`), so YAML
   **comments/anchors/formatting are preserved** on untouched nodes and changed keys;
   atomic `writeFileAtomic` (random-suffix `wx` temp + rename,
   `dsh-atomic-write/lib/index.js:60-76`) under a cross-process `<file>.lock`
   (`:122-145`, 2 s deadline). Comments inside a changed array/non-map value are lost.
5. **Namespaces + schema.** 14 namespaces registered in this install (`agent-loop`,
   `agent-default-model`, `agent-presets`, `permission`, `shell`,
   `subagent-model-selection`, `web-search-deepseek`, `llm-deepseek`, `llm-pi-ai`,
   `ui-conversation`, `ui-onboarding`, `ui-theme`, `ui-chat`, `locale`). Each needs a
   schemastery schema; validated on write (reject before persist), on reload (warn +
   keep last good), and at registration (rejects registration). A plugin **can**
   register its own namespace + schema, fiber-scoped.
6. **Getting the service.** Inject key is literally `"settings"`
   (`export const inject = ['settings']`, or optionally
   `ctx.inject(['settings'], (c) => c.settings...)`). Real example:
   `PKGS/dsh-llm-pi-ai/lib/index.js:2659-2685` (`installSection`) and
   `PKGS/dsh-agent-presets/lib/index.js:1311-1313` (`register`).
7. **Wire.** Remote namespace `settings` owned by `SettingsController` with endpoints
   `settings/{describe,update,replace,mutate,openSettingsDocument,canOpenAgentPresetDirectory,openAgentPresetDirectory}`
   (`dsh-api-settings-controller/lib/typert.remote-client.d.ts:30-36`); changes arrive as
   the forwarded event `settings/document-updated` (`settings/updated` is **not**
   forwarded); failures are `settings/conflict` / `settings/rejected`. Transport: HTTP
   POST unary + `/api/remote.mux` WebSocket under the `/api` bridge.
8. **Docs.** Per-package READMEs exist for all named packages (`dsh-settings`,
   `dsh-settings-file`, `dsh-client-ui-settings`, and also `dsh-api-settings-controller`,
   `dsh-api-remotes`, `dsh-typert-protocol`, `dsh-host-webserver`, `dsh-atomic-write`),
   each with EN + ZH. No standalone public plugin-API guide ships inside `node_modules`
   (the linked `../../../docs/...` paths are source-repo only) — **NOT FOUND** in this
   install.
9. **Host endpoint for a plugin's client half.** Two mechanisms: (a) official typed
   Remote via `@Remote` + `TypertRemoteService` + Typert generation — but the capability
   set is a **fixed build-time** list in `dsh-api-remotes`, so a drop-in plugin cannot
   add one; (b) the practical route — `export const inject = ['webServer']`,
   `ctx.get('webServer').register({ kind: 'exact'|'prefix', path, handler })` (plus
   `registerUpgrade` / `registerFallback` / `tapIndex`), exactly as
   `dsh-plugin-marketplace` does with 17 `/api/marketplace/*` routes. On the client,
   `ctx.remote` is the official typed RPC surface (`ctx.remote.settings.*`), while
   plain plugin routes are called by `fetch`.
