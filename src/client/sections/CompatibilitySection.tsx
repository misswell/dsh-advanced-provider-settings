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
 *
 * `compat` is the part of the schema most likely to be misused, because its
 * field names are wire-protocol identifiers that mean nothing without context.
 * Every flag is therefore rendered with a translated name and a one-line
 * explanation of what it changes about the outgoing request, clustered by
 * concern, and the raw identifier is kept only as a monospace subtitle so it
 * can still be matched against provider documentation.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Button, Input, Pill, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  COMPAT_GROUPS,
  compatFieldsFor,
  type CompatFieldDef,
  type CompatGroupId,
} from '../../shared/capabilities.js'
import { Field, Notice } from '../components/primitives.js'
import { GroupHeader, ValueSource } from '../components/visual.js'
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

/** Split fields into their groups, preserving {@link COMPAT_GROUPS} order. */
export function groupCompatFields(
  fields: readonly CompatFieldDef[],
): readonly { group: CompatGroupId; fields: readonly CompatFieldDef[] }[] {
  return COMPAT_GROUPS
    .map((group) => ({ group, fields: fields.filter((field) => field.group === group) }))
    .filter((entry) => entry.fields.length > 0)
}

/**
 * The grouped compat controls, reused by the per-model editor.
 *
 * A filter box appears only once the list is long enough to need one; the
 * point of the grouping is that most users never need it.
 */
export function CompatFieldGrid(props: {
  t: Translate
  fields: readonly CompatFieldDef[]
  values: Record<string, unknown>
  disabled: boolean
  onChange: (key: string, value: unknown) => void
}): ReactNode {
  const { t, fields, values, disabled } = props
  const [filter, setFilter] = useState('')

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const narrowed = needle === ''
      ? fields
      : fields.filter((field) => {
        const label = t(`compat.f.${field.key}.label`)
        const note = t(`compat.f.${field.key}.note`)
        return `${field.key} ${label} ${note}`.toLowerCase().includes(needle)
      })
    return groupCompatFields(narrowed)
  }, [fields, filter, t])

  const showFilter = fields.length > 8

  return (
    <div className={cls.flagGroups}>
      {showFilter ? (
        <Input
          className={cls.filter}
          type="search"
          value={filter}
          disabled={disabled}
          placeholder={t('compat.filter')}
          aria-label={t('compat.filter')}
          onChange={(event) => { setFilter(event.currentTarget.value) }}
        />
      ) : null}
      {groups.length === 0 ? (
        <p className={cls.hint} style={{ margin: 0 }}>{t('compat.noneMatch')}</p>
      ) : null}
      {groups.map((entry) => (
        <div className={cls.flagGroup} key={entry.group}>
          <GroupHeader
            label={t(`compat.group.${entry.group}.label`)}
            note={t(`compat.group.${entry.group}.note`)}
            overridden={entry.fields.filter((field) => values[field.key] !== undefined).length}
            total={entry.fields.length}
          />
          {entry.fields.map((field) => (
            <CompatFlagRow
              key={field.key}
              t={t}
              field={field}
              value={values[field.key]}
              disabled={disabled}
              onChange={(next) => { props.onChange(field.key, next) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * One flag: what it means on the left, how it is set on the right.
 *
 * A boolean keeps three states rather than two. "Inherit" is not the same as
 * "off" — it leaves the decision to the adapter — so a two-position switch
 * would show a value the plugin cannot actually know.
 */
export function CompatFlagRow(props: {
  t: Translate
  field: CompatFieldDef
  value: unknown
  disabled: boolean
  onChange: (next: unknown) => void
}): ReactNode {
  const { t, field, value, disabled } = props
  const overridden = value !== undefined
  const label = t(`compat.f.${field.key}.label`)

  const control = (() => {
    if (field.kind === 'number') {
      return (
        <Input
          className={`${cls.mono} ${cls.inputNarrow}`}
          type="text"
          inputMode="numeric"
          aria-label={label}
          disabled={disabled}
          value={value === undefined || value === null ? '' : String(value)}
          placeholder={t('common.inherit')}
          onChange={(event) => {
            const raw = event.currentTarget.value.trim()
            if (raw === '') props.onChange(undefined)
            else if (/^-?\d+$/.test(raw)) props.onChange(Number(raw))
          }}
        />
      )
    }

    if (field.kind === 'dict') {
      return (
        <Input
          className={cls.mono}
          type="text"
          aria-label={label}
          disabled={disabled}
          value={value === undefined || value === null ? '' : JSON.stringify(value)}
          placeholder={t('common.inherit')}
          onChange={(event) => {
            const raw = event.currentTarget.value.trim()
            if (raw === '') {
              props.onChange(undefined)
              return
            }
            try {
              props.onChange(JSON.parse(raw))
            } catch {
              // Keep the typed text in the DOM; a half-written object is not a
              // value yet, and writing garbage into settings would be worse.
            }
          }}
        />
      )
    }

    const options = field.kind === 'boolean'
      ? [
        { value: '', label: t('common.inherit'), title: t('common.inheritHint') },
        { value: 'true', label: t('compat.supported'), title: t(`compat.f.${field.key}.note`) },
        { value: 'false', label: t('compat.unsupported'), title: t(`compat.f.${field.key}.note`) },
      ]
      : [
        { value: '', label: t('common.inherit'), title: t('common.inheritHint') },
        ...(field.options ?? []).map((option) => ({
          value: option,
          label: t(`compat.option.${option}`),
          title: t(`compat.f.${field.key}.note`),
        })),
      ]

    const current = value === undefined || value === null ? '' : String(value)

    return (
      <div className={cls.tagList} role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <Pill
            key={option.value}
            active={option.value === current}
            title={option.title}
            role="radio"
            aria-checked={option.value === current}
            disabled={disabled}
            onClick={() => {
              if (option.value === '') props.onChange(undefined)
              else if (field.kind === 'boolean') props.onChange(option.value === 'true')
              else props.onChange(option.value)
            }}
          >
            {option.label}
          </Pill>
        ))}
      </div>
    )
  })()

  return (
    <div className={cls.flag} data-overridden={overridden ? 'true' : 'false'}>
      <div className={cls.flagText}>
        <span className={cls.flagLabel}>
          {label}
          <code className={cls.flagKey}>{field.key}</code>
          <ValueSource t={t} overridden={overridden} />
        </span>
        <span className={cls.flagNote}>{t(`compat.f.${field.key}.note`)}</span>
      </div>
      <div className={cls.flagControl}>{control}</div>
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
