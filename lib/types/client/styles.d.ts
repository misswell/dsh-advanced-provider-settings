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
    readonly source: "aps-source";
    readonly slider: "aps-slider";
    readonly sliderTrack: "aps-slider-track";
    readonly sliderFill: "aps-slider-fill";
    readonly sliderInherited: "aps-slider-inherited";
    readonly sliderInput: "aps-slider-input";
    readonly sliderRow: "aps-slider-row";
    readonly sliderValue: "aps-slider-value";
    readonly sliderDefault: "aps-slider-default";
    readonly curve: "aps-curve";
    readonly curveHead: "aps-curve-head";
    readonly curveTotal: "aps-curve-total";
    readonly curveRow: "aps-curve-row";
    readonly curveLabel: "aps-curve-label";
    readonly curveBarTrack: "aps-curve-bar-track";
    readonly curveBar: "aps-curve-bar";
    readonly curveValue: "aps-curve-value";
    readonly ladder: "aps-ladder";
    readonly ladderRow: "aps-ladder-row";
    readonly ladderStep: "aps-ladder-step";
    readonly ladderBar: "aps-ladder-bar";
    readonly ladderName: "aps-ladder-name";
    readonly groupHead: "aps-group-head";
    readonly groupTitle: "aps-group-title";
    readonly groupCount: "aps-group-count";
    readonly groupNote: "aps-group-note";
    readonly flag: "aps-flag";
    readonly flagText: "aps-flag-text";
    readonly flagLabel: "aps-flag-label";
    readonly flagNote: "aps-flag-note";
    readonly flagControl: "aps-flag-control";
    readonly filter: "aps-filter";
    readonly flagGroups: "aps-flag-groups";
    readonly flagGroup: "aps-flag-group";
    readonly flagKey: "aps-flag-key";
    readonly root: "aps-root";
    readonly shell: "aps-shell";
    readonly shellHeader: "aps-shell-header";
    readonly shellTitle: "aps-shell-title";
    readonly shellChevron: "aps-shell-chevron";
    readonly shellBody: "aps-shell-body";
    readonly section: "aps-section";
    readonly sectionHead: "aps-section-head";
    readonly sectionTitle: "aps-section-title";
    readonly sectionDesc: "aps-section-desc";
    readonly field: "aps-field";
    readonly fieldRow: "aps-field-row";
    readonly label: "aps-label";
    readonly hint: "aps-hint";
    readonly input: "aps-input";
    readonly inputNarrow: "aps-input-narrow";
    readonly grid: "aps-grid";
    readonly error: "aps-error";
    readonly warning: "aps-warning";
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
    readonly modelList: "aps-model-list";
    readonly modelRow: "aps-model-row";
    readonly modelId: "aps-model-id";
    readonly modelFilter: "aps-model-filter";
    readonly diagnostics: "aps-diagnostics";
    readonly diagRow: "aps-diag-row";
    readonly diagKey: "aps-diag-key";
    readonly diagDetail: "aps-diag-detail";
    readonly tagList: "aps-tag-list";
    readonly stickyActions: "aps-sticky-actions";
    readonly visuallyHidden: "aps-visually-hidden";
};
