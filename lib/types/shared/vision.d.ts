/**
 * Vision limits and byte-unit arithmetic (spec sections 29-32).
 *
 * Two things the UI must get right and one it must not pretend:
 *
 *  - Every byte field is stored as an INTEGER number of bytes. The form accepts
 *    Bytes / KiB / MiB / GiB and converts, so `20 MiB` writes `20971520`.
 *  - The declaration is Harness's belief about the model, not a capability
 *    grant. Turning on `image` for a model that cannot see does not make it
 *    able to; the copy says so (section 29).
 */
import { type Modality } from './capabilities.js';
/** Units the byte inputs accept. */
export declare const BYTE_UNITS: readonly ["B", "KiB", "MiB", "GiB"];
/** One byte unit. */
export type ByteUnit = (typeof BYTE_UNITS)[number];
/** Harness defaults for the three image limits, for display and reset copy. */
export declare const IMAGE_LIMIT_DEFAULTS: {
    /** Accumulated payload across one request. 20 MiB. */
    readonly maxRequestImageBytes: number;
    /** Pixel budget for one image. 2048 x 2048. */
    readonly requestImagePixelBudget: number;
    /** Encoded target size for one image. 1 MiB. */
    readonly requestImageMaxBytes: number;
};
/**
 * Convert a value in some unit to whole bytes.
 * @param value - numeric amount.
 * @param unit - the unit the amount is expressed in.
 * @returns the integer byte count, or `undefined` when not representable.
 */
export declare function toBytes(value: number, unit: ByteUnit): number | undefined;
/** A byte amount split for display: the largest unit that stays exact. */
export interface ByteDisplay {
    value: number;
    unit: ByteUnit;
}
/**
 * Choose the largest unit in which a byte count is a whole number, so
 * `20971520` renders as `20 MiB` rather than `20971520 B`.
 * @param bytes - integer byte count.
 * @returns the display pair.
 */
export declare function fromBytes(bytes: number): ByteDisplay;
/**
 * Format a byte count the way the UI shows it.
 * @param bytes - integer byte count.
 * @returns e.g. `20 MiB`.
 */
export declare function formatBytes(bytes: number): string;
/**
 * Describe a pixel budget as a square, which is how users sanity-check it.
 * A non-square-exact budget still gets the nearest integer side.
 * @param pixels - the `requestImagePixelBudget` value.
 * @returns e.g. `≈ 2048 × 2048`.
 */
export declare function describePixelBudget(pixels: number): string;
/** Machine-readable reason an image limit was rejected. */
export type ImageLimitErrorCode = 'not-positive-integer' | 'not-safe-integer';
/**
 * Validate one of the three image limits. Harness requires a positive integer;
 * two of the three additionally require a safe integer.
 * @param value - candidate byte/pixel count.
 * @returns `null` when accepted, else the failure code.
 */
export declare function validateImageLimit(value: unknown): ImageLimitErrorCode | null;
/**
 * Validate a `defaultInput` / `models[].input` modality list.
 * @param value - candidate list.
 * @returns `null` when accepted, else a failure code.
 */
export declare function validateModalities(value: unknown): 'not-array' | 'unknown-modality' | 'empty' | null;
/** The three evaluable states of a modality declaration (spec section 28). */
export type InputChoice = 'inherit' | 'text' | 'text-image';
/**
 * Read a stored modality list into the UI's three-way choice.
 * @param input - stored list, or undefined when absent.
 * @returns the choice, defaulting to `inherit` for an absent or empty list.
 */
export declare function toInputChoice(input: readonly Modality[] | undefined): InputChoice;
/**
 * Turn the UI's choice into the value to store, or `undefined` for inherit.
 * @param choice - the selected choice.
 * @returns the modality list to write, or `undefined` to unset the key.
 */
export declare function fromInputChoice(choice: InputChoice): Modality[] | undefined;
/** Whether a stored profile / model declaration claims image support. */
export declare function claimsImageSupport(input: readonly Modality[] | undefined): boolean;
