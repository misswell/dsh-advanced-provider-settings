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
import type { ReactNode } from 'react';
import type { Translate } from '../contract.js';
/**
 * Whether a value is inherited from a broader layer or set here.
 *
 * Uses `StateDot` rather than a coloured word so a column of these can be
 * scanned vertically; the label carries the meaning for screen readers.
 */
export declare function ValueSource({ t, overridden }: {
    t: Translate;
    overridden: boolean;
}): ReactNode;
/** Format a millisecond count the way a person would say it. */
export declare function formatDuration(ms: number, t: Translate): string;
/**
 * Format a byte count in binary units.
 *
 * Deliberately KiB/MiB/GiB rather than KB/MB/GB: the schema's limits are
 * powers of two, so `maxRequestImageBytes: 1048576` is 1 MiB and calling it
 * "1 MB" would be off by about 5 percent in the direction that matters when the
 * server enforces a real limit.
 */
export declare function formatBytes(bytes: number, t: Translate): string;
/**
 * A number that is usually left alone, with the inherited default made visible.
 *
 * The problem this solves: a bare box with "1024" in a placeholder gives no
 * sense of scale, so you cannot tell whether 1024 is near the floor or the
 * ceiling. The slider shows the legal range, the tick shows where the inherited
 * default sits inside it, and the buttons say explicitly which one you are on.
 */
export declare function SliderField(props: {
    t: Translate;
    id: string;
    label: string;
    hint?: string | undefined;
    error?: string | undefined;
    /** `undefined` means inherit. */
    value: number | undefined;
    /** The value in force when nothing is set at this layer. */
    inherited: number;
    min: number;
    max: number;
    step?: number | undefined;
    /** Unit-aware rendering of a value, e.g. `2 min` or `10 MB`. */
    format: (value: number) => string;
    disabled?: boolean | undefined;
    onChange: (next: number | undefined) => void;
}): ReactNode;
/**
 * The retry backoff, drawn.
 *
 * A retry policy is a shape over time — "4 tries, 500 ms, doubling, capped at
 * 30 s" — and reading that as four numbers tells you much less than seeing the
 * bars. Widths are proportional to the longest wait so the growth is legible,
 * and each bar prints the real duration so the picture never replaces the fact.
 */
export declare function BackoffCurve(props: {
    t: Translate;
    /** Number of retries after the first attempt. */
    retries: number;
    initialMs: number;
    maxMs?: number | undefined;
    factor?: number | undefined;
}): ReactNode;
export declare function EffortLadder({ t, level }: {
    t: Translate;
    level: string | false | undefined;
}): ReactNode;
/**
 * A labelled cluster of related flags.
 *
 * The 26 compat fields describe six different concerns; presented as one flat
 * list they are unreadable, so each cluster gets a heading and a count of how
 * many of its members are overridden.
 */
export declare function GroupHeader(props: {
    label: string;
    note: string;
    overridden: number;
    total: number;
}): ReactNode;
