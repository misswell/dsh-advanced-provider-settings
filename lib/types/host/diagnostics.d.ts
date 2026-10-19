/** One probe's outcome. */
export interface DiagnosticProbe {
    /** Stable key the client resolves through its locale files. */
    key: string;
    /** `ok`, `missing` or `unknown`. */
    state: 'ok' | 'missing' | 'unknown';
    /** Small, safe detail string — never a path from the user's home directory. */
    detail?: string;
}
/** Everything the host half can report about compatibility. */
export interface DiagnosticsReport {
    pluginVersion: string;
    /** Every build the capability table was verified against, oldest first. */
    verifiedDshVersions: readonly string[];
    detectedDshVersion?: string;
    probes: DiagnosticProbe[];
    reservedHeaders: readonly string[];
}
/**
 * Pull the version segment out of launch-path entries.
 *
 * The module-resolution probes below answer "which @deepseek-ai copy does THIS
 * module see" — and that can differ from the running build, because a profile
 * is linked into a hoisted `node_modules` whose `@deepseek-ai` entries are
 * symlinks to whichever runtime was current when it was installed (observed:
 * 0.1.5-rc.2 links while 0.2.0-rc.2 runs). The harness process itself is
 * launched from the runtime directory, so its command line names the true
 * version.
 *
 * Exported as a pure function so tests can feed argv shapes without touching
 * the runner's own process state.
 *
 * @param entries - candidate path strings (execPath + argv), any values.
 * @returns the version segment, or undefined when no entry matches.
 */
export declare function versionFromLaunchPath(entries: readonly unknown[]): string | undefined;
/**
 * Find the bundled runtime root in launch-path entries.
 *
 * @param entries - candidate path strings (execPath + argv), any values.
 * @returns the `app.asar/dsh` root, or undefined when the app is not bundled.
 */
export declare function appRuntimeRootFromLaunchPath(entries: readonly unknown[]): string | undefined;
/**
 * Read the version out of a bundled runtime root.
 *
 * `desktop-runtime.json` is the app's own release manifest and names the exact
 * build it shipped; the package manifest is the fallback for a runtime tree
 * laid out without it (the `dsh` CLI installed from npm, for instance).
 *
 * Both reads are best-effort: a runtime that cannot answer is a diagnostic
 * detail, not a reason to throw.
 *
 * @param root - directory containing the bundled runtime.
 * @returns the version string, or undefined when neither manifest is readable.
 */
export declare function versionFromRuntimeRoot(root: string): string | undefined;
export declare function versionFromEnvironment(value: string | undefined): string | undefined;
/**
 * Best-effort read of the running DSH version.
 *
 * Signals are tried from most to least truthful: the launch path of the old
 * Desk runtime, the bundled runtime manifest of the 0.2.1+ app, the desktop
 * host's `DSH_CLIENT_VERSION`, then the module-resolution probes. The value is
 * advisory: it feeds a diagnostic line and the compatibility matrix, and
 * nothing branches on it. A failure returns undefined rather than throwing,
 * because a plugin that cannot report a version is still useful.
 *
 * @returns the version string, or undefined when it cannot be read.
 */
export declare function detectDshVersion(): string | undefined;
/**
 * Whether the models-page extension package is installed. Resolved through a
 * literal specifier: the candidate is compile-time knowledge, and a variable
 * require is an injection-shaped call.
 */
export declare function isModelsExtensionInstalled(): boolean;
/**
 * Whether the retired community plugin is still installed beside this one.
 * Resolved through a literal specifier for the same reason.
 */
export declare function isLegacyPluginInstalled(): boolean;
/**
 * Whether the 0.2.0 retry executor is installed.
 *
 * Since DSH 0.2.0 the `retryPolicy` each provider route declares is EXECUTED by
 * the optional `dsh-llm-retry` plugin on the agent loop's request-recovery
 * extension point; the adapter only resolves the policy. Standard
 * compositions (`dsh-sdk-minimal`) include it, but a minimal composition
 * without it leaves every configured policy inert — which looks exactly like a
 * plugin bug, so the diagnostics name the executor rather than stay silent.
 * Resolved through a literal specifier, like every probe here.
 */
export declare function isRetryExecutorInstalled(): boolean;
/** Inputs the host half can observe cheaply. */
export interface DiagnosticsInput {
    pluginVersion: string;
    /** Namespaces the settings service currently serves. */
    namespaces: readonly string[];
    /** Whether the settings document accepts writes. */
    writable: boolean;
    /** Whether any descriptor carried a revision number. */
    revisionSupported: boolean;
    /** Whether the request-scoped header bridge installed its fetch wrapper. */
    headerRuntimeActive: boolean;
    /** Requests the bridge has applied headers to. */
    headerRuntimeApplied: number;
    /** Whether the web-server route table accepted our routes. */
    routesRegistered: boolean;
}
/**
 * Assemble the diagnostics report.
 * @param input - the observed host facts.
 * @returns the report the settings panel renders.
 */
export declare function buildDiagnostics(input: DiagnosticsInput): DiagnosticsReport;
