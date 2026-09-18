/**
 * Retry policy editor.
 *
 * Two rules from the Harness resolver shape this UI and are worth stating
 * plainly, because the schema alone would let a user save a profile that throws
 * later:
 *
 *  - `mode` is REQUIRED whenever `retryPolicy` is present. There is no such
 *    thing as "a retry policy without a mode", so choosing a preset always
 *    writes one, and choosing Harness Default writes nothing at all.
 *  - A delay of `0` passes `z.natural()` and then fails resolution. The editor
 *    therefore treats blank as "inherit" and rejects zero outright.
 *
 * `always` is offered but gated behind an explicit acknowledgement: it retries
 * until success or cancellation, which is a different operational proposition
 * from "retry five times".
 */
import { useState, type ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  DEFAULT_RETRYABLE_CODES,
  MAX_TIMER_DELAY_MS,
  RETRY_DEFAULTS,
  RETRY_PRESETS,
  matchRetryPreset,
  type RetryPresetId,
} from '../../shared/retry.js'
import { cls } from '../styles.js'
import { Notice, NumberField, Field, Toolbar } from './primitives.js'
import { BackoffCurve, formatDuration } from './visual.js'
import type { Translate } from '../contract.js'
import type { RetryEditorState } from '../../shared/retry.js'

/** Locale keys for each preset's title and description. */
const PRESET_COPY: Record<RetryPresetId, { title: string; desc: string }> = {
  'harness-default': { title: 'retry.preset.harnessDefault', desc: 'retry.preset.harnessDefaultDesc' },
  conservative: { title: 'retry.preset.conservative', desc: 'retry.preset.conservativeDesc' },
  aggressive: { title: 'retry.preset.aggressive', desc: 'retry.preset.aggressiveDesc' },
  custom: { title: 'retry.preset.custom', desc: 'retry.preset.customDesc' },
}

/** Locale key for each validation code the shared validator can produce. */
const ISSUE_COPY: Record<string, string> = {
  'max-retries-negative': 'retry.maxRetries',
  'max-retries-not-integer': 'retry.maxRetries',
  'codes-empty': 'retry.codes.empty',
  'codes-not-string': 'retry.retryableCodes',
  'codes-duplicate': 'retry.retryableCodes',
  'jitter-out-of-range': 'retry.jitterRatio',
  'jitter-not-finite': 'retry.jitterRatio',
  'backoff-initial-invalid': 'retry.initialDelayMs',
  'backoff-max-invalid': 'retry.maxDelayMs',
  'backoff-initial-exceeds-max': 'retry.maxDelayMs',
  'mode-required': 'retry.mode',
  'mode-invalid': 'retry.mode',
}

/**
 * Render the retry editor.
 * @param props - the draft state, its sink, and validation messages by field.
 * @returns the editor element.
 */
export function RetryEditor(props: {
  t: Translate
  state: RetryEditorState | null
  onChange: (next: RetryEditorState | null) => void
  /** Field-keyed messages produced by the shared validator. */
  issues: ReadonlyMap<string, string>
  disabled?: boolean | undefined
  /** Whether the run has already acknowledged the always-retry warning. */
  acknowledged: boolean
  onAcknowledge: () => void
}): ReactNode {
  const { t, state, onChange, disabled } = props
  const [alerted, setAlerted] = useState(false)

  const activePreset = state === null
    ? 'harness-default'
    : matchRetryPreset(
        state.mode === 'normal'
          ? {
              mode: 'normal',
              maxRetries: state.maxRetries,
              retryableCodes: [...state.retryableCodes],
              backoff: {
                initialDelayMs: state.initialDelayMs,
                maxDelayMs: state.maxDelayMs,
                jitterRatio: state.jitterRatio,
              },
            }
          : {
              mode: 'always',
              backoff: {
                initialDelayMs: state.initialDelayMs,
                maxDelayMs: state.maxDelayMs,
                jitterRatio: state.jitterRatio,
              },
            },
      )

  const choosePreset = (id: RetryPresetId): void => {
    if (id === 'harness-default') {
      onChange(null)
      return
    }
    const preset = RETRY_PRESETS.find((candidate) => candidate.id === id)
    if (preset === undefined || preset.policy === null) return
    const policy = preset.policy
    onChange({
      mode: policy.mode,
      maxRetries: policy.mode === 'normal' ? policy.maxRetries ?? RETRY_DEFAULTS.maxRetries : RETRY_DEFAULTS.maxRetries,
      retryableCodes: policy.mode === 'normal'
        ? [...(policy.retryableCodes ?? DEFAULT_RETRYABLE_CODES)]
        : [...DEFAULT_RETRYABLE_CODES],
      initialDelayMs: policy.backoff?.initialDelayMs ?? RETRY_DEFAULTS.initialDelayMs,
      maxDelayMs: policy.backoff?.maxDelayMs ?? RETRY_DEFAULTS.maxDelayMs,
      jitterRatio: policy.backoff?.jitterRatio ?? RETRY_DEFAULTS.jitterRatio,
    })
  }

  const alwaysNeedsAck = state?.mode === 'always' && !props.acknowledged && !alerted

  const codesError = props.issues.get('retryableCodes') ?? props.issues.get('retryPolicy.retryableCodes')

  return (
    <div className={cls.section}>
      <p className={cls.hint} style={{ margin: 0 }}>{t('retry.desc')}</p>

      <Field label={t('retry.preset')}>
        <div className={cls.presetList} role="radiogroup" aria-label={t('retry.preset')}>
          {(['harness-default', 'conservative', 'aggressive', 'custom'] as const).map((id) => {
            const copy = PRESET_COPY[id]
            // "Custom" is a state, not a choice: it appears only once the values
            // stop matching a preset, so it is not clickable.
            const selectable = id !== 'custom'
            return (
              <label
                key={id}
                className={cls.preset}
                data-active={id === activePreset}
                style={{ cursor: selectable && !disabled ? 'pointer' : 'default', opacity: selectable ? 1 : 0.7 }}
              >
                <input
                  type="radio"
                  name="aps-retry-preset"
                  checked={id === activePreset}
                  disabled={disabled || !selectable}
                  onChange={() => { choosePreset(id) }}
                />
                <span className={cls.presetBody}>
                  <span className={cls.presetTitle}>{t(copy.title)}</span>
                  <span className={cls.hint}>{t(copy.desc)}</span>
                </span>
              </label>
            )
          })}
        </div>
      </Field>

      {state === null ? null : (
        <>
          <Field label={t('retry.mode')} hint={state.mode === 'always' ? t('retry.mode.alwaysDesc') : t('retry.mode.normalDesc')}>
            <div className={cls.tagList} role="radiogroup" aria-label={t('retry.mode')}>
              <Button
                variant={state.mode === 'normal' ? 'primary' : 'outline'}
                size="sm"
                disabled={disabled}
                onClick={() => { onChange({ ...state, mode: 'normal' }) }}
              >
                {t('retry.mode.normal')}
              </Button>
              <Button
                variant={state.mode === 'always' ? 'primary' : 'outline'}
                size="sm"
                disabled={disabled}
                onClick={() => { onChange({ ...state, mode: 'always' }); setAlerted(true) }}
              >
                {t('retry.mode.always')}
              </Button>
            </div>
          </Field>

          {alwaysNeedsAck ? (
            <Notice tone="danger" title={t('retry.alwaysTitle')}>
              <span>{t('retry.alwaysBody')}</span>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { props.onAcknowledge(); setAlerted(true) }}
                >
                  {t('retry.alwaysAck')}
                </Button>
              </div>
            </Notice>
          ) : null}

          {state.mode === 'normal' ? (
            <div className={cls.grid}>
              <NumberField
                id="aps-retry-max"
                label={t('retry.maxRetries')}
                hint={t('retry.maxRetriesDesc')}
                value={state.maxRetries}
                min={0}
                placeholder="5"
                disabled={disabled}
                onChange={(next) => { onChange({ ...state, maxRetries: next ?? 0 }) }}
              />
              <Field label={t('retry.retryableCodes')} hint={t('retry.retryableCodesDesc')} error={codesError}>
                <input
                  className={`${cls.mono} ${cls.input}`}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--dsw-border-1,rgba(128,128,128,.35))',
                    borderRadius: 6,
                    padding: '5px 8px',
                    color: 'inherit',
                  }}
                  value={state.retryableCodes.join(', ')}
                  disabled={disabled}
                  spellCheck={false}
                  aria-label={t('retry.retryableCodes')}
                  onChange={(event) => {
                    const codes = event.currentTarget.value
                      .split(',')
                      .map((code) => code.trim())
                      .filter((code) => code.length > 0)
                    onChange({ ...state, retryableCodes: codes })
                  }}
                />
              </Field>
            </div>
          ) : (
            <Notice tone="info">{t('retry.notPerModel')}</Notice>
          )}

          <div className={cls.grid}>
            <NumberField
              id="aps-retry-initial"
              label={t('retry.initialDelayMs')}
              hint={formatDuration(state.initialDelayMs, t)}
              value={state.initialDelayMs}
              min={1}
              max={MAX_TIMER_DELAY_MS}
              placeholder="500"
              disabled={disabled}
              error={props.issues.get('retryPolicy.backoff.initialDelayMs') ?? props.issues.get('backoff.initialDelayMs')}
              onChange={(next) => { onChange({ ...state, initialDelayMs: next ?? 1 }) }}
            />
            <NumberField
              id="aps-retry-maxdelay"
              label={t('retry.maxDelayMs')}
              hint={formatDuration(state.maxDelayMs, t)}
              value={state.maxDelayMs}
              min={1}
              max={MAX_TIMER_DELAY_MS}
              placeholder="10000"
              disabled={disabled}
              error={props.issues.get('retryPolicy.backoff.maxDelayMs') ?? props.issues.get('backoff.maxDelayMs')}
              onChange={(next) => { onChange({ ...state, maxDelayMs: next ?? 1 }) }}
            />
            <NumberField
              id="aps-retry-jitter"
              label={t('retry.jitterRatio')}
              hint={t('retry.jitterRatioDesc')}
              value={state.jitterRatio}
              min={0}
              max={1}
              placeholder="0.1"
              narrow
              disabled={disabled}
              error={props.issues.get('retryPolicy.backoff.jitterRatio') ?? props.issues.get('backoff.jitterRatio')}
              onChange={(next) => { onChange({ ...state, jitterRatio: next ?? 0 }) }}
            />
          </div>

          {/* `always` retries until the route succeeds, so there is no finite
              curve to draw; the schema also drops maxRetries in that mode. */}
          {state.mode === 'normal' ? (
            <BackoffCurve
              t={t}
              retries={state.maxRetries}
              initialMs={state.initialDelayMs}
              maxMs={state.maxDelayMs}
            />
          ) : null}

          <Toolbar>
            <Tag tone={state.mode === 'always' ? 'warning' : 'neutral'}>
              {state.mode === 'always' ? t('status.always') : t('status.retries', { count: state.maxRetries })}
            </Tag>
            <span className={cls.spacer} />
            <span className={cls.hint}>{t('retry.notPerModel')}</span>
          </Toolbar>
        </>
      )}
    </div>
  )
}

/** Translate a shared-validator issue into a message using the retry copy table. */
export function retryIssueMessage(t: Translate, code: string): string {
  const key = ISSUE_COPY[code]
  return key === undefined ? code : t(key)
}
