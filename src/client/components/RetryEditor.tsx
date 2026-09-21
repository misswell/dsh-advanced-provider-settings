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
import { Button, Input, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  DEFAULT_RETRYABLE_CODES,
  RETRY_DEFAULTS,
  RETRY_PRESETS,
  matchRetryPreset,
  type RetryPresetId,
} from '../../shared/retry.js'
import { cls } from '../styles.js'
import { Note, Notice, NumberBox, Row } from './primitives.js'
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
  const delayIssue = (key: 'initialDelayMs' | 'maxDelayMs'): string | undefined =>
    props.issues.get(`retryPolicy.backoff.${key}`) ?? props.issues.get(`backoff.${key}`)

  return (
    <div className={cls.section}>
      <Row
        label={t('retry.preset')}
        note={t(PRESET_COPY[activePreset].desc)}
        wide
      >
        <div className={cls.tagList} role="radiogroup" aria-label={t('retry.preset')}>
          {RETRY_PRESETS.map((preset) => (
            <Pill
              key={preset.id}
              role="radio"
              aria-checked={preset.id === activePreset}
              active={preset.id === activePreset}
              disabled={disabled}
              title={t(PRESET_COPY[preset.id].desc)}
              onClick={() => { choosePreset(preset.id) }}
            >
              {t(PRESET_COPY[preset.id].title)}
            </Pill>
          ))}
          {/* "Custom" is a state rather than a choice: it appears only once the
              values stop matching a preset, so it is shown and not clickable. */}
          {activePreset === 'custom' ? (
            <Pill active role="radio" aria-checked>{t(PRESET_COPY.custom.title)}</Pill>
          ) : null}
        </div>
      </Row>

      {state === null ? null : (
        <>
          <Row
            label={t('retry.mode')}
            note={state.mode === 'always' ? t('retry.mode.alwaysDesc') : t('retry.mode.normalDesc')}
            error={props.issues.get('mode')}
            overridden
          >
            <div className={cls.tagList} role="radiogroup" aria-label={t('retry.mode')}>
              {(['normal', 'always'] as const).map((mode) => (
                <Pill
                  key={mode}
                  role="radio"
                  aria-checked={state.mode === mode}
                  active={state.mode === mode}
                  disabled={disabled}
                  onClick={() => {
                    onChange({ ...state, mode })
                    if (mode === 'always') setAlerted(true)
                  }}
                >
                  {t(`retry.mode.${mode}`)}
                </Pill>
              ))}
            </div>
          </Row>

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
            <>
              <Row
                label={t('retry.maxRetries')}
                note={t('retry.maxRetriesDesc')}
                error={props.issues.get('maxRetries')}
                overridden
              >
                <NumberBox
                  value={state.maxRetries}
                  placeholder={String(RETRY_DEFAULTS.maxRetries)}
                  ariaLabel={t('retry.maxRetries')}
                  disabled={disabled}
                  onChange={(next) => { onChange({ ...state, maxRetries: next ?? 0 }) }}
                />
              </Row>

              <Row
                label={t('retry.retryableCodes')}
                note={t('retry.retryableCodesDesc')}
                error={codesError}
                overridden
                wide
              >
                <Input
                  className={`${cls.mono} ${cls.input}`}
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
              </Row>
            </>
          ) : null}

          <Row
            label={t('retry.initialDelayMs')}
            note={delayNote(t, state.initialDelayMs, RETRY_DEFAULTS.initialDelayMs)}
            error={delayIssue('initialDelayMs')}
            overridden
          >
            <NumberBox
              value={state.initialDelayMs}
              placeholder={String(RETRY_DEFAULTS.initialDelayMs)}
              unit="ms"
              ariaLabel={t('retry.initialDelayMs')}
              disabled={disabled}
              onChange={(next) => { onChange({ ...state, initialDelayMs: next ?? 1 }) }}
            />
          </Row>

          <Row
            label={t('retry.maxDelayMs')}
            note={delayNote(t, state.maxDelayMs, RETRY_DEFAULTS.maxDelayMs)}
            error={delayIssue('maxDelayMs')}
            overridden
          >
            <NumberBox
              value={state.maxDelayMs}
              placeholder={String(RETRY_DEFAULTS.maxDelayMs)}
              unit="ms"
              ariaLabel={t('retry.maxDelayMs')}
              disabled={disabled}
              onChange={(next) => { onChange({ ...state, maxDelayMs: next ?? 1 }) }}
            />
          </Row>

          <Row
            label={t('retry.jitterRatio')}
            note={t('retry.jitterRatioDesc')}
            error={props.issues.get('retryPolicy.backoff.jitterRatio') ?? props.issues.get('backoff.jitterRatio')}
            overridden
          >
            <NumberBox
              value={state.jitterRatio}
              placeholder={String(RETRY_DEFAULTS.jitterRatio)}
              ariaLabel={t('retry.jitterRatio')}
              disabled={disabled}
              onChange={(next) => { onChange({ ...state, jitterRatio: next ?? 0 }) }}
            />
          </Row>

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

          {/* Resetting the policy is the "Harness 默认" preset above, so there is
              no second inherit control here — only the reason there is no
              per-model retry to configure. */}
          <Note>{t('retry.notPerModel')}</Note>
        </>
      )}
    </div>
  )
}

/** One delay row's note: what it means out loud, and the default it differs from. */
function delayNote(t: Translate, value: number, fallback: number): string {
  const human = formatDuration(value, t)
  return value === fallback ? human : `${human} · ${t('field.defaultIs', { value: formatDuration(fallback, t) })}`
}

/** Translate a shared-validator issue into a message using the retry copy table. */
export function retryIssueMessage(t: Translate, code: string): string {
  const key = ISSUE_COPY[code]
  return key === undefined ? code : t(key)
}
