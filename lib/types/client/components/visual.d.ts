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
import type { ReactNode } from 'react';
import type { Translate } from '../contract.js';
/**
 * Format a millisecond count the way a person would say it.
 * @param ms - the duration in milliseconds.
 * @param t - bound translate for the unit labels.
 * @returns a short human duration, e.g. `2 min` or `500 ms`.
 */
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
 * The one reset affordance, shown only where there is something to reset.
 *
 * It is a text button rather than a row of status prose because the row already
 * says what is set: the action is the useful part.
 */
export declare function InheritButton(props: {
    t: Translate;
    overridden: boolean;
    disabled?: boolean | undefined;
    onInherit: () => void;
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
/**
 * A labelled cluster heading inside a long list of flags.
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
