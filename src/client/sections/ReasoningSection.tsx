/**
 * Reasoning section: provider-level thinking level and token budgets
 * (spec sections 25-27).
 *
 * `xhigh` and `max` are offered as levels because the schema accepts them, with
 * a note that DSH folds both onto the `high` budget — otherwise a user setting
 * an `xhigh` budget of 128k would silently get 16k. The fold is stated once, in
 * words, beside the control it applies to; a second picture of the same ladder
 * would only repeat what the pills already say.
 */
import type { ReactNode } from 'react'
import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { THINKING_BUDGET_LEVELS, THINKING_LEVELS } from '../../shared/capabilities.js'
import { Note, NumberBox, Row } from '../components/primitives.js'
import { InheritButton } from '../components/visual.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

/** Budget levels that actually take effect; xhigh/max fold onto `high`. */
const BUDGET_KEYS = THINKING_BUDGET_LEVELS

/** The DeepSeek Harness defaults, shown as the placeholder. */
const BUDGET_DEFAULTS: Readonly<Record<string, number>> = {
  minimal: 1024,
  low: 2048,
  medium: 8192,
  high: 16384,
}

/** Render the Reasoning section body. */
export function ReasoningSection(props: {
  t: Translate
  profile: ProviderProfile
  disabled: boolean
  issues: ReadonlyMap<string, string>
  onChange: (field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, disabled, onChange } = props
  const budgets = profile.thinkingBudgets ?? {}

  const setBudget = (level: string, value: number | undefined): void => {
    const next = { ...budgets }
    if (value === undefined) delete next[level]
    else next[level] = value
    onChange('thinkingBudgets', Object.keys(next).length === 0 ? undefined : next)
  }

  return (
    <div className={cls.section}>
      <Row
        label={t('reasoning.level')}
        note={t('reasoning.levelDesc')}
        overridden={profile.reasoning !== undefined}
        wide
      >
        <div className={cls.tagList} role="radiogroup" aria-label={t('reasoning.level')}>
          {[
            { value: '', label: t('common.inherit'), title: t('common.inheritHint') },
            ...THINKING_LEVELS.map((level) => ({
              value: level as string,
              label: t(`level.${level}.label`),
              title: t(`level.${level}.note`),
            })),
          ].map((option) => (
            <Pill
              key={option.value || 'inherit'}
              active={(profile.reasoning ?? '') === option.value}
              role="radio"
              aria-checked={(profile.reasoning ?? '') === option.value}
              title={option.title}
              disabled={disabled}
              onClick={() => { onChange('reasoning', option.value === '' ? undefined : option.value) }}
            >
              {option.label}
            </Pill>
          ))}
        </div>
      </Row>

      <Note>{t('reasoning.foldsToHigh')}</Note>

      {BUDGET_KEYS.map((level) => {
        const label = t(`reasoning.budget.${level}`)
        const value = budgets[level]
        const fallback = BUDGET_DEFAULTS[level] ?? 1024
        return (
          <Row
            key={level}
            label={label}
            note={value === undefined
              ? t('field.defaultIs', { value: `${String(fallback)} ${t('unit.tokens')}` })
              : undefined}
            error={props.issues.get(`thinkingBudgets.${level}`)}
            overridden={value !== undefined}
          >
            <NumberBox
              value={value}
              placeholder={String(fallback)}
              unit={t('unit.tokens')}
              ariaLabel={label}
              disabled={disabled}
              onChange={(next) => { setBudget(level, next) }}
            />
            <InheritButton
              t={t}
              overridden={value !== undefined}
              disabled={disabled}
              onInherit={() => { setBudget(level, undefined) }}
            />
          </Row>
        )
      })}

      <Note>{t('reasoning.budgetsDesc')}</Note>
    </div>
  )
}
