/**
 * Request-header algebra: validation, case-insensitive layering, sensitivity
 * classification and masking. Pure and Harness-free so every rule here is
 * unit-testable without booting DSH (spec sections 13, 18, 19, 65).
 *
 * Precedence, lowest to highest: Harness attribution → plugin global headers →
 * provider headers. A later layer's header REPLACES an earlier one that differs
 * only in case, so the wire never carries two spellings of one field name.
 */
/** One header field. */
export interface HeaderEntry {
    /** Field name, original casing preserved. */
    name: string;
    /** Field value. */
    value: string;
}
/** Which layer supplied a header. */
export type HeaderSource = 'harness' | 'global' | 'provider';
/** One effective header after layering. */
export interface ResolvedHeader extends HeaderEntry {
    /** The layer that won this field name. */
    source: HeaderSource;
    /** Whether Harness attribution overwrites this name on the wire. */
    reserved: boolean;
}
/** One layer's contribution. */
export interface HeaderLayer {
    source: HeaderSource;
    headers: readonly HeaderEntry[];
}
/** Machine-readable reason a header was rejected, for locale lookup. */
export type HeaderErrorCode = 'empty-name' | 'invalid-name' | 'crlf' | 'empty-value';
/** Validation outcome for one header. */
export type HeaderValidation = {
    ok: true;
} | {
    ok: false;
    code: HeaderErrorCode;
};
/**
 * Validate one header field name and value against the rules Fetch enforces.
 *
 * Rejects the two injection vectors explicitly (spec section 18): a name
 * outside the token grammar, and CR/LF anywhere in name or value. The empty
 * name and empty value are rejected too — DSH's own guard (`assertValidHeaders`)
 * builds a `Headers` instance, and an empty name throws there.
 *
 * @param name - candidate field name.
 * @param value - candidate field value.
 * @returns `{ok:true}` or the first failure found.
 */
export declare function validateHeader(name: string, value: string): HeaderValidation;
/**
 * Whether a header name carries a credential, so its value must be masked in
 * every preview, log line and export (spec sections 17, 19, 42, 52).
 * @param name - header field name, any case.
 * @returns whether the value is sensitive.
 */
export declare function isSensitiveHeader(name: string): boolean;
/**
 * Mask a credential-bearing value for display: keep a leading scheme word and
 * the last four characters, star out the middle.
 *
 * `Bearer sk-abcdef12345691ab` → `Bearer sk-****91ab`
 * `sk-abcdef12345691ab`       → `****91ab`
 *
 * A value short enough that masking would hide nothing useful is returned
 * fully starred rather than partially revealed.
 *
 * @param value - the raw header value.
 * @returns the masked value.
 */
export declare function maskHeaderValue(value: string): string;
/**
 * Mask a value only when its name is sensitive.
 * @param name - header field name.
 * @param value - header field value.
 * @returns the display value.
 */
export declare function displayHeaderValue(name: string, value: string): string;
/**
 * Normalize a header record into entries, preserving order and casing while
 * dropping nothing. Duplicate names inside ONE layer keep the last occurrence —
 * a record cannot express a repeated field, and YAML mappings cannot either.
 * @param record - a `headers`-shaped mapping.
 * @returns entries in first-seen order with last-wins values.
 */
export declare function headerEntriesOf(record: Record<string, unknown> | undefined): HeaderEntry[];
/**
 * Fold header layers into the effective request headers.
 *
 * Later layers win by lowercased name; the winning entry keeps the casing of
 * the layer that supplied it, so `Global: User-Agent` overridden by
 * `Provider: user-agent` yields exactly one entry, spelled `user-agent`.
 *
 * @param layers - layers from lowest precedence to highest.
 * @returns effective headers in first-seen order.
 */
export declare function mergeHeaderLayers(layers: readonly HeaderLayer[]): ResolvedHeader[];
/**
 * Merge the effective headers and mark which of them Harness attribution will
 * overwrite on the wire.
 * @param layers - layers from lowest precedence to highest.
 * @param reservedNames - lowercased names Harness reserves.
 * @returns effective headers with the `reserved` flag set.
 */
export declare function effectiveHeaders(layers: readonly HeaderLayer[], reservedNames: readonly string[]): ResolvedHeader[];
/**
 * Validate a whole header mapping, reporting every bad field.
 * @param record - a `headers`-shaped mapping.
 * @returns one problem per offending field, empty when all are valid.
 */
export declare function validateHeaderRecord(record: Record<string, unknown> | undefined): {
    name: string;
    code: HeaderErrorCode;
}[];
