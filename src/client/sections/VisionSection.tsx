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
import { Button, Input, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { ChoiceRow, Field, Notice } from '../components/primitives.js'
import { formatBytes } from '../components/visual.js'
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
        hint={t('vision.defaultInputDesc')}
        value={inputChoiceOf(profile.defaultInput)}
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

      <Field label={t('vision.imageLimits')} hint={t('vision.imageLimitsDesc')}>
        <div className={cls.grid}>
          {LIMITS.map((spec) => {
            const current = profile[spec.field]
            const fromDefault = IMAGE_LIMIT_DEFAULTS[spec.field]
            const source = current ?? fromDefault
            const display = fromBytes(source)
            const error = props.issues.get(spec.field) ?? validateImageLimit(source) ?? undefined
            return (
              <Field
                key={spec.field}
                label={t(spec.labelKey)}
                error={error ?? undefined}
                hint={spec.pixels === true
                  ? `${formatBytes(source, t)} — ${t('vision.pixelBudgetHint', { size: describePixelBudget(source) })}`
                  : formatBytes(source, t)}
                accessory={current === undefined ? <Tag tone="quiet">{t('preview.inherited')}</Tag> : <Tag tone="info">{t('status.custom')}</Tag>}
              >
                <div className={cls.fieldRow}>
                  <Input
                    className={`${cls.mono} ${cls.inputNarrow}`}
                    type="text"
                    inputMode="numeric"
                    aria-label={t(spec.labelKey)}
                    disabled={disabled}
                    value={String(display.value)}
                    onChange={(event) => {
                      const raw = event.currentTarget.value.trim()
                      if (raw === '') {
                        onChange(spec.field, undefined)
                        return
                      }
                      if (!/^\d+$/.test(raw)) return
                      const bytes = toBytes(Number(raw), display.unit)
                      if (bytes === undefined) return
                      onChange(spec.field, bytes)
                    }}
                  />
                  <select
                    className={cls.mono}
                    aria-label={`${t(spec.labelKey)} unit`}
                    disabled={disabled}
                    value={display.unit}
                    style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--dsw-border-1,rgba(128,128,128,.35))', borderRadius: 6, padding: '5px 6px' }}
                    onChange={(event) => {
                      const unit = event.currentTarget.value as ByteUnit
                      const bytes = toBytes(display.value, unit)
                      if (bytes !== undefined) onChange(spec.field, bytes)
                    }}
                  >
                    {BYTE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled || current === undefined}
                    title={t('common.inheritHint')}
                    onClick={() => { onChange(spec.field, undefined) }}
                  >
                    {t('common.inherit')}
                  </Button>
                </div>
              </Field>
            )
          })}
        </div>
      </Field>

      <ul className={cls.hint} style={{ margin: 0, paddingLeft: 18 }}>
        {LIMITS.map((spec) => (
          <li key={spec.field}>
            {t(spec.labelKey)}: {defaultBytesLabel(spec)}
          </li>
        ))}
      </ul>

      <Notice tone="info">{t('vision.modelsDesc')}</Notice>
    </div>
  )
}

/** Default value label for one limit, so the placeholder is explained in text. */
function defaultBytesLabel(spec: LimitSpec): string {
  return `${String(IMAGE_LIMIT_DEFAULTS[spec.field])} (${String(fromBytes(IMAGE_LIMIT_DEFAULTS[spec.field]).value)} ${fromBytes(IMAGE_LIMIT_DEFAULTS[spec.field]).unit})`
}

/** Map a stored `input` list onto one of the three editor choices. */
function inputChoiceOf(input: readonly string[] | undefined): string {
  if (input === undefined || input.length === 0) return 'inherit'
  return input.includes('image') ? 'text-image' : 'text'
}
