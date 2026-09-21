/**
 * The few affordances that carry information no label can.
 *
 * The rule for anything added here: it must say something the row's label, its
 * one line of note and its control do not. A second rendering of a value that is
 * already on screen is not a visual aid, it is noise — which is why this file is
 * short. What survives is the retry backoff (a sequence of five numbers is hard
 * to read as numbers, easy to read as bars) and the two formatters, since
 * `300000` and `20971520` mean nothing to a person and `5 min` / `20 MiB` do.
 */
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'

/**
 * Format a millisecond count the way a person would say it.
 * @param ms - the duration in milliseconds.
 * @param t - bound translate for the unit labels.
 * @returns a short human duration, e.g. `2 min` or `500 ms`.
 */
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
 * The one reset affordance, shown only where there is something to reset.
 *
 * It is a text button rather than a row of status prose because the row already
 * says what is set: the action is the useful part.
 */
export function InheritButton(props: {
  t: Translate
  overridden: boolean
  disabled?: boolean | undefined
  onInherit: () => void
}): ReactNode {
  if (!props.overridden) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={props.disabled}
      title={props.t('field.resetToDefault.note')}
      onClick={props.onInherit}
    >
      {props.t('common.inherit')}
    </Button>
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
    return <p className={cls.rowNote}>{props.t('retry.curveEmpty')}</p>
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
    </div>
  )
}

/**
 * A labelled cluster heading inside a long list of flags.
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
