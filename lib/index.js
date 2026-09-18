// src/shared/capabilities.ts
var VERIFIED_DSH_VERSION = "0.1.5-rc.2";
var PLUGIN_VERSION = "0.1.0";
var PROVIDER_NAMESPACE = "llm-pi-ai";
var PLUGIN_NAMESPACE = "dsh-advanced-provider-settings";
var LEGACY_NAMESPACE = "dsh-custom-provider-settings";
var PROTOCOLS = ["openai-completions", "openai-responses", "anthropic-messages"];
function isProtocolId(value) {
  return typeof value === "string" && PROTOCOLS.includes(value);
}
var MODALITIES = ["text", "image"];
var THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var THINKING_FORMATS = [
  "openai",
  "deepseek",
  "openrouter",
  "together",
  "baseten",
  "zai",
  "qwen",
  "chat-template",
  "qwen-chat-template",
  "string-thinking",
  "ant-ling"
];
var MAX_TOKENS_FIELDS = ["max_completion_tokens", "max_tokens"];
var THINKING_TOKEN_BUDGET_FIELDS = [
  "thinking_token_budget",
  "thinking_budget",
  "thinking_budget_tokens"
];
var CACHE_CONTROL_FORMATS = ["anthropic"];
var COMPAT_FIELDS = [
  // -- OpenAI-compatible completions -------------------------------------
  {
    key: "supportsStore",
    group: "request",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Whether the endpoint accepts the `store` request field."
  },
  {
    key: "supportsDeveloperRole",
    group: "request",
    kind: "boolean",
    protocols: ["openai-completions", "openai-responses"],
    note: "Whether the endpoint accepts the `developer` role instead of `system`."
  },
  {
    key: "supportsReasoningEffort",
    group: "reasoning",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Whether the endpoint accepts `reasoning_effort`."
  },
  {
    key: "supportsUsageInStreaming",
    group: "streaming",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Whether `stream_options.include_usage` is accepted."
  },
  {
    key: "supportsFinishReason",
    group: "streaming",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Whether streamed chunks carry a finish reason."
  },
  {
    key: "maxTokensField",
    group: "request",
    kind: "enum",
    protocols: ["openai-completions"],
    options: MAX_TOKENS_FIELDS,
    note: "Which field carries the output cap."
  },
  {
    key: "requiresToolResultName",
    group: "tools",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Whether tool results must repeat the tool name."
  },
  {
    key: "requiresAssistantAfterToolResult",
    group: "tools",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Whether an assistant turn must follow tool results."
  },
  {
    key: "requiresThinkingAsText",
    group: "reasoning",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Whether thinking must be sent as <thinking> text."
  },
  {
    key: "requiresReasoningContentOnAssistantMessages",
    group: "reasoning",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Whether replayed assistant turns need an empty reasoning_content."
  },
  {
    key: "thinkingFormat",
    group: "reasoning",
    kind: "enum",
    protocols: ["openai-completions"],
    options: THINKING_FORMATS,
    note: "Wire shape of the reasoning parameter."
  },
  {
    key: "chatTemplateKwargs",
    group: "reasoning",
    kind: "dict",
    protocols: ["openai-completions"],
    note: "`chat_template_kwargs` map (chat-template thinking formats)."
  },
  {
    key: "chatTemplateArgs",
    group: "reasoning",
    kind: "dict",
    protocols: ["openai-completions"],
    note: "`chat_template_args` map (baseten thinking format)."
  },
  {
    key: "supportsThinkingTokenBudget",
    group: "reasoning",
    kind: "boolean",
    protocols: ["openai-completions"],
    note: "Alias enabling the vLLM thinking budget field."
  },
  {
    key: "thinkingTokenBudgetField",
    group: "reasoning",
    kind: "enum",
    protocols: ["openai-completions"],
    options: THINKING_TOKEN_BUDGET_FIELDS,
    note: "Top-level field carrying the reasoning token cap."
  },
  {
    key: "vllmPriority",
    group: "misc",
    kind: "number",
    protocols: ["openai-completions"],
    note: "vLLM scheduler priority (needs --scheduling-policy priority)."
  },
  {
    key: "cacheControlFormat",
    group: "caching",
    kind: "enum",
    protocols: ["openai-completions"],
    options: CACHE_CONTROL_FORMATS,
    note: "Prompt-cache marker convention."
  },
  {
    key: "supportsStrictMode",
    group: "tools",
    kind: "boolean",
    protocols: ["openai-completions", "openai-responses"],
    note: "Whether tool definitions accept `strict`."
  },
  // -- OpenAI Responses --------------------------------------------------
  {
    key: "supportsMaxOutputTokens",
    group: "request",
    kind: "boolean",
    protocols: ["openai-responses"],
    note: "Whether `max_output_tokens` is accepted."
  },
  // -- Shared by every protocol -----------------------------------------
  {
    key: "supportsLongCacheRetention",
    group: "caching",
    kind: "boolean",
    protocols: ["openai-completions", "openai-responses", "anthropic-messages"],
    note: "Whether long (24h / 1h TTL) prompt cache retention is supported."
  },
  // -- Anthropic Messages ------------------------------------------------
  {
    key: "supportsEagerToolInputStreaming",
    group: "tools",
    kind: "boolean",
    protocols: ["anthropic-messages"],
    note: "Whether per-tool eager_input_streaming is accepted."
  },
  {
    key: "supportsCacheControlOnTools",
    group: "caching",
    kind: "boolean",
    protocols: ["anthropic-messages"],
    note: "Whether cache_control is accepted on tool definitions."
  },
  {
    key: "supportsTemperature",
    group: "request",
    kind: "boolean",
    protocols: ["anthropic-messages"],
    note: "Whether the temperature field is accepted."
  },
  {
    key: "forceAdaptiveThinking",
    group: "reasoning",
    kind: "boolean",
    protocols: ["anthropic-messages"],
    note: 'Force thinking.type "adaptive" plus output_config.effort.'
  },
  {
    key: "allowEmptySignature",
    group: "reasoning",
    kind: "boolean",
    protocols: ["anthropic-messages"],
    note: "Replay empty thinking signatures instead of converting to text."
  },
  {
    key: "supportsStrictTools",
    group: "tools",
    kind: "boolean",
    protocols: ["anthropic-messages"],
    note: "Whether Anthropic strict tool schemas are accepted."
  }
];
var COMPAT_FIELD_BY_KEY = new Map(
  COMPAT_FIELDS.map((field) => [field.key, field])
);
var RESERVED_HEADER_NAMES = ["user-agent"];
function isReservedHeader(name2) {
  return RESERVED_HEADER_NAMES.includes(name2.trim().toLowerCase());
}
function attributionUserAgent(version = VERIFIED_DSH_VERSION) {
  return `deepseek-harness/${version} (+https://github.com/deepseek-ai/deepseek-harness)`;
}

// src/shared/headers.ts
var TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
var SENSITIVE_EXACT = [
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "api-key",
  "apikey",
  "x-auth-token",
  "x-access-token",
  "cookie",
  "set-cookie"
];
var SENSITIVE_SUBSTRINGS = ["secret", "token", "password"];
function validateHeader(name2, value) {
  const trimmed = name2.trim();
  if (trimmed.length === 0) return { ok: false, code: "empty-name" };
  if (containsCrlf(trimmed)) return { ok: false, code: "crlf" };
  if (!TOKEN_RE.test(trimmed)) return { ok: false, code: "invalid-name" };
  if (containsCrlf(value)) return { ok: false, code: "crlf" };
  if (value.length === 0) return { ok: false, code: "empty-value" };
  return { ok: true };
}
function containsCrlf(value) {
  return value.includes("\r") || value.includes("\n");
}
function isSensitiveHeader(name2) {
  const lower = name2.trim().toLowerCase();
  if (SENSITIVE_EXACT.includes(lower)) return true;
  return SENSITIVE_SUBSTRINGS.some((needle) => lower.includes(needle));
}
function maskHeaderValue(value) {
  const spaceAt = value.indexOf(" ");
  const hasScheme = spaceAt > 0 && /^[A-Za-z]+$/.test(value.slice(0, spaceAt));
  const scheme = hasScheme ? value.slice(0, spaceAt + 1) : "";
  const secret = hasScheme ? value.slice(spaceAt + 1) : value;
  if (secret.length === 0) return `${scheme}****`;
  const tail = secret.length > 8 ? secret.slice(-4) : "";
  return `${scheme}****${tail}`;
}
function headerEntriesOf(record) {
  if (record === void 0 || record === null) return [];
  const seen = /* @__PURE__ */ new Map();
  const out = [];
  for (const [name2, raw] of Object.entries(record)) {
    if (typeof raw !== "string") continue;
    const lower = name2.toLowerCase();
    const at = seen.get(lower);
    if (at !== void 0) {
      out[at] = { name: name2, value: raw };
      continue;
    }
    seen.set(lower, out.length);
    out.push({ name: name2, value: raw });
  }
  return out;
}
function mergeHeaderLayers(layers) {
  const order = [];
  const byLower = /* @__PURE__ */ new Map();
  for (const layer of layers) {
    for (const entry of layer.headers) {
      const name2 = entry.name.trim();
      if (name2.length === 0) continue;
      const lower = name2.toLowerCase();
      const resolved = {
        name: name2,
        value: entry.value,
        source: layer.source,
        reserved: false
      };
      if (!byLower.has(lower)) order.push(lower);
      byLower.set(lower, resolved);
    }
  }
  return order.map((lower) => byLower.get(lower)).filter(Boolean);
}
function effectiveHeaders(layers, reservedNames) {
  const reserved = new Set(reservedNames.map((name2) => name2.toLowerCase()));
  return mergeHeaderLayers(layers).map((header) => ({
    ...header,
    reserved: reserved.has(header.name.toLowerCase())
  }));
}
function validateHeaderRecord(record) {
  if (record === void 0 || record === null) return [];
  const problems = [];
  for (const [name2, raw] of Object.entries(record)) {
    const value = typeof raw === "string" ? raw : "";
    const result = validateHeader(name2, value);
    if (!result.ok) problems.push({ name: name2, code: result.code });
  }
  return problems;
}

// src/host/header-resolver.ts
function harnessHeaderLayer(version) {
  return {
    source: "harness",
    headers: [{ name: "user-agent", value: attributionUserAgent(version) }]
  };
}
function globalHeaderEntries(settings) {
  const record = settings?.globalHeaders;
  if (record === void 0 || record === null) return [];
  return headerEntriesOf(record).filter((entry) => validateHeader(entry.name, entry.value).ok);
}
function providerHeaderEntries(section, providerId) {
  const profile = section?.providers?.[providerId];
  return headerEntriesOf(profile?.headers).filter((entry) => validateHeader(entry.name, entry.value).ok);
}
function resolveEffectiveHeaders(options) {
  return effectiveHeaders(
    [
      harnessHeaderLayer(options.harnessVersion),
      { source: "global", headers: globalHeaderEntries(options.settings) },
      { source: "provider", headers: providerHeaderEntries(options.section, options.providerId) }
    ],
    RESERVED_HEADER_NAMES
  );
}
function headerAdvisories(providerHeaders, credentialRef) {
  const advisories = [];
  for (const header of providerHeaders) {
    const lower = header.name.toLowerCase();
    if (isReservedHeader(header.name)) {
      advisories.push({ code: "reserved-provider-header", name: header.name });
      continue;
    }
    if ((lower === "authorization" || lower === "x-api-key") && credentialRef !== void 0) {
      advisories.push({ code: "authorization-with-credential", name: header.name });
    }
  }
  return advisories;
}
function providerSectionOf(resolved) {
  if (resolved === void 0 || resolved === null || typeof resolved !== "object") return void 0;
  const providers = resolved.providers;
  if (providers === void 0 || providers === null || typeof providers !== "object") {
    return { providers: {} };
  }
  return { providers };
}

// src/host/header-runtime.ts
import { AsyncLocalStorage } from "node:async_hooks";
var BRIDGE_MARK = Symbol.for("dsh-advanced-provider-settings.header-bridge/v1");
var HeaderRuntime = class {
  storage = new AsyncLocalStorage();
  /** Header applications observed, for diagnostics only. Never values. */
  applied = 0;
  /** Whether the wrapper is currently installed by this runtime. */
  installed = false;
  /**
   * Install the fetch wrapper, refcounted across plugin instances.
   * @returns a disposer that removes this installer's reference.
   */
  install() {
    const globalObject = globalThis;
    const current = globalObject.fetch;
    if (typeof current !== "function") {
      return () => {
      };
    }
    const existing = current[BRIDGE_MARK];
    const bridge = existing ?? {
      base: current,
      wrapper: current,
      runtimes: /* @__PURE__ */ new Set(),
      refs: 0
    };
    if (existing === void 0) {
      bridge.wrapper = createWrapper(bridge);
      Object.defineProperty(bridge.wrapper, BRIDGE_MARK, {
        value: bridge,
        enumerable: false,
        // Deletable so the last disposer can leave no trace on the function it
        // replaced; a non-configurable marker would outlive the plugin.
        configurable: true
      });
      globalObject.fetch = bridge.wrapper;
      bridge.refs = 0;
    }
    bridge.runtimes.add(this);
    bridge.refs += 1;
    this.installed = true;
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      this.installed = false;
      bridge.runtimes.delete(this);
      bridge.refs -= 1;
      if (bridge.refs <= 0 && globalObject.fetch === bridge.wrapper) {
        globalObject.fetch = bridge.base;
        if (bridge.wrapper !== void 0) {
          delete bridge.wrapper[BRIDGE_MARK];
        }
      }
    };
  }
  /**
   * Run one LLM request with its global headers in scope.
   *
   * @param context - provider/model identity and the validated headers.
   * @param body - the operation whose async continuations must see them.
   * @returns whatever `body` returns.
   */
  run(context, body) {
    if (context.headers.length === 0) return body();
    return this.storage.run(context, body);
  }
  /**
   * Wrap one adapter stream so every iteration step runs inside this runtime's
   * scope.
   *
   * Re-entering the scope around each `next()` is what makes the scope survive:
   * the adapter opens its HTTP request lazily on the first pull, and a plain
   * `storage.run(…, () => iterator)` would leave the later pulls outside the
   * context.
   *
   * @param context - the request's header context.
   * @param source - the adapter's async iterable.
   * @returns an equivalent iterable whose pulls are scoped.
   */
  scopedStream(context, source) {
    if (context.headers.length === 0) return source;
    const storage = this.storage;
    return {
      [Symbol.asyncIterator]() {
        const inner = source[Symbol.asyncIterator]();
        return {
          next: () => storage.run(context, () => inner.next()),
          return: (value) => typeof inner.return === "function" ? storage.run(context, () => inner.return(value)) : Promise.resolve({ done: true, value }),
          throw: (error) => typeof inner.throw === "function" ? storage.run(context, () => inner.throw(error)) : Promise.reject(error)
        };
      }
    };
  }
  /** Current scope, for the wrapper and for tests. */
  peek() {
    return this.storage.getStore();
  }
  /** Whether the wrapper is installed by this runtime. */
  get isInstalled() {
    return this.installed;
  }
  /** How many requests had headers applied, for diagnostics. */
  get appliedCount() {
    return this.applied;
  }
  /** Record one applied request. Called by the wrapper. */
  noteApplied() {
    this.applied += 1;
  }
};
function createWrapper(bridge) {
  const wrapper = function fetchWithGlobalHeaders(input, init) {
    let context;
    let owner;
    for (const runtime of bridge.runtimes) {
      const candidate = runtime.peek();
      if (candidate === void 0) continue;
      context = candidate;
      owner = runtime;
      break;
    }
    if (context === void 0 || owner === void 0 || context.headers.length === 0) {
      return bridge.base(input, init);
    }
    let scoped;
    try {
      scoped = withHeaders(input, init, context.headers);
    } catch {
      return bridge.base(input, init);
    }
    owner.noteApplied();
    return bridge.base(scoped.input, scoped.init);
  };
  return wrapper;
}
function withHeaders(input, init, headers) {
  const target = new Headers(requestHeadersOf(input, init));
  for (const header of headers) {
    if (!validateHeader(header.name, header.value).ok) continue;
    if (isReservedHeader(header.name) || !target.has(header.name)) {
      target.set(header.name, header.value);
    }
  }
  return { input, init: { ...init, headers: target } };
}
function requestHeadersOf(input, init) {
  if (init?.headers !== void 0) return new Headers(init.headers);
  if (typeof Request !== "undefined" && input instanceof Request) return new Headers(input.headers);
  return new Headers();
}

// src/host/provider-config.ts
function readOwnSettings(settings) {
  const value = settings.get(PLUGIN_NAMESPACE);
  if (value === void 0 || value === null || typeof value !== "object") return void 0;
  return value;
}
function readProviderSection(settings) {
  return providerSectionOf(settings.get(PROVIDER_NAMESPACE));
}
function listHostProviders(section) {
  const providers = section?.providers ?? {};
  return Object.entries(providers).map(([providerId, profile]) => ({
    providerId,
    displayName: typeof profile?.displayName === "string" ? profile.displayName : providerId,
    profile: profile ?? {}
  }));
}

// src/host/diagnostics.ts
import { createRequire } from "node:module";
var VERSION_PROBE_PACKAGES = [
  "@deepseek-ai/dsh/package.json",
  "@deepseek-ai/dsh-llm-pi-ai/package.json",
  "@deepseek-ai/dsh-settings/package.json"
];
function detectDshVersion() {
  try {
    const require2 = createRequire(import.meta.url);
    for (const specifier of VERSION_PROBE_PACKAGES) {
      try {
        const manifest = require2(specifier);
        if (typeof manifest.version === "string" && manifest.version.length > 0) return manifest.version;
      } catch {
        continue;
      }
    }
  } catch {
    return void 0;
  }
  return void 0;
}
function isPackageInstalled(specifier) {
  try {
    createRequire(import.meta.url)(specifier);
    return true;
  } catch {
    return false;
  }
}
function buildDiagnostics(input) {
  const detected = detectDshVersion();
  const probes = [
    {
      key: "dshVersion",
      state: detected === void 0 ? "unknown" : "ok",
      detail: detected ?? "unresolved"
    },
    {
      key: "settingsNamespace",
      state: input.namespaces.includes(PLUGIN_NAMESPACE) ? "ok" : "missing",
      detail: PLUGIN_NAMESPACE
    },
    {
      key: "providerNamespace",
      state: input.namespaces.includes(PROVIDER_NAMESPACE) ? "ok" : "missing",
      detail: PROVIDER_NAMESPACE
    },
    { key: "settingsRevision", state: input.revisionSupported ? "ok" : "unknown" },
    { key: "settingsWritable", state: input.writable ? "ok" : "missing" },
    { key: "headerRuntime", state: input.headerRuntimeActive ? "ok" : "missing", detail: String(input.headerRuntimeApplied) },
    { key: "settingsRoutes", state: input.routesRegistered ? "ok" : "missing" },
    {
      key: "modelsExtensionPackage",
      state: isPackageInstalled("@deepseek-ai/dsh-client-ui-settings-models/package.json") ? "ok" : "missing",
      detail: "@deepseek-ai/dsh-client-ui-settings-models"
    },
    {
      key: "legacyNamespace",
      state: input.namespaces.includes(LEGACY_NAMESPACE) ? "ok" : "missing",
      detail: LEGACY_NAMESPACE
    },
    {
      key: "legacyPlugin",
      state: isPackageInstalled("dsh-custom-provider-settings/package.json") ? "ok" : "missing",
      detail: "dsh-custom-provider-settings"
    }
  ];
  return {
    pluginVersion: input.pluginVersion,
    verifiedDshVersion: VERIFIED_DSH_VERSION,
    ...detected === void 0 ? {} : { detectedDshVersion: detected },
    probes,
    reservedHeaders: [...RESERVED_HEADER_NAMES]
  };
}

// src/host/discovery.ts
var MAX_MESSAGE_CHARS = 240;
function discoveryHeaders(globalHeaders, draftHeaders) {
  return mergeHeaderLayers([
    { source: "global", headers: globalHeaders },
    { source: "provider", headers: draftHeaders }
  ]).map((header) => ({ name: header.name, value: header.value }));
}
async function runDiscovery(options) {
  const context = {
    provider: options.providerId,
    model: "",
    headers: options.headers
  };
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 2e4;
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const startedAt = Date.now();
  try {
    const models = await options.run(
      context,
      () => options.llm.discoverModels(PROVIDER_NAMESPACE, options.request, controller.signal)
    );
    return {
      ok: true,
      modelCount: Array.isArray(models) ? models.length : 0,
      elapsedMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      ok: false,
      modelCount: 0,
      elapsedMs: Date.now() - startedAt,
      ...failureFacts(error)
    };
  } finally {
    clearTimeout(timer);
  }
}
function failureFacts(error) {
  if (error === null || typeof error !== "object") {
    return { message: "provider request failed" };
  }
  const record = error;
  const facts = {};
  if (typeof record.code === "string" && record.code.length > 0) facts.errorCode = record.code.slice(0, 64);
  if (typeof record.status === "number" && Number.isFinite(record.status)) facts.status = record.status;
  if (typeof record.message === "string" && record.message.length > 0) {
    facts.message = sanitizeMessage(record.message);
  }
  return facts;
}
function sanitizeMessage(message) {
  const singleLine = message.replace(/[\r\n]+/g, " ").trim();
  if (singleLine.length <= MAX_MESSAGE_CHARS) return singleLine;
  return `${singleLine.slice(0, MAX_MESSAGE_CHARS)}\u2026`;
}

// src/host/guard.ts
var MAX_BODY_BYTES = 128 * 1024;
function guardRequest(method, headers, peerAddress) {
  if (!isLoopback(peerAddress)) return { ok: false, status: 403, reason: "non-loopback peer" };
  const host = firstHeader(headers.host);
  if (host !== void 0 && !isLoopbackHost(host)) {
    return { ok: false, status: 403, reason: "non-loopback host" };
  }
  const site = firstHeader(headers["sec-fetch-site"]);
  if (site !== void 0 && site === "cross-site") {
    return { ok: false, status: 403, reason: "cross-site request" };
  }
  const origin = firstHeader(headers.origin);
  if (origin !== void 0 && !isSameOrigin(origin, host)) {
    return { ok: false, status: 403, reason: "origin mismatch" };
  }
  if (method !== "POST") return { ok: true };
  const contentType = firstHeader(headers["content-type"]) ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, reason: "json content type required" };
  }
  return { ok: true };
}
function isLoopback(address) {
  if (address === void 0 || address.length === 0) return false;
  const normalized = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  return normalized === "::1" || normalized === "127.0.0.1" || normalized.startsWith("127.");
}
function isLoopbackHost(host) {
  const name2 = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name2 === "localhost" || name2 === "127.0.0.1" || name2 === "::1" || name2.startsWith("127.");
}
function isSameOrigin(origin, host) {
  if (host === void 0) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}
function firstHeader(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

// src/host/migration.ts
function inspectLegacy(options) {
  const namespaceDetected = options.namespaces.includes(LEGACY_NAMESPACE);
  const raw = extractGlobalHeaders(options.legacyValue);
  const globalHeaders = {};
  let rejectedCount = 0;
  for (const entry of headerEntriesOf(raw)) {
    if (validateHeader(entry.name, entry.value).ok) globalHeaders[entry.name] = entry.value;
    else rejectedCount += 1;
  }
  return {
    namespaceDetected,
    packageInstalled: options.packageInstalled,
    bothActive: namespaceDetected && options.namespaces.includes(PLUGIN_NAMESPACE),
    globalHeaders,
    rejectedCount
  };
}
function extractGlobalHeaders(value) {
  if (value === void 0 || value === null || typeof value !== "object") return void 0;
  const headers = value.globalHeaders;
  if (headers === void 0 || headers === null || typeof headers !== "object") return void 0;
  return headers;
}
function hasImportableHeaders(snapshot) {
  return snapshot.namespaceDetected && Object.keys(snapshot.globalHeaders).length > 0;
}

// src/shared/retry.ts
var MAX_TIMER_DELAY_MS = 2147483647;
var DEFAULT_RETRYABLE_CODES = [
  "EMPTY_RESPONSE",
  "RATE_LIMIT",
  "SERVER",
  "TIMEOUT",
  "TRANSPORT"
];
var RETRY_DEFAULTS = {
  mode: "normal",
  maxRetries: 5,
  retryableCodes: [...DEFAULT_RETRYABLE_CODES],
  initialDelayMs: 500,
  maxDelayMs: 1e4,
  jitterRatio: 0.1
};
var RETRY_PRESETS = [
  { id: "harness-default", policy: null },
  {
    id: "conservative",
    policy: {
      mode: "normal",
      maxRetries: 3,
      retryableCodes: [...DEFAULT_RETRYABLE_CODES],
      backoff: { initialDelayMs: 1e3, maxDelayMs: 1e4, jitterRatio: 0.1 }
    }
  },
  {
    id: "aggressive",
    policy: {
      mode: "normal",
      maxRetries: 10,
      retryableCodes: [...DEFAULT_RETRYABLE_CODES],
      backoff: { initialDelayMs: 1e3, maxDelayMs: 3e4, jitterRatio: 0.2 }
    }
  }
];
function validateRetryPolicy(policy) {
  const issues = [];
  if (typeof policy !== "object" || policy === null || Array.isArray(policy)) {
    return [{ field: "", code: "mode-invalid" }];
  }
  const record = policy;
  if (record.mode === void 0) issues.push({ field: "mode", code: "mode-required" });
  else if (record.mode !== "normal" && record.mode !== "always") {
    issues.push({ field: "mode", code: "mode-invalid" });
  }
  const mode = record.mode === "always" ? "always" : "normal";
  if (mode === "normal") {
    const maxRetries = record.maxRetries;
    if (maxRetries !== void 0) {
      if (typeof maxRetries !== "number" || !Number.isSafeInteger(maxRetries)) {
        issues.push({ field: "maxRetries", code: "max-retries-not-integer" });
      } else if (maxRetries < 0) {
        issues.push({ field: "maxRetries", code: "max-retries-negative" });
      }
    }
    const codes = record.retryableCodes;
    if (codes !== void 0) {
      if (!Array.isArray(codes) || codes.length === 0) {
        issues.push({ field: "retryableCodes", code: "codes-empty" });
      } else if (codes.some((code) => typeof code !== "string" || code.length === 0)) {
        issues.push({ field: "retryableCodes", code: "codes-not-string" });
      } else if (new Set(codes).size !== codes.length) {
        issues.push({ field: "retryableCodes", code: "codes-duplicate" });
      }
    }
  }
  const backoff = record.backoff;
  if (backoff !== void 0 && backoff !== null) {
    if (typeof backoff !== "object" || Array.isArray(backoff)) {
      issues.push({ field: "backoff", code: "backoff-initial-invalid" });
      return issues;
    }
    const values = backoff;
    const initial = values.initialDelayMs;
    const max = values.maxDelayMs;
    const jitter = values.jitterRatio;
    const initialOk = validDelay(initial);
    const maxOk = validDelay(max);
    if (!initialOk) issues.push({ field: "backoff.initialDelayMs", code: "backoff-initial-invalid" });
    if (!maxOk) issues.push({ field: "backoff.maxDelayMs", code: "backoff-max-invalid" });
    if (initialOk && maxOk && initial > max) {
      issues.push({ field: "backoff.maxDelayMs", code: "backoff-initial-exceeds-max" });
    }
    if (jitter !== void 0) {
      if (typeof jitter !== "number" || !Number.isFinite(jitter)) {
        issues.push({ field: "backoff.jitterRatio", code: "jitter-not-finite" });
      } else if (jitter < 0 || jitter > 1) {
        issues.push({ field: "backoff.jitterRatio", code: "jitter-out-of-range" });
      }
    }
  }
  return issues;
}
function validDelay(value) {
  if (value === void 0) return true;
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_TIMER_DELAY_MS;
}
var HARNESS_DEFAULT_POLICY = {
  mode: "normal",
  maxRetries: RETRY_DEFAULTS.maxRetries,
  retryableCodes: [...DEFAULT_RETRYABLE_CODES],
  backoff: {
    initialDelayMs: RETRY_DEFAULTS.initialDelayMs,
    maxDelayMs: RETRY_DEFAULTS.maxDelayMs,
    jitterRatio: RETRY_DEFAULTS.jitterRatio
  }
};

// src/shared/vision.ts
var UNIT_FACTOR = {
  B: 1,
  KiB: 1024,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024
};
var IMAGE_LIMIT_DEFAULTS = {
  /** Accumulated payload across one request. 20 MiB. */
  maxRequestImageBytes: 20 * 1024 * 1024,
  /** Pixel budget for one image. 2048 x 2048. */
  requestImagePixelBudget: 2048 * 2048,
  /** Encoded target size for one image. 1 MiB. */
  requestImageMaxBytes: 1024 * 1024
};
function validateImageLimit(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return "not-positive-integer";
  if (!Number.isSafeInteger(value)) return "not-safe-integer";
  return null;
}
function validateModalities(value) {
  if (!Array.isArray(value)) return "not-array";
  if (value.length === 0) return "empty";
  for (const item of value) {
    if (!MODALITIES.includes(item)) return "unknown-modality";
  }
  return null;
}

// src/host/validation.ts
var POSITIVE_INTEGER_FIELDS = ["timeoutMs", "websocketConnectTimeoutMs"];
function validateProviderDraft(profile) {
  const issues = [];
  if (profile.api !== void 0 && !isProtocolId(profile.api)) {
    issues.push({ field: "api", code: "protocol-unknown", detail: String(profile.api) });
  }
  issues.push(...validateHeaderIssues(profile.headers));
  if (profile.defaultInput !== void 0) {
    const problem = validateModalities(profile.defaultInput);
    if (problem !== null) issues.push({ field: "defaultInput", code: `modalities-${problem}` });
  }
  if (profile.reasoning !== void 0 && !THINKING_LEVELS.includes(profile.reasoning)) {
    issues.push({ field: "reasoning", code: "thinking-level-unknown", detail: String(profile.reasoning) });
  }
  if (profile.thinkingBudgets !== void 0) {
    for (const [level, value] of Object.entries(profile.thinkingBudgets)) {
      if (!["minimal", "low", "medium", "high"].includes(level)) {
        issues.push({ field: `thinkingBudgets.${level}`, code: "thinking-budget-unknown-level" });
        continue;
      }
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        issues.push({ field: `thinkingBudgets.${level}`, code: "thinking-budget-invalid" });
      }
    }
  }
  for (const field of POSITIVE_INTEGER_FIELDS) {
    const value = profile[field];
    if (value === void 0) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      issues.push({ field, code: "natural-number-required" });
    }
  }
  if (profile.streamIdleTimeoutMs !== void 0) {
    const value = profile.streamIdleTimeoutMs;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 2147483647) {
      issues.push({ field: "streamIdleTimeoutMs", code: "positive-delay-required" });
    }
  }
  for (const field of ["maxRequestImageBytes", "requestImagePixelBudget", "requestImageMaxBytes"]) {
    const value = profile[field];
    if (value === void 0) continue;
    const problem = validateImageLimit(value);
    if (problem !== null) issues.push({ field, code: `image-limit-${problem}` });
  }
  if (profile.retryPolicy !== void 0) {
    for (const issue of validateRetryPolicy(profile.retryPolicy)) {
      issues.push({ field: issue.field === "" ? "retryPolicy" : `retryPolicy.${issue.field}`, code: issue.code });
    }
  }
  issues.push(...validateCompatIssues(profile.compat, "compat", profile.api));
  const models = Array.isArray(profile.models) ? profile.models : [];
  models.forEach((model, index) => {
    if (model.input !== void 0) {
      const problem = validateModalities(model.input);
      if (problem !== null) issues.push({ field: `models.${String(index)}.input`, code: `modalities-${problem}` });
    }
    if (model.reasoningEfforts !== void 0 && model.reasoningEfforts !== false) {
      const efforts = model.reasoningEfforts;
      if (typeof efforts !== "object" || efforts === null || Array.isArray(efforts)) {
        issues.push({ field: `models.${String(index)}.reasoningEfforts`, code: "reasoning-efforts-shape" });
      } else {
        for (const [level, wire] of Object.entries(efforts)) {
          if (!THINKING_LEVELS.includes(level)) {
            issues.push({
              field: `models.${String(index)}.reasoningEfforts.${level}`,
              code: "thinking-level-unknown",
              detail: level
            });
          }
          if (wire !== null && typeof wire !== "string") {
            issues.push({
              field: `models.${String(index)}.reasoningEfforts.${level}`,
              code: "reasoning-effort-wire-type"
            });
          }
        }
      }
    }
    issues.push(...validateCompatIssues(model.compat, `models.${String(index)}.compat`, profile.api));
  });
  return issues;
}
function validateHeaderIssues(headers) {
  return validateHeaderRecord(headers).map((problem) => ({
    field: `headers.${problem.name}`,
    code: `header-${problem.code}`
  }));
}
function validateCompatIssues(compat, prefix, protocol) {
  if (compat === void 0 || compat === null || typeof compat !== "object") return [];
  const issues = [];
  for (const [key, value] of Object.entries(compat)) {
    const definition = COMPAT_FIELD_BY_KEY.get(key);
    if (definition === void 0) {
      issues.push({ field: `${prefix}.${key}`, code: "compat-unknown-field", detail: key });
      continue;
    }
    if (protocol !== void 0 && !definition.protocols.includes(protocol)) {
      issues.push({ field: `${prefix}.${key}`, code: "compat-wrong-protocol", detail: protocol });
    }
    if (value === void 0 || value === null) continue;
    switch (definition.kind) {
      case "boolean":
        if (typeof value !== "boolean") issues.push({ field: `${prefix}.${key}`, code: "compat-boolean-required" });
        break;
      case "enum":
        if (typeof value !== "string" || !(definition.options ?? []).includes(value)) {
          issues.push({ field: `${prefix}.${key}`, code: "compat-enum-invalid", detail: String(value) });
        }
        break;
      case "number":
        if (typeof value !== "number" || !Number.isInteger(value)) {
          issues.push({ field: `${prefix}.${key}`, code: "compat-integer-required" });
        }
        break;
      case "dict":
        if (typeof value !== "object" || Array.isArray(value)) {
          issues.push({ field: `${prefix}.${key}`, code: "compat-dict-required" });
        }
        break;
    }
  }
  return issues;
}

// src/host/routes.ts
var ROUTE_PREFIX = "/dsh-advanced-provider-settings";
function createRpcHandler(deps) {
  return async (req, res) => {
    const path = pathOf(req.url);
    if (path === `${ROUTE_PREFIX}/health`) {
      sendJson(res, 200, { ok: true, plugin: PLUGIN_NAMESPACE, version: deps.pluginVersion });
      return;
    }
    if (path !== `${ROUTE_PREFIX}/rpc`) {
      sendJson(res, 404, { ok: false, code: "not-found" });
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, code: "method-not-allowed" });
      return;
    }
    const guard = guardRequest(req.method, req.headers, req.socket?.remoteAddress);
    if (!guard.ok) {
      sendJson(res, guard.status, { ok: false, code: "refused", error: guard.reason });
      return;
    }
    const raw = await readBody(req);
    if (raw === null) {
      sendJson(res, 413, { ok: false, code: "body-too-large" });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { ok: false, code: "invalid-json" });
      return;
    }
    try {
      const response = await dispatch(deps, parsed);
      sendJson(res, response.ok ? 200 : 400, response);
    } catch (error) {
      sendJson(res, 500, { ok: false, code: "internal", error: shortError(error) });
    }
  };
}
async function dispatch(deps, request) {
  const op = typeof request.op === "string" ? request.op : "";
  const payload = isRecord(request.payload) ? request.payload : {};
  switch (op) {
    case "diagnostics":
      return { ok: true, result: diagnosticsOf(deps) };
    case "providers":
      return { ok: true, result: providersOf(deps) };
    case "effective-headers":
      return { ok: true, result: effectiveHeadersOf(deps, payload) };
    case "validate":
      return { ok: true, result: validateOf(payload) };
    case "legacy":
      return { ok: true, result: legacyOf(deps) };
    case "discover":
      return { ok: true, result: await discoverOf(deps, payload) };
    default:
      return { ok: false, code: "unknown-op", error: `unknown op: ${op.slice(0, 32)}` };
  }
}
function diagnosticsOf(deps) {
  return {
    ...buildDiagnostics({
      pluginVersion: deps.pluginVersion,
      namespaces: deps.namespaces(),
      writable: deps.writable,
      revisionSupported: deps.revisionSupported,
      headerRuntimeActive: deps.headerRuntimeActive,
      headerRuntimeApplied: deps.headerRuntimeApplied(),
      routesRegistered: deps.routesRegistered()
    }),
    migrationAvailable: hasImportableHeaders(legacyOf(deps))
  };
}
function providersOf(deps) {
  return listHostProviders(deps.getProviderSection()).map((record) => ({
    providerId: record.providerId,
    displayName: record.displayName
  }));
}
function effectiveHeadersOf(deps, payload) {
  const providerId = typeof payload.providerId === "string" ? payload.providerId : "";
  const section = deps.getProviderSection();
  const effective = resolveEffectiveHeaders({
    settings: deps.getOwnSettings(),
    section,
    providerId
  });
  const advisories = headerAdvisories(
    effective.filter((header) => header.source === "provider").map((header) => ({ name: header.name, value: header.value })),
    section?.providers?.[providerId]?.apiKeyEnv
  );
  return {
    // Values are masked here rather than in the browser: a sensitive header's
    // value has no reason to travel to the page for a read-only preview
    // (spec sections 17, 52).
    headers: effective.map((header) => ({
      name: header.name,
      value: isSensitiveHeader(header.name) ? maskHeaderValue(header.value) : header.value,
      source: header.source,
      reserved: header.reserved,
      sensitive: isSensitiveHeader(header.name)
    })),
    advisories,
    attributionOverridden: effective.some((header) => header.source === "global" && header.reserved)
  };
}
function validateOf(payload) {
  const profile = isRecord(payload.profile) ? payload.profile : {};
  return { issues: validateProviderDraft(profile) };
}
function legacyOf(deps) {
  return inspectLegacy({
    namespaces: deps.namespaces(),
    legacyValue: deps.legacyValue(),
    packageInstalled: isPackageInstalled("dsh-custom-provider-settings/package.json")
  });
}
async function discoverOf(deps, payload) {
  const providerId = typeof payload.providerId === "string" ? payload.providerId : "";
  const draftHeaders = headerEntriesOfPayload(payload.headers);
  const request = {};
  if (providerId.length > 0) request.provider = providerId;
  if (typeof payload.baseURL === "string" && payload.baseURL.length > 0) request.baseURL = payload.baseURL;
  if (typeof payload.api === "string" && payload.api.length > 0) request.api = payload.api;
  const headers = discoveryHeaders(
    effectiveGlobalHeaders(deps),
    draftHeaders
  );
  const timeoutMs = typeof payload.timeoutMs === "number" && Number.isFinite(payload.timeoutMs) ? Math.min(Math.max(payload.timeoutMs, 1e3), 12e4) : void 0;
  return runDiscovery({
    llm: deps.llm,
    run: deps.runWithHeaders,
    providerId,
    request,
    headers,
    ...timeoutMs === void 0 ? {} : { timeoutMs }
  });
}
function effectiveGlobalHeaders(deps) {
  const settings = deps.getOwnSettings();
  const record = settings?.globalHeaders;
  if (record === void 0 || record === null) return [];
  return Object.entries(record).filter(([name2, value]) => typeof name2 === "string" && typeof value === "string").map(([name2, value]) => ({ name: name2, value }));
}
function headerEntriesOfPayload(value) {
  if (!isRecord(value)) return [];
  const entries = [];
  for (const [name2, headerValue] of Object.entries(value)) {
    if (typeof headerValue === "string") entries.push({ name: name2, value: headerValue });
  }
  return entries;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function pathOf(url) {
  try {
    return new URL(url ?? "/", "http://localhost").pathname;
  } catch {
    return "";
  }
}
function sendJson(res, status, body) {
  try {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    res.end(JSON.stringify(body));
  } catch {
  }
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", () => {
      resolve(null);
    });
  });
}
function shortError(error) {
  if (error instanceof Error) return error.message.slice(0, 200);
  return "unexpected failure";
}
function registerRoutes(webServer, deps, onRegistered) {
  const handler = createRpcHandler(deps);
  const dispose = webServer.register({ kind: "prefix", path: ROUTE_PREFIX, handler });
  onRegistered(true);
  return () => {
    onRegistered(false);
    dispose();
  };
}

// src/host/settings.ts
import z from "@deepseek-ai/schemastery";
var PluginSettingsSchema = z.object({
  globalHeaders: z.dict(z.string()).description("Headers applied to every provider request, below provider headers."),
  ui: z.object({
    advancedExpanded: z.boolean().description("Whether Advanced Settings starts expanded."),
    acknowledgedAlwaysRetry: z.boolean().description("Whether the Always-retry warning was accepted once.")
  }).description("Interface preferences. Never provider configuration."),
  migration: z.object({
    globalHeaders: z.union([z.const("imported"), z.const("ignored")]).description("Outcome of the legacy-plugin header migration."),
    decidedAt: z.string().description("ISO timestamp of the migration decision.")
  }).description("How far the retired plugin migration got.")
});
function registerOwnSettings(settings) {
  const scope = settings.register(PLUGIN_NAMESPACE, PluginSettingsSchema);
  const descriptor = () => settings.describe().find((candidate) => candidate.ns === PLUGIN_NAMESPACE);
  const userLayer = () => {
    const user = descriptor()?.user;
    if (user === void 0 || user === null || typeof user !== "object" || Array.isArray(user)) return void 0;
    return user;
  };
  const revision = () => {
    const value = descriptor()?.revision;
    return typeof value === "number" ? value : void 0;
  };
  return {
    get: () => scope.get() ?? {},
    watch: (callback) => scope.watch(callback),
    userLayer,
    revision
  };
}

// src/index.ts
var name = PLUGIN_NAMESPACE;
var inject = ["settings", "llm"];
function apply(rawContext) {
  const ctx = rawContext;
  const settings = ctx.settings;
  const llm = ctx.llm;
  const own = registerOwnSettings(settings);
  const runtime = new HeaderRuntime();
  ctx.effect(() => runtime.install(), "advanced-provider-settings: request-scoped header bridge");
  ctx.on("llm/stream", (options, next) => {
    const headers = globalHeaderEntries(own.get());
    if (headers.length === 0) return next();
    const context = {
      provider: typeof options?.provider === "string" ? options.provider : "",
      model: typeof options?.model === "string" ? options.model : "",
      headers
    };
    return runtime.run(context, () => runtime.scopedStream(context, next()));
  });
  if (settings.describe().some((descriptor) => descriptor.ns === "dsh-custom-provider-settings")) {
    ctx.logger.warn(
      "%s and dsh-custom-provider-settings are both installed; both inject request headers. Uninstall one to avoid duplicate headers.",
      PLUGIN_NAMESPACE
    );
  }
  let routesRegistered = false;
  const webServer = ctx.get("webServer");
  if (webServer !== void 0 && typeof webServer.register === "function") {
    const deps = {
      pluginVersion: PLUGIN_VERSION,
      getOwnSettings: () => readOwnSettings(settings),
      getProviderSection: () => readProviderSection(settings),
      namespaces: () => settings.describe().map((descriptor) => descriptor.ns),
      writable: settings.writable === true,
      revisionSupported: settings.describe().every((descriptor) => typeof descriptor.revision === "number"),
      headerRuntimeActive: runtime.isInstalled,
      headerRuntimeApplied: () => runtime.appliedCount,
      routesRegistered: () => routesRegistered,
      legacyValue: () => settings.get("dsh-custom-provider-settings"),
      llm,
      runWithHeaders: (context, body) => runtime.run(context, body)
    };
    ctx.effect(
      () => registerRoutes(webServer, deps, (registered) => {
        routesRegistered = registered;
      }),
      "advanced-provider-settings: settings RPC routes"
    );
  }
}
var namespaces = { own: PLUGIN_NAMESPACE, providers: PROVIDER_NAMESPACE };
export {
  apply,
  inject,
  name,
  namespaces
};
//# sourceMappingURL=index.js.map
