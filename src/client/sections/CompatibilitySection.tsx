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
import { Note, NumberBox, Row } from '../components/primitives.js'
import { GroupHeader } from '../components/visual.js'
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
      {fields.length === 0 ? (
        <Note>
          {profile.api === undefined ? t('compat.unknownProtocol') : t('compat.noFields')}
        </Note>
      ) : (
        <>
          <CompatFieldGrid
            t={t}
            fields={fields}
            values={profile.compat ?? {}}
            disabled={disabled}
            onChange={(key, value) => { props.onChange('compat', withValue(profile.compat ?? {}, key, value)) }}
          />
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
 *
 * `inheritedValues` is what the same flag resolves to one level up — the route
 * for a model-level grid, nothing for a route-level one. Showing it is what
 * makes "Inherit" a decision rather than a blank: without it, per-model editing
 * is guesswork about which of the two levels a value comes from.
 */
export function CompatFieldGrid(props: {
  t: Translate
  fields: readonly CompatFieldDef[]
  values: Record<string, unknown>
  disabled: boolean
  onChange: (key: string, value: unknown) => void
  /** Where an un-overridden flag actually takes its value from. */
  inheritedValues?: Record<string, unknown> | undefined
  /** Names the level the un-overridden value comes from. */
  inheritedFrom?: string | undefined
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
        <p className={cls.hint}>{t('compat.noneMatch')}</p>
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
              inherited={props.inheritedValues?.[field.key]}
              inheritedFrom={props.inheritedFrom}
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
 *
 * When the flag is not set here but IS set one level up, the row says what the
 * inherited value reads as. That is the difference between an inherited column
 * you can audit and a column of blanks.
 */
export function CompatFlagRow(props: {
  t: Translate
  field: CompatFieldDef
  value: unknown
  disabled: boolean
  onChange: (next: unknown) => void
  /** The same flag at the level below this one in precedence. */
  inherited?: unknown
  /** Where `inherited` comes from, e.g. "route level". */
  inheritedFrom?: string | undefined
}): ReactNode {
  const { t, field, value, disabled } = props
  const overridden = value !== undefined
  const label = t(`compat.f.${field.key}.label`)
  const note = (() => {
    const explanation = t(`compat.f.${field.key}.note`)
    if (overridden || props.inherited === undefined) return explanation
    return props.inheritedFrom === undefined
      ? explanation
      : `${explanation} · ${t('compat.inheritedFrom', { from: props.inheritedFrom, value: describeCompatValue(t, field, props.inherited) })}`
  })()

  const control = (() => {
    if (field.kind === 'number') {
      return (
        <NumberBox
          value={typeof value === 'number' ? value : undefined}
          placeholder={t('common.inherit')}
          ariaLabel={label}
          disabled={disabled}
          parse={(raw) => (/^-?\d+$/.test(raw) ? Number(raw) : undefined)}
          onChange={(next) => { props.onChange(next) }}
        />
      )
    }

    if (field.kind === 'dict') {
      return (
        <Input
          className={`${cls.mono} ${cls.input}`}
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
    <Row
      label={label}
      fieldKey={field.key}
      note={note}
      overridden={overridden}
      wide={field.kind === 'dict' || (field.kind === 'enum' && (field.options?.length ?? 0) > 3)}
    >
      {control}
    </Row>
  )
}

/**
 * How one compat value reads in prose, for the "inherited" line.
 *
 * Deliberately not the raw wire value: `supportsStore: true` is written as
 * "supported" because that is the question the flag answers.
 */
export function describeCompatValue(
  t: Translate,
  field: CompatFieldDef,
  value: unknown,
): string {
  if (field.kind === 'boolean') {
    return value ? t('compat.supported') : t('compat.unsupported')
  }
  if (field.kind === 'enum') return t(`compat.option.${String(value)}`)
  if (field.kind === 'number') return String(value)
  if (typeof value === 'object' && value !== null) {
    return t('compat.dictKeys', { count: Object.keys(value).length })
  }
  return String(value)
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
