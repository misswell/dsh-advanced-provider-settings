/**
 * Compatibility section: route-level and model-level `compat` flags
 * (spec sections 37-40).
 *
 * The field list is filtered by the route's protocol rather than shown in full,
 * because the two levels behave differently in Harness and only one of the two
 * is forgiving:
 *
 *  - at ROUTE level a field the protocol does not read is silently skipped;
 *  - at MODEL level the same field is a HARD ERROR that fails profile
 *    resolution.
 *
 * So the model-level editor is not merely convenient — offering a field there
 * that the protocol does not support would let the user save a broken profile.
 */
import type { ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { compatFieldsFor, type CompatFieldDef } from '../../shared/capabilities.js'
import { ChoiceRow, Field, Notice } from '../components/primitives.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

/** Render the route-level compatibility editor. */
export function CompatibilitySection(props: {
  t: Translate
  profile: ProviderProfile
  disabled: boolean
  onChange: (field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, disabled } = props
  const fields = compatFieldsFor(profile.api)

  return (
    <div className={cls.section}>
      <p className={cls.hint} style={{ margin: 0 }}>{t('compat.desc')}</p>
      {fields.length === 0 ? (
        <Notice tone="info">
          {profile.api === undefined ? t('compat.unknownProtocol') : t('compat.noFields')}
        </Notice>
      ) : (
        <>
          <Field label={t('compat.routeTitle')} hint={t('compat.routeDesc')}>
            <CompatFieldGrid
              t={t}
              fields={fields}
              values={profile.compat ?? {}}
              disabled={disabled}
              onChange={(key, value) => { props.onChange('compat', withValue(profile.compat ?? {}, key, value)) }}
            />
          </Field>
          {profile.compat === undefined ? null : (
            <div className={cls.toolbar}>
              <Tag tone="info">{t('compat.overrideCount', { count: Object.keys(profile.compat).length })}</Tag>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => { props.onChange('compat', undefined) }}
              >
                {t('common.resetSection')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** The grid of compat controls, reused by the per-model editor. */
export function CompatFieldGrid(props: {
  t: Translate
  fields: readonly CompatFieldDef[]
  values: Record<string, unknown>
  disabled: boolean
  onChange: (key: string, value: unknown) => void
}): ReactNode {
  const { t, fields, values, disabled } = props
  return (
    <div className={cls.grid}>
      {fields.map((field) => {
        // A tri-state is essential: absent means "let the adapter decide", which
        // is not the same as `false`.
        const current = values[field.key]
        const choice = current === undefined || current === null ? '' : String(current)
        const options = [
          { value: '', label: t('common.inherit'), title: t('common.inheritHint') },
          ...(field.kind === 'boolean'
            ? [{ value: 'true', label: t('compat.on') }, { value: 'false', label: t('compat.off') }]
            : (field.options ?? []).map((option) => ({ value: option, label: option }))),
        ]
        return (
          <div key={field.key}>
            {field.kind === 'number' ? (
              <Field
                label={field.key}
                hint={field.note}
                accessory={current === undefined ? null : <Tag tone="info">{t('status.custom')}</Tag>}
              >
                <input
                  className={`${cls.mono} ${cls.inputNarrow}`}
                  type="text"
                  inputMode="numeric"
                  aria-label={field.key}
                  disabled={disabled}
                  value={choice}
                  onChange={(event) => {
                    const raw = event.currentTarget.value.trim()
                    if (raw === '') props.onChange(field.key, undefined)
                    else if (/^-?\d+$/.test(raw)) props.onChange(field.key, Number(raw))
                  }}
                />
              </Field>
            ) : (
              <ChoiceRow
                label={field.key}
                value={choice}
                options={options}
                disabled={disabled}
                accessory={current === undefined ? null : <Tag tone="info">{t('status.custom')}</Tag>}
                onChange={(next) => {
                  if (next === '') props.onChange(field.key, undefined)
                  else if (field.kind === 'boolean') props.onChange(field.key, next === 'true')
                  else props.onChange(field.key, next)
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Return a copy of a compat record with one key set or removed. */
export function withValue(
  record: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> | undefined {
  const next = { ...record }
  if (value === undefined) delete next[key]
  else next[key] = value
  return Object.keys(next).length === 0 ? undefined : next
}
