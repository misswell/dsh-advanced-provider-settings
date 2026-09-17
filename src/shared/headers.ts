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
  name: string
  /** Field value. */
  value: string
}

/** Which layer supplied a header. */
export type HeaderSource = 'harness' | 'global' | 'provider'

/** One effective header after layering. */
export interface ResolvedHeader extends HeaderEntry {
  /** The layer that won this field name. */
  source: HeaderSource
  /** Whether Harness attribution overwrites this name on the wire. */
  reserved: boolean
}

/** One layer's contribution. */
export interface HeaderLayer {
  source: HeaderSource
  headers: readonly HeaderEntry[]
}

/**
 * RFC 9110 `tchar`: the characters a header field name may contain.
 * Anything else — including CR, LF, SP and colon — is rejected.
 */
const TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/** Field names whose value is a credential and must never be rendered raw. */
const SENSITIVE_EXACT: readonly string[] = [
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'apikey',
  'x-auth-token',
  'x-access-token',
  'cookie',
  'set-cookie',
]

/** Substrings that mark a field name as credential-bearing. */
const SENSITIVE_SUBSTRINGS: readonly string[] = ['secret', 'token', 'password']

/** Machine-readable reason a header was rejected, for locale lookup. */
export type HeaderErrorCode = 'empty-name' | 'invalid-name' | 'crlf' | 'empty-value'

/** Validation outcome for one header. */
export type HeaderValidation = { ok: true } | { ok: false; code: HeaderErrorCode }

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
export function validateHeader(name: string, value: string): HeaderValidation {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { ok: false, code: 'empty-name' }
  if (containsCrlf(trimmed)) return { ok: false, code: 'crlf' }
  if (!TOKEN_RE.test(trimmed)) return { ok: false, code: 'invalid-name' }
  if (containsCrlf(value)) return { ok: false, code: 'crlf' }
  if (value.length === 0) return { ok: false, code: 'empty-value' }
  return { ok: true }
}

/** Whether a string carries a CR or LF (header-injection vector). */
function containsCrlf(value: string): boolean {
  return value.includes('\r') || value.includes('\n')
}

/**
 * Whether a header name carries a credential, so its value must be masked in
 * every preview, log line and export (spec sections 17, 19, 42, 52).
 * @param name - header field name, any case.
 * @returns whether the value is sensitive.
 */
export function isSensitiveHeader(name: string): boolean {
  const lower = name.trim().toLowerCase()
  if (SENSITIVE_EXACT.includes(lower)) return true
  return SENSITIVE_SUBSTRINGS.some((needle) => lower.includes(needle))
}

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
export function maskHeaderValue(value: string): string {
  const spaceAt = value.indexOf(' ')
  const hasScheme = spaceAt > 0 && /^[A-Za-z]+$/.test(value.slice(0, spaceAt))
  const scheme = hasScheme ? value.slice(0, spaceAt + 1) : ''
  const secret = hasScheme ? value.slice(spaceAt + 1) : value

  if (secret.length === 0) return `${scheme}****`
  const tail = secret.length > 8 ? secret.slice(-4) : ''
  return `${scheme}****${tail}`
}

/**
 * Mask a value only when its name is sensitive.
 * @param name - header field name.
 * @param value - header field value.
 * @returns the display value.
 */
export function displayHeaderValue(name: string, value: string): string {
  return isSensitiveHeader(name) ? maskHeaderValue(value) : value
}

/**
 * Normalize a header record into entries, preserving order and casing while
 * dropping nothing. Duplicate names inside ONE layer keep the last occurrence —
 * a record cannot express a repeated field, and YAML mappings cannot either.
 * @param record - a `headers`-shaped mapping.
 * @returns entries in first-seen order with last-wins values.
 */
export function headerEntriesOf(record: Record<string, unknown> | undefined): HeaderEntry[] {
  if (record === undefined || record === null) return []
  const seen = new Map<string, number>()
  const out: HeaderEntry[] = []
  for (const [name, raw] of Object.entries(record)) {
    if (typeof raw !== 'string') continue
    const lower = name.toLowerCase()
    const at = seen.get(lower)
    if (at !== undefined) {
      out[at] = { name, value: raw }
      continue
    }
    seen.set(lower, out.length)
    out.push({ name, value: raw })
  }
  return out
}

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
export function mergeHeaderLayers(layers: readonly HeaderLayer[]): ResolvedHeader[] {
  const order: string[] = []
  const byLower = new Map<string, ResolvedHeader>()

  for (const layer of layers) {
    for (const entry of layer.headers) {
      const name = entry.name.trim()
      if (name.length === 0) continue
      const lower = name.toLowerCase()
      const resolved: ResolvedHeader = {
        name,
        value: entry.value,
        source: layer.source,
        reserved: false,
      }
      if (!byLower.has(lower)) order.push(lower)
      byLower.set(lower, resolved)
    }
  }

  return order.map((lower) => byLower.get(lower)!).filter(Boolean)
}

/**
 * Merge the effective headers and mark which of them Harness attribution will
 * overwrite on the wire.
 * @param layers - layers from lowest precedence to highest.
 * @param reservedNames - lowercased names Harness reserves.
 * @returns effective headers with the `reserved` flag set.
 */
export function effectiveHeaders(
  layers: readonly HeaderLayer[],
  reservedNames: readonly string[],
): ResolvedHeader[] {
  const reserved = new Set(reservedNames.map((name) => name.toLowerCase()))
  return mergeHeaderLayers(layers).map((header) => ({
    ...header,
    reserved: reserved.has(header.name.toLowerCase()),
  }))
}

/**
 * Validate a whole header mapping, reporting every bad field.
 * @param record - a `headers`-shaped mapping.
 * @returns one problem per offending field, empty when all are valid.
 */
export function validateHeaderRecord(
  record: Record<string, unknown> | undefined,
): { name: string; code: HeaderErrorCode }[] {
  if (record === undefined || record === null) return []
  const problems: { name: string; code: HeaderErrorCode }[] = []
  for (const [name, raw] of Object.entries(record)) {
    const value = typeof raw === 'string' ? raw : ''
    const result = validateHeader(name, value)
    if (!result.ok) problems.push({ name, code: result.code })
  }
  return problems
}
