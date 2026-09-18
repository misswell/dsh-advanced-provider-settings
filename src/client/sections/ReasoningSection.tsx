/**
 * Reasoning section: provider-level thinking level and token budgets
 * (spec sections 25-27).
 *
 * `xhigh` and `max` are offered as levels because the schema accepts them, with
 * a note that DSH folds both onto the `high` budget — otherwise a user setting
 * an `xhigh` budget of 128k would silently get 16k. The ladder makes that fold
 * visible instead of leaving it to a paragraph nobody reads.
 */
import type { ReactNode } from 'react'
import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { THINKING_BUDGET_LEVELS, THINKING_LEVELS } from '../../shared/capabilities.js'
import { Field, Notice } from '../components/primitives.js'
import { EffortLadder, SliderField } from '../components/visual.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

/** Budget levels that actually take effect; xhigh/max fold onto `high`. */
const BUDGET_KEYS = THINKING_BUDGET_LEVELS

/** The DeepSeek Harness defaults, shown as the inherited position on a slider. */
const BUDGET_DEFAULTS: Readonly<Record<string, number>> = {
  minimal: 1024,
  low: 2048,
  medium: 8192,
  high: 16384,
}

/** Slider ceilings, generous enough to reach the largest budget a model takes. */
const BUDGET_MAX: Readonly<Record<string, number>> = {
  minimal: 8192,
  low: 16384,
  medium: 65536,
  high: 131072,
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
      <Field label={t('reasoning.level')} hint={t('reasoning.levelDesc')}>
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
              key={option.value}
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
      </Field>

      <EffortLadder t={t} level={profile.reasoning} />

      <Field label={t('reasoning.budgets')} hint={t('reasoning.budgetsDesc')}>
        <div className={cls.grid}>
          {BUDGET_KEYS.map((level) => (
            <SliderField
              key={level}
              t={t}
              id={`aps-thinking-${level}`}
              label={t(`reasoning.budget.${level}`)}
              value={budgets[level]}
              inherited={BUDGET_DEFAULTS[level] ?? 1024}
              min={0}
              max={BUDGET_MAX[level] ?? 65536}
              step={256}
              format={(value) => `${value} ${t('unit.tokens')}`}
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
