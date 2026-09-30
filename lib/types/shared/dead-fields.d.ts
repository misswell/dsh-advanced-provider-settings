/**
 * Dead provider fields: keys a profile may carry that DSH reads but ignores.
 *
 * The settings schema passes unknown keys through (`Dict` extension), so a
 * hand-edited patch file or an older tool can store fields that never reach
 * the wire — silently. Each entry here names one such key and why it is dead,
 * so the editor can say so instead of letting the user believe it works.
 *
 * The list is deliberately tiny: only keys whose deadness is certain belong
 * here. A key a FUTURE DSH might read must not be added, or the warning would
 * lie about a working configuration.
 */
/** Machine-readable reason a field is dead, for locale lookup. */
export type DeadFieldCode = 'dead-user-agent';
/** One dead key and the reason code that explains it. */
export interface DeadField {
    /** The provider-profile key, verbatim as it is stored. */
    field: string;
    /** Why the key does nothing, resolved to copy by the caller. */
    code: DeadFieldCode;
}
/**
 * Every known-dead provider key, in display order.
 *
 * `userAgent` is the one certain case: it has never been in the
 * `llm-pi-ai` schema, and a provider-level `user-agent` header would be
 * stripped by DSH's reserved-name filter anyway — Harness attribution wins
 * that name on every request. The working channels are this plugin's global
 * headers (applied by its own transport wrapper, after DSH builds its header
 * set) or a non-reserved provider header.
 */
export declare const DEAD_PROVIDER_FIELDS: readonly DeadField[];
/**
 * Which known-dead keys a profile carries.
 * @param profile - the profile as read from the user layer.
 * @returns the dead keys present, in display order.
 */
export declare function findDeadFields(profile: {
    [key: string]: unknown;
}): DeadField[];
