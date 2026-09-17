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
    verifiedDshVersion: string;
    detectedDshVersion?: string;
    probes: DiagnosticProbe[];
    reservedHeaders: readonly string[];
}
/**
 * Best-effort read of the running DSH version.
 *
 * The value is advisory: it feeds a diagnostic line and the compatibility
 * matrix, and nothing branches on it. A failure returns undefined rather than
 * throwing, because a plugin that cannot report a version is still useful.
 *
 * @returns the version string, or undefined when it cannot be read.
 */
export declare function detectDshVersion(): string | undefined;
/**
 * Whether a package is installed and resolvable from the plugin.
 * @param specifier - a `package.json` specifier to resolve.
 * @returns whether resolution succeeded.
 */
export declare function isPackageInstalled(specifier: string): boolean;
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
