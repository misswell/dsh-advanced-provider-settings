/**
 * Small shared building blocks for the settings surface.
 *
 * Every control here is a thin wrapper over a `@deepseek-ai/dsh-client-ui-primitives`
 * component, so this plugin inherits the shell's focus, disabled and theming
 * behaviour instead of reimplementing it.
 */
import type { ReactNode } from 'react'
import { Button, Input, Pill, Switch, Tag, type TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'

/** Tone of an inline notice. */
export type NoticeTone = 'info' | 'warning' | 'danger' | 'success'

/** Inline explanatory block. */
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

/** A tag marking a field as explicitly overridden rather than inherited. */
export function OverrideTag({ t, overridden }: { t: Translate; overridden: boolean }): ReactNode {
  if (!overridden) return null
  return <Tag tone="info">{t('status.custom')}</Tag>
}

/**
 * Numeric field where empty means "inherit".
 *
 * Kept as text rather than a number input so a partially typed value (a lone
 * minus sign, an empty box) does not get coerced into a write.
 */
export function NumberField(props: {
  id: string
  label: string
  hint?: string | undefined
  error?: string | undefined
  value: number | undefined
  placeholder?: string | undefined
  min?: number | undefined
  max?: number | undefined
  step?: number | undefined
  narrow?: boolean
  disabled?: boolean | undefined
  accessory?: ReactNode
  onChange: (next: number | undefined) => void
}): ReactNode {
  const text = props.value === undefined ? '' : String(props.value)
  return (
    <Field
      label={props.label}
      hint={props.hint}
      error={props.error}
      accessory={props.accessory}
    >
      <Input
        id={props.id}
        className={`${cls.mono} ${props.narrow === true ? cls.inputNarrow : cls.input}`}
        type="text"
        inputMode="numeric"
        value={text}
        placeholder={props.placeholder}
        aria-label={props.label}
        disabled={props.disabled}
        onChange={(event) => {
          const raw = event.currentTarget.value.trim()
          if (raw === '') {
            props.onChange(undefined)
            return
          }
          if (!/^-?\d+(\.\d+)?$/.test(raw)) return
          const parsed = Number(raw)
          if (!Number.isFinite(parsed)) return
          props.onChange(parsed)
        }}
      />
    </Field>
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
  hint?: string | undefined
  value: T
  options: readonly ChoiceOption<T>[]
  onChange: (next: T) => void
  accessory?: ReactNode
  disabled?: boolean | undefined
}): ReactNode {
  return (
    <Field label={props.label} hint={props.hint} accessory={props.accessory}>
      <div className={cls.tagList} role="radiogroup" aria-label={props.label}>
        {props.options.map((option) => (
          <Pill
            key={option.value}
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
    </Field>
  )
}

/** A labelled boolean toggle. */
export function ToggleField(props: {
  label: string
  hint?: string | undefined
  checked: boolean
  disabled?: boolean
  title?: string | undefined
  onChange: (next: boolean) => void
}): ReactNode {
  return (
    <Field label={props.label} hint={props.hint}>
      <div className={cls.fieldRow}>
        <Switch
          checked={props.checked}
          onChange={props.onChange}
          label={props.label}
          disabled={props.disabled}
          title={props.title}
        />
      </div>
    </Field>
  )
}

/** A collapsible section with a status chip. */
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
    <section className={cls.section} aria-labelledby={`${props.id}-title`}>
      <div className={cls.sectionHead}>
        <button
          type="button"
          className={cls.sectionTitle}
          aria-expanded={props.open}
          aria-controls={`${props.id}-body`}
          onClick={props.onToggle}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
          id={`${props.id}-title`}
        >
          {props.title}
        </button>
        {props.badge === undefined ? null : <Tag tone={props.tone ?? 'outline'}>{props.badge}</Tag>}
        <span className={cls.spacer} />
        {props.actions}
      </div>
      {props.description === undefined ? null : <p className={cls.sectionDesc} style={{ margin: 0 }}>{props.description}</p>}
      {props.open ? <div id={`${props.id}-body`}>{props.children}</div> : null}
    </section>
  )
}

/** A row of actions. */
export function Toolbar(props: { children: ReactNode }): ReactNode {
  return <div className={cls.toolbar}>{props.children}</div>
}

/** A small monospace chip. */
export function Mono(props: { children: ReactNode }): ReactNode {
  return <span className={cls.mono}>{props.children}</span>
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
