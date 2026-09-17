/**
 * Small shared building blocks for the settings surface.
 *
 * Every control here is a thin wrapper over a `@deepseek-ai/dsh-client-ui-primitives`
 * component, so this plugin inherits the shell's focus, disabled and theming
 * behaviour instead of reimplementing it.
 */
import type { ReactNode } from 'react';
import { type TagTone } from '@deepseek-ai/dsh-client-ui-primitives';
import type { Translate } from '../contract.js';
/** Tone of an inline notice. */
export type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
/** Inline explanatory block. */
export declare function Notice(props: {
    tone: NoticeTone;
    title?: string;
    children?: ReactNode;
}): ReactNode;
/** Label, help text and validation message around one control. */
export declare function Field(props: {
    label: string;
    hint?: string | undefined;
    error?: string | undefined;
    /** Rendered to the right of the label, e.g. an "overridden" tag. */
    accessory?: ReactNode;
    children: ReactNode;
}): ReactNode;
/** A tag marking a field as explicitly overridden rather than inherited. */
export declare function OverrideTag({ t, overridden }: {
    t: Translate;
    overridden: boolean;
}): ReactNode;
/**
 * Numeric field where empty means "inherit".
 *
 * Kept as text rather than a number input so a partially typed value (a lone
 * minus sign, an empty box) does not get coerced into a write.
 */
export declare function NumberField(props: {
    id: string;
    label: string;
    hint?: string | undefined;
    error?: string | undefined;
    value: number | undefined;
    placeholder?: string | undefined;
    min?: number | undefined;
    max?: number | undefined;
    step?: number | undefined;
    narrow?: boolean;
    disabled?: boolean | undefined;
    accessory?: ReactNode;
    onChange: (next: number | undefined) => void;
}): ReactNode;
/** One option in a {@link ChoiceRow}. */
export interface ChoiceOption<T extends string> {
    value: T;
    label: string;
    title?: string | undefined;
}
/** A single-choice control rendered as pills. */
export declare function ChoiceRow<T extends string>(props: {
    label: string;
    hint?: string | undefined;
    value: T;
    options: readonly ChoiceOption<T>[];
    onChange: (next: T) => void;
    accessory?: ReactNode;
    disabled?: boolean | undefined;
}): ReactNode;
/** A labelled boolean toggle. */
export declare function ToggleField(props: {
    label: string;
    hint?: string | undefined;
    checked: boolean;
    disabled?: boolean;
    title?: string | undefined;
    onChange: (next: boolean) => void;
}): ReactNode;
/** A collapsible section with a status chip. */
export declare function SectionShell(props: {
    id: string;
    title: string;
    description?: string | undefined;
    /** Short status text shown next to the title. */
    badge?: string | undefined;
    tone?: TagTone | undefined;
    open: boolean;
    onToggle: () => void;
    /** Rendered at the right of the header row. */
    actions?: ReactNode;
    children: ReactNode;
}): ReactNode;
/** A row of actions. */
export declare function Toolbar(props: {
    children: ReactNode;
}): ReactNode;
/** A small monospace chip. */
export declare function Mono(props: {
    children: ReactNode;
}): ReactNode;
/** Text button styled as a link, for destructive or secondary row actions. */
export declare function LinkButton(props: {
    label: string;
    title?: string | undefined;
    disabled?: boolean | undefined;
    onClick: () => void;
}): ReactNode;
