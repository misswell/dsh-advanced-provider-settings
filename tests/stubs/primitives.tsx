/**
 * Test double for `@deepseek-ai/dsh-client-ui-primitives`.
 *
 * The real package is a client ModuleLoader bundle that is not requirable outside
 * the shell, and its visual contract (class names, geometry) is not what these
 * tests are about. What they ARE about is behaviour: which element is disabled,
 * which pill is active, which switch is checked, and what text reaches the DOM.
 *
 * So each double renders a real DOM element with the props that carry that
 * behaviour, and nothing else. Every prop is forwarded as a `data-*` attribute
 * where a test might assert on it, which keeps the assertions independent of the
 * shell's own class naming.
 */
import { createElement, type ReactNode } from 'react'

/** Props every double accepts beyond its own. */
interface BaseProps {
  children?: ReactNode
  className?: string
  title?: string
  id?: string
}

/** A button that reports its variant, size, and disabled state. */
export function Button(props: BaseProps & {
  variant?: string
  size?: string
  disabled?: boolean
  onClick?: () => void
  type?: string
}): ReactNode {
  return createElement(
    'button',
    {
      type: props.type ?? 'button',
      className: props.className,
      title: props.title,
      id: props.id,
      disabled: props.disabled === true,
      'data-variant': props.variant,
      'data-size': props.size,
      onClick: props.onClick,
    },
    props.children,
  )
}

/** A text input that reports its value and disabled state. */
export function Input(props: BaseProps & {
  value?: string | number
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  type?: string
  inputMode?: string
  min?: number | string
  max?: number | string
  step?: number | string
  'aria-label'?: string
  onChange?: (event: { target: { value: string } }) => void
}): ReactNode {
  return createElement('input', {
    className: props.className,
    title: props.title,
    id: props.id,
    type: props.type ?? 'text',
    inputMode: props.inputMode,
    value: props.value,
    placeholder: props.placeholder,
    disabled: props.disabled === true,
    readOnly: true,
    min: props.min,
    max: props.max,
    step: props.step,
    'aria-label': props['aria-label'],
  })
}

/** A selectable pill; `data-active` is the assertion surface. */
export function Pill(props: BaseProps & {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  role?: string
  'aria-checked'?: boolean
}): ReactNode {
  return createElement(
    'button',
    {
      type: 'button',
      className: props.className,
      title: props.title,
      role: props.role,
      'aria-checked': props['aria-checked'],
      'data-active': props.active === true,
      'data-disabled': props.disabled === true,
      disabled: props.disabled === true,
      onClick: props.onClick,
    },
    props.children,
  )
}

/** A status tag; `data-tone` is the assertion surface. */
export function Tag(props: BaseProps & { tone?: string }): ReactNode {
  return createElement('span', { className: props.className, 'data-tone': props.tone, title: props.title }, props.children)
}

/** A labelled switch; `data-checked` is the assertion surface. */
export function Switch(props: {
  checked?: boolean
  disabled?: boolean
  label?: string
  title?: string
  onChange?: (next: boolean) => void
  className?: string
}): ReactNode {
  return createElement('span', {
    className: props.className,
    title: props.title,
    role: 'switch',
    'aria-checked': props.checked === true,
    'aria-label': props.label,
    'data-checked': props.checked === true,
    'data-disabled': props.disabled === true,
  })
}

/** A modal shell that renders its children when open. */
export function Modal(props: { open?: boolean; children?: ReactNode; title?: string; onClose?: () => void }): ReactNode {
  if (props.open === false) return null
  return createElement('div', { 'data-modal': props.title }, props.children)
}

/** The remaining kit members the client bundle references, as inert shells. */
export const Tooltip = (props: BaseProps): ReactNode => createElement('span', null, props.children)
export const DisclosureRow = (props: BaseProps & { open?: boolean; onToggle?: () => void }): ReactNode =>
  createElement('div', { 'data-open': props.open === true }, props.children)
export const RiskConfirmation = (props: BaseProps & { confirmed?: boolean; onConfirm?: () => void }): ReactNode =>
  createElement('div', { 'data-confirmed': props.confirmed === true }, props.children)
export const StateDot = (props: { tone?: string; title?: string }): ReactNode =>
  createElement('span', { 'data-tone': props.tone, title: props.title })
