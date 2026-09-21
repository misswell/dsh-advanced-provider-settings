/**
 * Stylesheet injection, following the convention the shipped client bundles use:
 * one `<style data-plugin="<package>" data-plugin-css="<package>/<file>">` tag
 * appended from inside the module factory, so HMR can find and remove it by
 * `data-plugin` and the module system can claim it at materialization.
 *
 * The class names are a plain exported map rather than hashed module CSS: this
 * package is bundled by its own esbuild script (the official build preset is not
 * published for out-of-repo plugins), so there is no CSS pipeline to hash them.
 * The `aps-` prefix keeps them from colliding with the shell's own classes.
 *
 * Every colour is a shell alias token (`--dsw-alias-*`) with a fallback, and
 * every size is derived from `--dsh-content-font-delta`, which the Settings page
 * publishes. Both matter: a plugin that paints with its own palette or hard-codes
 * 12px looks pasted-in next to the host, and ignores the user's font-size choice.
 *
 * Layout vocabulary: a section is a card, and a card holds rows. One row is one
 * setting — label and note on the left, exactly one control on the right. A row
 * the user has overridden gets an accent bar; that is the only per-field status
 * mark, because a word for it on every row is noise.
 */
/**
 * Inject the stylesheet once per document.
 *
 * Idempotent by tag identity, so a second module instance (a reload, or two
 * plugin instances in one page) does not stack duplicate rules.
 */
export declare function injectStyles(): void;
/** Class names used by the client components. */
export declare const cls: {
    readonly curve: "aps-curve";
    readonly curveHead: "aps-curve-head";
    readonly curveTotal: "aps-curve-total";
    readonly curveRow: "aps-curve-row";
    readonly curveLabel: "aps-curve-label";
    readonly curveBarTrack: "aps-curve-bar-track";
    readonly curveBar: "aps-curve-bar";
    readonly curveValue: "aps-curve-value";
    readonly groupHead: "aps-group-head";
    readonly groupTitle: "aps-group-title";
    readonly groupCount: "aps-group-count";
    readonly groupNote: "aps-group-note";
    readonly flagGroups: "aps-flag-groups";
    readonly flagGroup: "aps-flag-group";
    readonly root: "aps-root";
    readonly shell: "aps-shell";
    readonly shellHeader: "aps-shell-header";
    readonly shellTitle: "aps-shell-title";
    readonly shellChevron: "aps-shell-chevron";
    readonly shellBody: "aps-shell-body";
    readonly embedded: "aps-embedded";
    readonly providerPicker: "aps-provider-picker";
    readonly card: "aps-card";
    readonly cardHead: "aps-card-head";
    readonly cardTitle: "aps-card-title";
    readonly cardChevron: "aps-card-chevron";
    readonly cardDesc: "aps-card-desc";
    readonly cardBody: "aps-card-body";
    readonly section: "aps-section";
    readonly row: "aps-row";
    readonly rowText: "aps-row-text";
    readonly rowLabel: "aps-row-label";
    readonly rowKey: "aps-row-key";
    readonly rowNote: "aps-row-note";
    readonly rowControl: "aps-row-control";
    readonly field: "aps-field";
    readonly fieldRow: "aps-field-row";
    readonly label: "aps-label";
    readonly hint: "aps-hint";
    readonly input: "aps-input";
    readonly inputNarrow: "aps-input-narrow";
    readonly grid: "aps-grid";
    readonly num: "aps-num";
    readonly numInput: "aps-num-input";
    readonly numUnit: "aps-num-unit";
    readonly error: "aps-error";
    readonly warning: "aps-warning";
    readonly note: "aps-note";
    readonly notice: "aps-notice";
    readonly noticeInfo: "aps-notice-info";
    readonly noticeWarning: "aps-notice-warning";
    readonly noticeDanger: "aps-notice-danger";
    readonly noticeSuccess: "aps-notice-success";
    readonly noticeBody: "aps-notice-body";
    readonly headerTable: "aps-header-table";
    readonly headerRow: "aps-header-row";
    readonly headerName: "aps-header-name";
    readonly headerValue: "aps-header-value";
    readonly headerActions: "aps-header-actions";
    readonly headerIssue: "aps-header-issue";
    readonly mono: "aps-mono";
    readonly badge: "aps-badge";
    readonly presetList: "aps-preset-list";
    readonly preset: "aps-preset";
    readonly presetBody: "aps-preset-body";
    readonly presetTitle: "aps-preset-title";
    readonly preview: "aps-preview";
    readonly previewLine: "aps-preview-line";
    readonly previewKey: "aps-preview-key";
    readonly previewValue: "aps-preview-value";
    readonly toolbar: "aps-toolbar";
    readonly spacer: "aps-spacer";
    readonly modelPicker: "aps-model-picker";
    readonly pickerList: "aps-picker-list";
    readonly pickerName: "aps-picker-name";
    readonly pickerMark: "aps-picker-mark";
    readonly pickerDot: "aps-picker-dot";
    readonly modelEditor: "aps-model-editor";
    readonly modelEditorHead: "aps-model-editor-head";
    readonly modelEditorId: "aps-model-editor-id";
    readonly diagnostics: "aps-diagnostics";
    readonly diagRow: "aps-diag-row";
    readonly diagKey: "aps-diag-key";
    readonly diagDetail: "aps-diag-detail";
    readonly tagList: "aps-tag-list";
    readonly stickyActions: "aps-sticky-actions";
    readonly filter: "aps-filter";
    readonly visuallyHidden: "aps-visually-hidden";
};
