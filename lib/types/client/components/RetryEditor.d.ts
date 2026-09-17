/**
 * Retry policy editor.
 *
 * Two rules from the Harness resolver shape this UI and are worth stating
 * plainly, because the schema alone would let a user save a profile that throws
 * later:
 *
 *  - `mode` is REQUIRED whenever `retryPolicy` is present. There is no such
 *    thing as "a retry policy without a mode", so choosing a preset always
 *    writes one, and choosing Harness Default writes nothing at all.
 *  - A delay of `0` passes `z.natural()` and then fails resolution. The editor
 *    therefore treats blank as "inherit" and rejects zero outright.
 *
 * `always` is offered but gated behind an explicit acknowledgement: it retries
 * until success or cancellation, which is a different operational proposition
 * from "retry five times".
 */
import { type ReactNode } from 'react';
import type { Translate } from '../contract.js';
import type { RetryEditorState } from '../../shared/retry.js';
/**
 * Render the retry editor.
 * @param props - the draft state, its sink, and validation messages by field.
 * @returns the editor element.
 */
export declare function RetryEditor(props: {
    t: Translate;
    state: RetryEditorState | null;
    onChange: (next: RetryEditorState | null) => void;
    /** Field-keyed messages produced by the shared validator. */
    issues: ReadonlyMap<string, string>;
    disabled?: boolean | undefined;
    /** Whether the run has already acknowledged the always-retry warning. */
    acknowledged: boolean;
    onAcknowledge: () => void;
}): ReactNode;
/** Translate a shared-validator issue into a message using the retry copy table. */
export declare function retryIssueMessage(t: Translate, code: string): string;
