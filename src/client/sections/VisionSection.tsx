/**
 * Vision section: the provider-wide input default and the image budget
 * (spec sections 28-32, 69).
 *
 * Image limits are edited as a value plus a unit rather than raw bytes, because
 * the useful values are all powers of two and `20971520` tells a reader nothing.
 * A byte count that is not exactly representable in the chosen unit is rejected
 * rather than rounded: the host asserts these are positive integers, and a
 * silently rounded budget is a limit the user did not ask for.
 */
import type { ReactNode } from 'react'
import { BYTE_UNITS, IMAGE_LIMIT_DEFAULTS, describePixelBudget, fromBytes, toBytes, validateImageLimit, type ByteUnit } from '../../shared/vision.js'
import { ChoiceRow, Note, NumberBox, Row } from '../components/primitives.js'
import { InheritButton, formatBytes } from '../components/visual.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

/** One image-limit field descriptor. */
interface LimitSpec {
  field: 'maxRequestImageBytes' | 'requestImagePixelBudget' | 'requestImageMaxBytes'
  labelKey: string
  /** When true the value is a pixel count, so a square hint is shown. */
  pixels?: boolean
}

/** The three image limits, in the order the section shows them. */
const LIMITS: readonly LimitSpec[] = [
  { field: 'maxRequestImageBytes', labelKey: 'vision.maxRequestImageBytes' },
  { field: 'requestImagePixelBudget', labelKey: 'vision.requestImagePixelBudget', pixels: true },
  { field: 'requestImageMaxBytes', labelKey: 'vision.requestImageMaxBytes' },
]

/** Render the Vision section body. */
export function VisionSection(props: {
  t: Translate
  profile: ProviderProfile
  disabled: boolean
  issues: ReadonlyMap<string, string>
  onChange: (field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, disabled, onChange } = props

  return (
    <div className={cls.section}>
      <ChoiceRow
        label={t('vision.defaultInput')}
        note={t('vision.defaultInputDesc')}
        value={inputChoiceOf(profile.defaultInput)}
        overridden={profile.defaultInput !== undefined}
        disabled={disabled}
        options={[
          { value: 'inherit', label: t('common.inherit'), title: t('common.inheritHint') },
          { value: 'text', label: t('vision.textOnly') },
          { value: 'text-image', label: t('vision.textImage') },
        ]}
        onChange={(next) => {
          onChange('defaultInput', next === 'inherit' ? undefined : next === 'text' ? ['text'] : ['text', 'image'])
        }}
      />

      <Note>{t('vision.imageLimitsDesc')}</Note>

      {LIMITS.map((spec) => {
        const label = t(spec.labelKey)
        const current = profile[spec.field]
        const fallback = IMAGE_LIMIT_DEFAULTS[spec.field]
        const shown = current ?? fallback
        const display = fromBytes(shown)
        const bytes = (raw: string): number | undefined => {
          if (!/^\d+$/.test(raw)) return undefined
          return toBytes(Number(raw), display.unit)
        }
        const error = props.issues.get(spec.field) ?? validateImageLimit(shown) ?? undefined
        // The box already reads "2 MiB", so restating it would be a second
        // picture of the same number. Only the pixel row has something the box
        // cannot show: what that budget works out to in pixels.
        const human = formatBytes(shown, t)
        const equivalent = spec.pixels === true
          ? `${human} · ${t('vision.pixelBudgetHint', { size: describePixelBudget(shown) })}`
          : human
        return (
          <Row
            key={spec.field}
            label={label}
            note={current === undefined
              ? t('field.defaultIs', { value: equivalent })
              : (spec.pixels === true ? equivalent : undefined)}
            error={error}
            overridden={current !== undefined}
          >
            <NumberBox
              value={display.value}
              placeholder={String(fromBytes(fallback).value)}
              ariaLabel={label}
              disabled={disabled}
              parse={bytes}
              unit={(
                <select
                  aria-label={`${label} unit`}
                  disabled={disabled}
                  value={display.unit}
                  onChange={(event) => {
                    const unit = event.currentTarget.value as ByteUnit
                    const next = toBytes(display.value, unit)
                    if (next !== undefined) onChange(spec.field, next)
                  }}
                >
                  {BYTE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              )}
              onChange={(next) => { onChange(spec.field, next) }}
            />
            <InheritButton
              t={t}
              overridden={current !== undefined}
              disabled={disabled}
              onInherit={() => { onChange(spec.field, undefined) }}
            />
          </Row>
        )
      })}

      <Note>{t('vision.modelsDesc')}</Note>
    </div>
  )
}

/** Map a stored `input` list onto one of the three editor choices. */
function inputChoiceOf(input: readonly string[] | undefined): string {
  if (input === undefined || input.length === 0) return 'inherit'
  return input.includes('image') ? 'text-image' : 'text'
}
