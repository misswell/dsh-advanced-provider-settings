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
import type { ReactNode } from 'react';
import { type TagTone } from '@deepseek-ai/dsh-client-ui-primitives';
/** Tone of an inline notice. */
export type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
/**
 * Inline explanatory block.
 *
 * Reserved for the cases that need a box: a warning the user must act on, a
 * danger that blocks saving, or the result of an action. Everything quieter is a
 * {@link Note}, because a column of coloured rectangles has no hierarchy left.
 */
export declare function Notice(props: {
    tone: NoticeTone;
    title?: string;
    children?: ReactNode;
}): ReactNode;
/** One line of explanation, without the box. */
export declare function Note(props: {
    children: ReactNode;
}): ReactNode;
/**
 * One setting: label and explanation on the left, one control on the right.
 *
 * `overridden` is the only status mark a row carries — an accent bar on its left
 * edge. A word for it ("已覆盖") would repeat on most rows and say nothing a
 * glance at the bar does not.
 */
export declare function Row(props: {
    label: string;
    /** The raw schema identifier, for matching against provider documentation. */
    fieldKey?: string;
    /** One line: what the setting does, and what it currently means. */
    note?: ReactNode;
    error?: ReactNode;
    /** Whether this row's value is set here rather than inherited. */
    overridden?: boolean;
    /** Put the control on its own line under the label, for wide option lists. */
    wide?: boolean;
    children: ReactNode;
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
/**
 * A number with its unit inside the box, so the value needs no second echo.
 *
 * Empty means "inherit", which is why the default is the placeholder: the box
 * then says both what is set and what would be used otherwise, without a third
 * line of prose.
 */
export declare function NumberBox(props: {
    value: number | undefined;
    placeholder?: string | undefined;
    /** A unit label, or a control (a unit picker) to sit inside the box. */
    unit?: ReactNode;
    ariaLabel: string;
    disabled?: boolean | undefined;
    /** Rejects a typed value that cannot be committed (a half-written object). */
    parse?: ((raw: string) => number | undefined) | undefined;
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
    note?: ReactNode;
    value: T;
    options: readonly ChoiceOption<T>[];
    onChange: (next: T) => void;
    disabled?: boolean | undefined;
    /** Force the options onto their own line. */
    wide?: boolean;
    /**
     * Whether the choice is the user's rather than a fallback.
     *
     * Callers whose "inherit" pill is a named value like `inherit` have to say so
     * here: `value !== ''` would mark an untouched row as overridden, and the bar
     * is the one mark that claims "this is yours".
     */
    overridden?: boolean | undefined;
}): ReactNode;
/** A collapsible section card: header row, then its rows. */
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
/** Text button styled as a link, for destructive or secondary row actions. */
export declare function LinkButton(props: {
    label: string;
    title?: string | undefined;
    disabled?: boolean | undefined;
    onClick: () => void;
}): ReactNode;
