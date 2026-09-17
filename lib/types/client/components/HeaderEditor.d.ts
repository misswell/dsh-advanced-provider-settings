/**
 * Header list editor, used for both the provider and the global header layer.
 *
 * The two layers need the same editing surface but opposite warnings: a
 * provider-level `user-agent` is stripped by Harness, while a global one
 * replaces Harness attribution on every request. Rather than two components,
 * one takes a `scope` and explains the trap that applies.
 */
import { type ReactNode } from 'react';
import { type HeaderEntry } from '../../shared/headers.js';
import type { Translate } from '../contract.js';
/** Which layer is being edited; drives the advisory copy. */
export type HeaderScope = 'provider' | 'global';
/** One row's validation state. */
interface RowIssue {
    name?: string;
    value?: string;
}
/** Validate a whole list, returning per-row issues and a duplicate flag. */
export declare function validateRows(rows: readonly HeaderEntry[], t: Translate): RowIssue[];
/** Whether a list has any blocking problem. */
export declare function hasBlockingRow(rows: readonly HeaderEntry[], t: Translate): boolean;
/**
 * Render the header list editor.
 * @param props - draft rows, the change sink, and which layer this is.
 * @returns the editor element.
 */
export declare function HeaderEditor(props: {
    t: Translate;
    rows: readonly HeaderEntry[];
    onChange: (next: HeaderEntry[]) => void;
    scope: HeaderScope;
    /** The profile's credential reference, for the authorization advisory. */
    credentialRef?: string | undefined;
    disabled?: boolean | undefined;
    /** Show the User-Agent preset row. Only the global layer can use it. */
    showPresets?: boolean | undefined;
}): ReactNode;
export {};
