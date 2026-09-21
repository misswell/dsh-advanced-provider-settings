/**
 * Shared building blocks for the settings surface.
 *
 * Every control here is a thin wrapper over a `@deepseek-ai/dsh-client-ui-primitives`
 * component, so this plugin inherits the shell's focus, disabled and theming
 * behaviour instead of reimplementing it.
 *
 * The layout rule the whole file follows: one row is one setting. The row carries
 * a label, at most one line of explanation, and exactly one control — so a value
 * is never shown twice and a section reads top-to-bottom as a list of decisions
 * rather than a stack of widgets.
 */
import type { ReactNode } from 'react'
import { Button, Pill, Tag, type TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import { cls } from '../styles.js'

/** Tone of an inline notice. */
export type NoticeTone = 'info' | 'warning' | 'danger' | 'success'

/**
 * Inline explanatory block.
 *
 * Reserved for the cases that need a box: a warning the user must act on, a
 * danger that blocks saving, or the result of an action. Everything quieter is a
 * {@link Note}, because a column of coloured rectangles has no hierarchy left.
 */
export function Notice(props: {
  tone: NoticeTone
  title?: string
  children?: ReactNode
}): ReactNode {
  const className = {
    info: cls.noticeInfo,
    warning: cls.noticeWarning,
    danger: cls.noticeDanger,
    success: cls.noticeSuccess,
  }[props.tone]
  return (
    <div className={`${cls.notice} ${className}`} role={props.tone === 'danger' ? 'alert' : undefined}>
      <div className={cls.noticeBody}>
        {props.title === undefined ? null : <strong>{props.title}</strong>}
        {props.children}
      </div>
    </div>
  )
}

/** One line of explanation, without the box. */
export function Note(props: { children: ReactNode }): ReactNode {
  return <p className={cls.note} style={{ margin: 0 }}>{props.children}</p>
}

/**
 * One setting: label and explanation on the left, one control on the right.
 *
 * `overridden` is the only status mark a row carries — an accent bar on its left
 * edge. A word for it ("已覆盖") would repeat on most rows and say nothing a
 * glance at the bar does not.
 */
export function Row(props: {
  label: string
  /** The raw schema identifier, for matching against provider documentation. */
  fieldKey?: string
  /** One line: what the setting does, and what it currently means. */
  note?: ReactNode
  error?: ReactNode
  /** Whether this row's value is set here rather than inherited. */
  overridden?: boolean
  /** Put the control on its own line under the label, for wide option lists. */
  wide?: boolean
  children: ReactNode
}): ReactNode {
  // A row that is only a label has nothing to stack under it, so the label sits
  // level with the control instead of hanging at the top of the line.
  const plain = props.note === undefined && props.error === undefined && props.fieldKey === undefined
  return (
    <div
      className={cls.row}
      data-overridden={props.overridden === true ? 'true' : undefined}
      data-wide={props.wide === true ? 'true' : undefined}
      data-plain={plain ? 'true' : undefined}
    >
      <div className={cls.rowText}>
        <span className={cls.rowLabel}>
          <span>{props.label}</span>
          {props.fieldKey === undefined ? null : <code className={cls.rowKey}>{props.fieldKey}</code>}
        </span>
        {props.note === undefined ? null : <span className={cls.rowNote}>{props.note}</span>}
        {props.error === undefined ? null : <span className={cls.error} role="alert">{props.error}</span>}
      </div>
      <div className={cls.rowControl}>{props.children}</div>
    </div>
  )
}

/** Label, help text and validation message around one control. */
export function Field(props: {
  label: string
  hint?: string | undefined
  error?: string | undefined
  /** Rendered to the right of the label, e.g. an "overridden" tag. */
  accessory?: ReactNode
  children: ReactNode
}): ReactNode {
  return (
    <div className={cls.field}>
      <div className={cls.label}>
        <span>{props.label}</span>
        {props.accessory}
      </div>
      {props.children}
      {props.error === undefined ? null : <span className={cls.error} role="alert">{props.error}</span>}
      {props.hint === undefined ? null : <span className={cls.hint}>{props.hint}</span>}
    </div>
  )
}

/**
 * A number with its unit inside the box, so the value needs no second echo.
 *
 * Empty means "inherit", which is why the default is the placeholder: the box
 * then says both what is set and what would be used otherwise, without a third
 * line of prose.
 */
export function NumberBox(props: {
  value: number | undefined
  placeholder?: string | undefined
  /** A unit label, or a control (a unit picker) to sit inside the box. */
  unit?: ReactNode
  ariaLabel: string
  disabled?: boolean | undefined
  /** Rejects a typed value that cannot be committed (a half-written object). */
  parse?: ((raw: string) => number | undefined) | undefined
  onChange: (next: number | undefined) => void
}): ReactNode {
  const { value, placeholder, unit, ariaLabel, disabled, parse, onChange } = props
  return (
    <span className={cls.num}>
      <input
        className={cls.numInput}
        type="text"
        inputMode="numeric"
        value={value === undefined ? '' : String(value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          const raw = event.currentTarget.value.trim()
          if (raw === '') {
            onChange(undefined)
            return
          }
          if (parse !== undefined) {
            const parsed = parse(raw)
            if (parsed !== undefined) onChange(parsed)
            return
          }
          if (!/^-?\d+(\.\d+)?$/.test(raw)) return
          const parsed = Number(raw)
          if (Number.isFinite(parsed)) onChange(parsed)
        }}
      />
      {unit === undefined ? null : (
        typeof unit === 'string'
          ? <span className={cls.numUnit}>{unit}</span>
          : unit
      )}
    </span>
  )
}

/** One option in a {@link ChoiceRow}. */
export interface ChoiceOption<T extends string> {
  value: T
  label: string
  title?: string | undefined
}

/** A single-choice control rendered as pills. */
export function ChoiceRow<T extends string>(props: {
  label: string
  note?: ReactNode
  value: T
  options: readonly ChoiceOption<T>[]
  onChange: (next: T) => void
  disabled?: boolean | undefined
  /** Force the options onto their own line. */
  wide?: boolean
  /**
   * Whether the choice is the user's rather than a fallback.
   *
   * Callers whose "inherit" pill is a named value like `inherit` have to say so
   * here: `value !== ''` would mark an untouched row as overridden, and the bar
   * is the one mark that claims "this is yours".
   */
  overridden?: boolean | undefined
}): ReactNode {
  const overridden = props.overridden ?? (props.value !== '')
  return (
    <Row
      label={props.label}
      note={props.note}
      overridden={overridden}
      wide={props.wide}
    >
      <div className={cls.tagList} role="radiogroup" aria-label={props.label}>
        {props.options.map((option) => (
          <Pill
            key={option.value || 'inherit'}
            active={option.value === props.value}
            title={option.title}
            role="radio"
            aria-checked={option.value === props.value}
            disabled={props.disabled}
            onClick={() => { props.onChange(option.value) }}
          >
            {option.label}
          </Pill>
        ))}
      </div>
    </Row>
  )
}

/** A collapsible section card: header row, then its rows. */
export function SectionShell(props: {
  id: string
  title: string
  description?: string | undefined
  /** Short status text shown next to the title. */
  badge?: string | undefined
  tone?: TagTone | undefined
  open: boolean
  onToggle: () => void
  /** Rendered at the right of the header row. */
  actions?: ReactNode
  children: ReactNode
}): ReactNode {
  return (
    <section className={cls.card} aria-labelledby={`${props.id}-title`}>
      <div
        className={cls.cardHead}
        role="button"
        tabIndex={0}
        onClick={props.onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            props.onToggle()
          }
        }}
      >
        <span className={cls.cardChevron} data-open={props.open}>▶</span>
        <button
          type="button"
          className={cls.cardTitle}
          aria-expanded={props.open}
          aria-controls={`${props.id}-body`}
          id={`${props.id}-title`}
          onClick={(event) => { event.stopPropagation(); props.onToggle() }}
        >
          {props.title}
        </button>
        {props.badge === undefined ? null : <Tag tone={props.tone ?? 'outline'}>{props.badge}</Tag>}
        <span className={cls.spacer} />
        {props.actions}
      </div>
      {props.open ? (
        <div className={cls.cardBody} id={`${props.id}-body`}>
          {props.description === undefined ? null : (
            <p className={cls.cardDesc} style={{ margin: 0 }}>{props.description}</p>
          )}
          {props.children}
        </div>
      ) : null}
    </section>
  )
}

/** A row of actions. */
export function Toolbar(props: { children: ReactNode }): ReactNode {
  return <div className={cls.toolbar}>{props.children}</div>
}

/** Text button styled as a link, for destructive or secondary row actions. */
export function LinkButton(props: {
  label: string
  title?: string | undefined
  disabled?: boolean | undefined
  onClick: () => void
}): ReactNode {
  return (
    <Button
      variant="ghost"
      size="sm"
      title={props.title}
      disabled={props.disabled}
      aria-label={props.label}
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  )
}
