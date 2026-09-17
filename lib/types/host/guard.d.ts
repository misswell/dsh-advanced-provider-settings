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
export declare const MAX_BODY_BYTES: number;
/** Result of the guard: either cleared to proceed, or a refusal to send. */
export type GuardResult = {
    ok: true;
} | {
    ok: false;
    status: number;
    reason: string;
};
/**
 * Check the request before any work is done.
 * @param method - HTTP method.
 * @param headers - request headers.
 * @param peerAddress - the socket's remote address.
 * @returns whether to proceed.
 */
export declare function guardRequest(method: string, headers: Record<string, string | string[] | undefined>, peerAddress: string | undefined): GuardResult;
/** Whether an address is the loopback interface. */
export declare function isLoopback(address: string | undefined): boolean;
/** Whether a Host header names the loopback interface. */
export declare function isLoopbackHost(host: string): boolean;
/** Whether an Origin header matches the request's Host header. */
export declare function isSameOrigin(origin: string, host: string | undefined): boolean;
