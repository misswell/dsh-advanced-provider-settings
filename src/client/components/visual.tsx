/**
 * Visual affordances layered over the shell's own primitives.
 *
 * These exist because the settings surface inherited from Harness is a form: a
 * column of labelled text inputs. A form tells you what a value *is* but not
 * what it *does* — whether you are looking at your own override or an inherited
 * default, what a duration means in milliseconds, or what a retry policy does
 * over time. Everything here answers one of those questions in the shape of the
 * data itself, and deliberately uses the shell's vocabulary (`StateDot`, `Pill`,
 * `Tag`) plus `--dsw-*` tokens so it reads as part of the product rather than a
 * panel bolted into it.
 */
import type { ReactNode } from 'react'
import { Button, Input, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import { Field } from './primitives.js'

/**
 * Whether a value is inherited from a broader layer or set here.
 *
 * Uses `StateDot` rather than a coloured word so a column of these can be
 * scanned vertically; the label carries the meaning for screen readers.
 */
export function ValueSource({ t, overridden }: { t: Translate; overridden: boolean }): ReactNode {
  return (
    <span className={cls.source} data-overridden={overridden ? 'true' : 'false'}>
      <StateDot state={overridden ? 'ongoing' : 'idle'} size={6} />
      <span>{t(overridden ? 'field.overridden' : 'field.inherited')}</span>
    </span>
  )
}

/** Format a millisecond count the way a person would say it. */
export function formatDuration(ms: number, t: Translate): string {
  if (ms < 1000) return `${ms} ${t('unit.ms')}`
  if (ms % 60000 === 0) return `${ms / 60000} ${t('unit.min')}`
  if (ms < 60000) return `${Math.round(ms / 100) / 10} ${t('unit.s')}`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return seconds === 0
    ? `${minutes} ${t('unit.min')}`
    : `${minutes} ${t('unit.min')} ${seconds} ${t('unit.s')}`
}

/**
 * Format a byte count in binary units.
 *
 * Deliberately KiB/MiB/GiB rather than KB/MB/GB: the schema's limits are
 * powers of two, so `maxRequestImageBytes: 1048576` is 1 MiB and calling it
 * "1 MB" would be off by about 5 percent in the direction that matters when the
 * server enforces a real limit.
 */
export function formatBytes(bytes: number, t: Translate): string {
  if (bytes >= 1024 * 1024 * 1024) {
    const gib = bytes / (1024 * 1024 * 1024)
    return `${Math.round(gib * 10) / 10} ${t('unit.gib')}`
  }
  if (bytes >= 1024 * 1024) {
    const mib = bytes / (1024 * 1024)
    return `${Math.round(mib * 10) / 10} ${t('unit.mib')}`
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ${t('unit.kib')}`
  return `${bytes} B`
}

/**
 * A number that is usually left alone, with the inherited default made visible.
 *
 * The problem this solves: a bare box with "1024" in a placeholder gives no
 * sense of scale, so you cannot tell whether 1024 is near the floor or the
 * ceiling. The slider shows the legal range, the tick shows where the inherited
 * default sits inside it, and the buttons say explicitly which one you are on.
 */
export function SliderField(props: {
  t: Translate
  id: string
  label: string
  hint?: string | undefined
  error?: string | undefined
  /** `undefined` means inherit. */
  value: number | undefined
  /** The value in force when nothing is set at this layer. */
  inherited: number
  min: number
  max: number
  step?: number | undefined
  /** Unit-aware rendering of a value, e.g. `2 min` or `10 MB`. */
  format: (value: number) => string
  disabled?: boolean | undefined
  onChange: (next: number | undefined) => void
}): ReactNode {
  const overridden = props.value !== undefined
  const current = props.value ?? props.inherited
  const span = props.max - props.min
  const ratio = span <= 0 ? 0 : (current - props.min) / span
  const inheritedRatio = span <= 0 ? 0 : (props.inherited - props.min) / span
  const percent = `${Math.min(100, Math.max(0, ratio * 100))}%`
  const inheritedPercent = `${Math.min(100, Math.max(0, inheritedRatio * 100))}%`

  return (
    <Field
      label={props.label}
      hint={props.hint}
      error={props.error}
      accessory={<ValueSource t={props.t} overridden={overridden} />}
    >
      <div className={cls.slider}>
        <div className={cls.sliderTrack}>
          <div className={cls.sliderFill} style={{ width: percent }} />
          <div className={cls.sliderInherited} style={{ left: inheritedPercent }} title={props.format(props.inherited)} />
        </div>
        <input
          id={props.id}
          className={cls.sliderInput}
          type="range"
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={current}
          disabled={props.disabled}
          aria-label={props.label}
          onChange={(event) => { props.onChange(Number(event.currentTarget.value)) }}
        />
      </div>
      <div className={cls.sliderRow}>
        <Input
          className={`${cls.mono} ${cls.inputNarrow}`}
          type="text"
          inputMode="numeric"
          value={props.value === undefined ? '' : String(props.value)}
          placeholder={String(props.inherited)}
          disabled={props.disabled}
          aria-label={props.label}
          onChange={(event) => {
            const raw = event.currentTarget.value.trim()
            if (raw === '') {
              props.onChange(undefined)
              return
            }
            if (!/^\d+$/.test(raw)) return
            const parsed = Number(raw)
            if (!Number.isFinite(parsed)) return
            props.onChange(parsed)
          }}
        />
        <span className={cls.sliderValue}>{props.format(current)}</span>
        <span className={cls.sliderDefault}>{props.t('field.defaultIs', { value: props.format(props.inherited) })}</span>
        {overridden ? (
          <Button onClick={() => { props.onChange(undefined) }} title={props.t('field.resetToDefault.note')}>
            {props.t('field.resetToDefault')}
          </Button>
        ) : null}
      </div>
    </Field>
  )
}

/**
 * The retry backoff, drawn.
 *
 * A retry policy is a shape over time — "4 tries, 500 ms, doubling, capped at
 * 30 s" — and reading that as four numbers tells you much less than seeing the
 * bars. Widths are proportional to the longest wait so the growth is legible,
 * and each bar prints the real duration so the picture never replaces the fact.
 */
export function BackoffCurve(props: {
  t: Translate
  /** Number of retries after the first attempt. */
  retries: number
  initialMs: number
  maxMs?: number | undefined
  factor?: number | undefined
}): ReactNode {
  const factor = props.factor ?? 2
  if (!Number.isFinite(props.retries) || props.retries < 1 || props.initialMs <= 0) {
    return <p className={cls.hint} style={{ margin: 0 }}>{props.t('retry.curveEmpty')}</p>
  }

  const waits: number[] = []
  let wait = props.initialMs
  for (let index = 0; index < props.retries; index += 1) {
    const capped = props.maxMs === undefined ? wait : Math.min(wait, props.maxMs)
    waits.push(capped)
    wait = capped * factor
  }

  const longest = Math.max(...waits)
  const total = waits.reduce((sum, value) => sum + value, 0)

  return (
    <div className={cls.curve} aria-label={props.t('retry.curveTitle')} role="img">
      <div className={cls.curveHead}>
        <span>{props.t('retry.curveTitle')}</span>
        <span className={cls.curveTotal}>{props.t('retry.curveTotal', { value: formatDuration(total, props.t) })}</span>
      </div>
      {waits.map((value, index) => (
        <div className={cls.curveRow} key={index}>
          <span className={cls.curveLabel}>{props.t('retry.attempt', { n: index + 1 })}</span>
          <span className={cls.curveBarTrack}>
            <span className={cls.curveBar} style={{ width: `${longest === 0 ? 0 : (value / longest) * 100}%` }} />
          </span>
          <span className={cls.curveValue}>{formatDuration(value, props.t)}</span>
        </div>
      ))}
      <p className={cls.hint} style={{ margin: 0 }}>{props.t('retry.curveTitle.note')}</p>
    </div>
  )
}

/**
 * Where a thinking level sits on the ladder Harness actually sends.
 *
 * `xhigh` and `max` are accepted by the schema but folded down to `high` before
 * the request leaves, so a picker that renders seven equal options implies a
 * granularity that does not exist. The ladder shows the five levels that reach
 * the wire and marks the folded ones as landing on `high`.
 */
const LADDER = ['off', 'minimal', 'low', 'medium', 'high'] as const

export function EffortLadder({ t, level }: { t: Translate; level: string | false | undefined }): ReactNode {
  // `false` is the schema's explicit "off"; `undefined` means inherit.
  const effective = level === false ? 'off' : level
  const folded = effective === 'xhigh' || effective === 'max'
  const landed = folded ? 'high' : effective
  const activeIndex = LADDER.findIndex((entry) => entry === landed)

  return (
    <div className={cls.ladder}>
      <div className={cls.ladderRow} role="img" aria-label={t('reasoning.curve')}>
        {LADDER.map((entry, index) => {
          const reached = activeIndex >= 0 && index <= activeIndex
          return (
            <span
              key={entry}
              className={cls.ladderStep}
              data-reached={reached ? 'true' : 'false'}
              data-active={index === activeIndex ? 'true' : 'false'}
              title={t(`level.${entry}.note`)}
            >
              <span className={cls.ladderBar} />
              <span className={cls.ladderName}>{t(`level.${entry}.label`)}</span>
            </span>
          )
        })}
      </div>
      <p className={cls.hint} style={{ margin: 0 }}>
        {folded ? t('reasoning.curveFolded', { from: t(`level.${effective}.label`) }) : t('reasoning.curve.note')}
      </p>
    </div>
  )
}

/**
 * A labelled cluster of related flags.
 *
 * The 26 compat fields describe six different concerns; presented as one flat
 * list they are unreadable, so each cluster gets a heading and a count of how
 * many of its members are overridden.
 */
export function GroupHeader(props: {
  label: string
  note: string
  overridden: number
  total: number
}): ReactNode {
  return (
    <div className={cls.groupHead}>
      <span className={cls.groupTitle}>{props.label}</span>
      <span className={cls.groupCount}>
        {props.overridden === 0 ? `${props.total}` : `${props.overridden}/${props.total}`}
      </span>
      <span className={cls.groupNote}>{props.note}</span>
    </div>
  )
}
