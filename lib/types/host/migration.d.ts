/** What the host observed about the legacy plugin. */
export interface LegacySnapshot {
    /** Whether the legacy namespace is served by the settings document. */
    namespaceDetected: boolean;
    /** Whether the legacy plugin package is installed. */
    packageInstalled: boolean;
    /** Whether both plugins are active at once — the duplicate-header hazard. */
    bothActive: boolean;
    /** The legacy header mapping, already validated, ready to import. */
    globalHeaders: Record<string, string>;
    /** How many legacy headers were discarded as invalid. */
    rejectedCount: number;
}
/**
 * Read the legacy namespace out of the settings document.
 * @param options - resolved namespaces and the legacy value.
 * @returns the snapshot the migration prompt renders from.
 */
export declare function inspectLegacy(options: {
    namespaces: readonly string[];
    legacyValue: unknown;
    packageInstalled: boolean;
}): LegacySnapshot;
/**
 * Whether there is anything worth importing.
 * @param snapshot - the legacy snapshot.
 * @returns whether the migration prompt should be offered.
 */
export declare function hasImportableHeaders(snapshot: LegacySnapshot): boolean;
/**
 * Build the operations that import the legacy headers without disturbing
 * headers the user has already set in this plugin.
 *
 * An existing key in the new namespace wins, so a user who configured both
 * plugins keeps the configuration they made most recently.
 *
 * @param existing - this plugin's current global headers.
 * @param incoming - the legacy mapping.
 * @returns path-addressed operations against the plugin namespace.
 */
export declare function buildImportOps(existing: Record<string, string>, incoming: Record<string, string>): {
    op: 'set';
    path: string[];
    value: string;
}[];
