/**
 * Same-origin guard for this plugin's host routes.
 *
 * `ctx.webServer.register` gives a plugin a raw Node request; it inherits
 * neither DSH's cookie auth nor any origin policy, so a route that can read
 * configuration or spend a network call must defend itself. These handlers are
 * read-only or explicitly user-initiated, which makes CSRF the live risk rather
 * than authentication: a page the user visits must not be able to make their
 * Harness interrogate an attacker-chosen endpoint.
 *
 * The guard therefore requires: a loopback peer, a loopback Host header, a
 * JSON content type on writes, no cross-site fetch metadata, and a matching
 * Origin when one is sent.
 */

/** Largest request body accepted, in bytes. */
export const MAX_BODY_BYTES = 128 * 1024

/** Result of the guard: either cleared to proceed, or a refusal to send. */
export type GuardResult = { ok: true } | { ok: false; status: number; reason: string }

/**
 * Check the request before any work is done.
 * @param method - HTTP method.
 * @param headers - request headers.
 * @param peerAddress - the socket's remote address.
 * @returns whether to proceed.
 */
export function guardRequest(
  method: string,
  headers: Record<string, string | string[] | undefined>,
  peerAddress: string | undefined,
): GuardResult {
  if (!isLoopback(peerAddress)) return { ok: false, status: 403, reason: 'non-loopback peer' }

  const host = firstHeader(headers.host)
  if (host !== undefined && !isLoopbackHost(host)) {
    return { ok: false, status: 403, reason: 'non-loopback host' }
  }

  const site = firstHeader(headers['sec-fetch-site'])
  if (site !== undefined && site === 'cross-site') {
    return { ok: false, status: 403, reason: 'cross-site request' }
  }

  const origin = firstHeader(headers.origin)
  if (origin !== undefined && !isSameOrigin(origin, host)) {
    return { ok: false, status: 403, reason: 'origin mismatch' }
  }

  if (method !== 'POST') return { ok: true }

  const contentType = firstHeader(headers['content-type']) ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return { ok: false, status: 415, reason: 'json content type required' }
  }

  return { ok: true }
}

/** Whether an address is the loopback interface. */
export function isLoopback(address: string | undefined): boolean {
  if (address === undefined || address.length === 0) return false
  const normalized = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
  return (
    normalized === '::1' ||
    normalized === '127.0.0.1' ||
    normalized.startsWith('127.')
  )
}

/** Whether a Host header names the loopback interface. */
export function isLoopbackHost(host: string): boolean {
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase()
  return name === 'localhost' || name === '127.0.0.1' || name === '::1' || name.startsWith('127.')
}

/** Whether an Origin header matches the request's Host header. */
export function isSameOrigin(origin: string, host: string | undefined): boolean {
  if (host === undefined) return false
  try {
    const parsed = new URL(origin)
    return parsed.host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}

/** First value of a possibly repeated header. */
function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}
