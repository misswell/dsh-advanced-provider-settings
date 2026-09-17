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
import { MODALITIES, type Modality } from './capabilities.js'

/** Units the byte inputs accept. */
export const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB'] as const

/** One byte unit. */
export type ByteUnit = (typeof BYTE_UNITS)[number]

/** Multiplier from each unit to bytes. */
const UNIT_FACTOR: Record<ByteUnit, number> = {
  B: 1,
  KiB: 1024,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024,
}

/** Harness defaults for the three image limits, for display and reset copy. */
export const IMAGE_LIMIT_DEFAULTS = {
  /** Accumulated payload across one request. 20 MiB. */
  maxRequestImageBytes: 20 * 1024 * 1024,
  /** Pixel budget for one image. 2048 x 2048. */
  requestImagePixelBudget: 2048 * 2048,
  /** Encoded target size for one image. 1 MiB. */
  requestImageMaxBytes: 1024 * 1024,
} as const

/**
 * Convert a value in some unit to whole bytes.
 * @param value - numeric amount.
 * @param unit - the unit the amount is expressed in.
 * @returns the integer byte count, or `undefined` when not representable.
 */
export function toBytes(value: number, unit: ByteUnit): number | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined
  const bytes = value * UNIT_FACTOR[unit]
  if (!Number.isFinite(bytes) || !Number.isSafeInteger(Math.round(bytes))) return undefined
  return Math.round(bytes)
}

/** A byte amount split for display: the largest unit that stays exact. */
export interface ByteDisplay {
  value: number
  unit: ByteUnit
}

/**
 * Choose the largest unit in which a byte count is a whole number, so
 * `20971520` renders as `20 MiB` rather than `20971520 B`.
 * @param bytes - integer byte count.
 * @returns the display pair.
 */
export function fromBytes(bytes: number): ByteDisplay {
  if (!Number.isFinite(bytes) || bytes < 0) return { value: 0, unit: 'B' }
  for (const unit of ['GiB', 'MiB', 'KiB'] as const) {
    const factor = UNIT_FACTOR[unit]
    if (bytes >= factor && bytes % factor === 0) return { value: bytes / factor, unit }
  }
  return { value: bytes, unit: 'B' }
}

/**
 * Format a byte count the way the UI shows it.
 * @param bytes - integer byte count.
 * @returns e.g. `20 MiB`.
 */
export function formatBytes(bytes: number): string {
  const { value, unit } = fromBytes(bytes)
  return `${value} ${unit}`
}

/**
 * Describe a pixel budget as a square, which is how users sanity-check it.
 * A non-square-exact budget still gets the nearest integer side.
 * @param pixels - the `requestImagePixelBudget` value.
 * @returns e.g. `≈ 2048 × 2048`.
 */
export function describePixelBudget(pixels: number): string {
  if (!Number.isFinite(pixels) || pixels <= 0) return ''
  const side = Math.round(Math.sqrt(pixels))
  return `≈ ${side} × ${side}`
}

/** Machine-readable reason an image limit was rejected. */
export type ImageLimitErrorCode = 'not-positive-integer' | 'not-safe-integer'

/**
 * Validate one of the three image limits. Harness requires a positive integer;
 * two of the three additionally require a safe integer.
 * @param value - candidate byte/pixel count.
 * @returns `null` when accepted, else the failure code.
 */
export function validateImageLimit(value: unknown): ImageLimitErrorCode | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return 'not-positive-integer'
  if (!Number.isSafeInteger(value)) return 'not-safe-integer'
  return null
}

/**
 * Validate a `defaultInput` / `models[].input` modality list.
 * @param value - candidate list.
 * @returns `null` when accepted, else a failure code.
 */
export function validateModalities(value: unknown): 'not-array' | 'unknown-modality' | 'empty' | null {
  if (!Array.isArray(value)) return 'not-array'
  if (value.length === 0) return 'empty'
  for (const item of value) {
    if (!(MODALITIES as readonly unknown[]).includes(item)) return 'unknown-modality'
  }
  return null
}

/** The three evaluable states of a modality declaration (spec section 28). */
export type InputChoice = 'inherit' | 'text' | 'text-image'

/**
 * Read a stored modality list into the UI's three-way choice.
 * @param input - stored list, or undefined when absent.
 * @returns the choice, defaulting to `inherit` for an absent or empty list.
 */
export function toInputChoice(input: readonly Modality[] | undefined): InputChoice {
  if (input === undefined || input.length === 0) return 'inherit'
  return input.includes('image') ? 'text-image' : 'text'
}

/**
 * Turn the UI's choice into the value to store, or `undefined` for inherit.
 * @param choice - the selected choice.
 * @returns the modality list to write, or `undefined` to unset the key.
 */
export function fromInputChoice(choice: InputChoice): Modality[] | undefined {
  switch (choice) {
    case 'inherit':
      return undefined
    case 'text':
      return ['text']
    case 'text-image':
      return ['text', 'image']
  }
}

/** Whether a stored profile / model declaration claims image support. */
export function claimsImageSupport(input: readonly Modality[] | undefined): boolean {
  return input !== undefined && input.includes('image')
}
