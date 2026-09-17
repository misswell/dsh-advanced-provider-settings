/**
 * Header list editor, used for both the provider and the global header layer.
 *
 * The two layers need the same editing surface but opposite warnings: a
 * provider-level `user-agent` is stripped by Harness, while a global one
 * replaces Harness attribution on every request. Rather than two components,
 * one takes a `scope` and explains the trap that applies.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Button, Input, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { isReservedHeader, USER_AGENT_PRESETS } from '../../shared/capabilities.js'
import { isSensitiveHeader, validateHeader, type HeaderEntry } from '../../shared/headers.js'
import { cls } from '../styles.js'
import { Field, LinkButton, Notice } from './primitives.js'
import type { Translate } from '../contract.js'

/** Which layer is being edited; drives the advisory copy. */
export type HeaderScope = 'provider' | 'global'

/** One row's validation state. */
interface RowIssue {
  name?: string
  value?: string
}

/** Validate a whole list, returning per-row issues and a duplicate flag. */
export function validateRows(
  rows: readonly HeaderEntry[],
  t: Translate,
): RowIssue[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const issue: RowIssue = {}
    const result = validateHeader(row.name, row.value)
    if (!result.ok) {
      if (result.code === 'empty-name') issue.name = t('headers.error.emptyName')
      else if (result.code === 'invalid-name') issue.name = t('headers.error.invalidName')
      else if (result.code === 'empty-value') issue.value = t('headers.error.emptyValue')
      else issue.value = t('headers.error.crlf')
    }
    const key = row.name.trim().toLowerCase()
    if (key.length > 0) {
      if (seen.has(key)) issue.name = issue.name ?? t('headers.error.duplicate')
      seen.add(key)
    }
    return issue
  })
}

/** Whether a list has any blocking problem. */
export function hasBlockingRow(rows: readonly HeaderEntry[], t: Translate): boolean {
  return validateRows(rows, t).some((issue) => issue.name !== undefined || issue.value !== undefined)
}

/**
 * Render the header list editor.
 * @param props - draft rows, the change sink, and which layer this is.
 * @returns the editor element.
 */
export function HeaderEditor(props: {
  t: Translate
  rows: readonly HeaderEntry[]
  onChange: (next: HeaderEntry[]) => void
  scope: HeaderScope
  /** The profile's credential reference, for the authorization advisory. */
  credentialRef?: string | undefined
  disabled?: boolean | undefined
  /** Show the User-Agent preset row. Only the global layer can use it. */
  showPresets?: boolean | undefined
}): ReactNode {
  const { t, rows, onChange, scope, disabled } = props
  const [revealed, setRevealed] = useState<readonly number[]>([])
  const issues = useMemo(() => validateRows(rows, t), [rows, t])

  const update = (index: number, patch: Partial<HeaderEntry>): void => {
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  }
  const remove = (index: number): void => {
    onChange(rows.filter((_row, at) => at !== index))
  }
  const toggleReveal = (index: number): void => {
    setRevealed((current) =>
      current.includes(index) ? current.filter((at) => at !== index) : [...current, index],
    )
  }

  const applyPreset = (value: string): void => {
    const at = rows.findIndex((row) => row.name.trim().toLowerCase() === 'user-agent')
    if (at >= 0) update(at, { name: 'user-agent', value })
    else onChange([...rows, { name: 'user-agent', value }])
  }

  const reservedRows = rows.filter((row) => isReservedHeader(row.name))
  const credentialRows = rows.filter(
    (row) => props.credentialRef !== undefined
      && ['authorization', 'x-api-key'].includes(row.name.trim().toLowerCase()),
  )

  return (
    <div className={cls.section}>
      <div className={cls.headerTable}>
        {rows.length === 0 ? <p className={cls.hint} style={{ margin: 0 }}>{t('headers.empty')}</p> : null}
        {rows.map((row, index) => {
          const issue = issues[index] ?? {}
          const sensitive = isSensitiveHeader(row.name)
          const isRevealed = revealed.includes(index)
          return (
            <div className={cls.headerRow} key={`${row.name}-${String(index)}`}>
              <Input
                className={`${cls.mono} ${cls.headerName}`}
                value={row.name}
                placeholder={t('headers.name')}
                aria-label={t('headers.name')}
                disabled={disabled}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => { update(index, { name: event.currentTarget.value }) }}
              />
              <Input
                className={`${cls.mono} ${cls.headerValue}`}
                value={row.value}
                placeholder={t('headers.value')}
                aria-label={t('headers.value')}
                disabled={disabled}
                spellCheck={false}
                autoComplete="off"
                type={sensitive && !isRevealed ? 'password' : 'text'}
                onChange={(event) => { update(index, { value: event.currentTarget.value }) }}
              />
              <div className={cls.headerActions}>
                {sensitive ? (
                  <LinkButton
                    label={isRevealed ? t('common.no') : t('common.yes')}
                    title={t('headers.sensitive')}
                    onClick={() => { toggleReveal(index) }}
                  />
                ) : null}
                <LinkButton
                  label={t('common.remove')}
                  disabled={disabled}
                  onClick={() => { remove(index) }}
                />
              </div>
              {issue.name === undefined && issue.value === undefined ? null : (
                <span className={cls.error} role="alert">{issue.name ?? issue.value}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className={cls.toolbar}>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => { onChange([...rows, { name: '', value: '' }]) }}
        >
          {t('headers.add')}
        </Button>
        {sensitiveCount(rows) > 0 ? <Tag tone="warning">{t('headers.sensitive')}</Tag> : null}
      </div>

      {reservedRows.length > 0 ? (
        <Notice tone={scope === 'global' ? 'warning' : 'danger'} title={t('headers.reservedTitle')}>
          {scope === 'global' ? t('headers.reservedGlobal') : t('headers.reservedProvider')}
        </Notice>
      ) : null}

      {credentialRows.length > 0 ? (
        <Notice tone="warning">{t('headers.credentialWarn')}</Notice>
      ) : null}

      {props.showPresets === true ? (
        <Field label={t('headers.presets')} hint={t('headers.presetsDesc')}>
          <div className={cls.tagList}>
            {USER_AGENT_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant="ghost"
                size="sm"
                disabled={disabled}
                title={preset.value}
                onClick={() => { applyPreset(preset.value) }}
              >
                {t(preset.labelKey)}
              </Button>
            ))}
          </div>
        </Field>
      ) : null}
    </div>
  )
}

/** How many rows carry a secret-like header name. */
function sensitiveCount(rows: readonly HeaderEntry[]): number {
  return rows.filter((row) => isSensitiveHeader(row.name)).length
}
