/**
 * Reasoning section: provider-level thinking level and token budgets
 * (spec sections 25-27).
 *
 * `xhigh` and `max` are offered as levels because the schema accepts them, with
 * a note that DSH folds both onto the `high` budget — otherwise a user setting
 * an `xhigh` budget of 128k would silently get 16k.
 */
import type { ReactNode } from 'react'
import { THINKING_BUDGET_LEVELS, THINKING_LEVELS } from '../../shared/capabilities.js'
import { ChoiceRow, Field, NumberField, Notice } from '../components/primitives.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

/** Budget levels that actually take effect; xhigh/max fold onto `high`. */
const BUDGET_KEYS = THINKING_BUDGET_LEVELS

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
      <ChoiceRow
        label={t('reasoning.level')}
        hint={t('reasoning.levelDesc')}
        value={profile.reasoning ?? ''}
        disabled={disabled}
        options={[
          { value: '', label: t('common.inherit'), title: t('common.inheritHint') },
          ...THINKING_LEVELS.map((level) => ({ value: level, label: level })),
        ]}
        onChange={(next) => { onChange('reasoning', next === '' ? undefined : next) }}
      />

      <Field label={t('reasoning.budgets')} hint={t('reasoning.budgetsDesc')}>
        <div className={cls.grid}>
          {BUDGET_KEYS.map((level) => (
            <NumberField
              key={level}
              id={`aps-thinking-${level}`}
              label={t(`reasoning.budget.${level}`)}
              value={budgets[level]}
              min={0}
              disabled={disabled}
              error={props.issues.get(`thinkingBudgets.${level}`)}
              onChange={(next) => { setBudget(level, next) }}
            />
          ))}
        </div>
      </Field>

      <Notice tone="info">{t('reasoning.foldsToHigh')}</Notice>
      <span className={cls.hint}>{t('reasoning.levelsDesc')}</span>
    </div>
  )
}
