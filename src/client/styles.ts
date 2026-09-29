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

/** Package name used as the style tag's owner marker. */
const PLUGIN_ID = 'dsh-advanced-provider-settings'

/**
 * Font-size helper. `--dsh-content-font-delta` is the px offset the host derives
 * from the user's Settings font-size choice, so every size here moves with it.
 */
const SIZE = (px: number): string => `calc(${String(px)}px + var(--dsh-content-font-delta,0px))`

/** Stylesheet source. Kept in one string so the whole surface ships together. */
const CSS = `
/* ---------------------------------------------------------------- structure */
.aps-root{display:flex;flex-direction:column;gap:14px;font-size:${SIZE(13)};line-height:1.55;color:var(--dsw-alias-label-primary,inherit)}
.aps-shell{border:0.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.28));border-radius:12px;overflow:hidden}
.aps-shell-header{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;user-select:none;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.05))}
.aps-shell-header:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.06))}
.aps-shell-title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aps-shell-chevron{transition:transform .15s ease;font-size:${SIZE(10)};color:var(--dsw-alias-label-tertiary,inherit);opacity:.8}
.aps-shell-chevron[data-open="true"]{transform:rotate(90deg)}
.aps-shell-body{display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;border-top:0.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2))}
/* Embedded: the host surface owns the framing, so no border or inset padding. */
.aps-embedded{display:flex;flex-direction:column;gap:8px}
.aps-embedded>.aps-shell-body{padding:0;border-top:none}
/* Nested one level below a card of the host's own: the outer surface supplies the
   fill, so an inner card is a boundary only, and a lighter one — a smaller radius
   and a shorter header are what tell the two disclosure levels apart, since both
   headers carry the same title-plus-badge shape. */
.aps-embedded .aps-card{background:transparent;border-radius:10px}
.aps-embedded .aps-card-head{min-height:34px}
.aps-provider-picker{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px}

/* ------------------------------------------------------------------- cards */
.aps-card{border:0.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));border-radius:12px;background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.03));overflow:hidden}
.aps-card-head{display:flex;align-items:center;gap:8px;padding:0 12px;min-height:40px;cursor:pointer;user-select:none}
.aps-card-head:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.05))}
.aps-card-title{font-size:${SIZE(13)};font-weight:600;color:var(--dsw-alias-label-primary,inherit);background:none;border:none;padding:0;margin:0;font-family:inherit;cursor:pointer;text-align:left}
.aps-card-chevron{flex:none;color:var(--dsw-alias-label-tertiary,inherit);font-size:${SIZE(10)};transition:transform .15s ease}
.aps-card-chevron[data-open="true"]{transform:rotate(90deg)}
.aps-card-desc{font-size:${SIZE(12)};color:var(--dsw-alias-label-tertiary,inherit);margin:0 0 8px;padding:2px 0 0}
/* One inset for the whole card: the body pads, and nothing pulls back out of
   it. A row that hung 10px left of its own card put its hairline, and the empty
   state's text, outside the column everything else was lined up on. */
.aps-card-body{display:flex;flex-direction:column;padding:0 12px 10px}

/* -------------------------------------------------------------- one row,
 one setting: text left, one control right, an accent bar when overridden. */
.aps-section{display:flex;flex-direction:column}
.aps-row{position:relative;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;padding:9px 0;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(128,128,128,.1))}
.aps-row:first-child{border-top:none}
/* The mark sits in the gutter rather than inside the row, so the label stays
   lined up with every other label in the card. */
.aps-row[data-overridden="true"]::before{content:"";position:absolute;left:-8px;top:8px;bottom:8px;width:2px;border-radius:2px;background:var(--dsw-alias-brand-primary,#6b9bff)}
.aps-row-text{flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:2px;padding-top:3px}
.aps-row-label{display:flex;align-items:center;gap:6px;font-size:${SIZE(13)};color:var(--dsw-alias-label-primary,inherit)}
.aps-row-key{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:${SIZE(11)};color:var(--dsw-alias-label-dimmed,#8a8a8a);font-weight:400}
.aps-row-note{margin:0;font-size:${SIZE(12)};line-height:1.5;color:var(--dsw-alias-label-tertiary,inherit)}
.aps-row-note b{font-weight:500;color:var(--dsw-alias-label-secondary,inherit)}
.aps-row-control{flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:6px;justify-content:flex-end}
.aps-row-control [role="radiogroup"]{justify-content:flex-end}
/* A row that is only a label has nothing stacked under it, so centre the label
   against the control instead of hanging it at the top of the line. */
.aps-row[data-plain="true"] .aps-row-text{justify-content:center;padding-top:0;min-height:30px}
/* A row whose control is a wide option list takes the full width underneath. */
.aps-row[data-wide="true"]{flex-wrap:wrap}
.aps-row[data-wide="true"] .aps-row-control{flex:1 1 100%;justify-content:flex-start}

.aps-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.aps-field-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.aps-label{font-weight:500;display:flex;align-items:center;gap:6px}
.aps-hint{margin:0;font-size:${SIZE(12)};line-height:1.5;color:var(--dsw-alias-label-tertiary,inherit)}
/* The档位 grid wraps to two rows at a normal width. With only a column gap the
   second row's label sat on top of the first row's input. */
.aps-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));column-gap:16px;row-gap:10px;width:100%}
/* One level's state, said next to its box. The box cannot carry it: a blank
   input whose placeholder states a conclusion ("Not supported") reads as a
   disabled field rather than as a decision the user has made. */
.aps-level-state{flex:none;font-size:${SIZE(11)};line-height:1.4;color:var(--dsw-alias-label-tertiary,inherit);white-space:nowrap;max-width:18ch;overflow:hidden;text-overflow:ellipsis}
.aps-level-state[data-state='unsupported']{color:var(--dsw-alias-label-secondary,inherit)}
.aps-level-state[data-state='inherited']{font-style:italic}
.aps-level-state code{font-family:ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-secondary,inherit)}
.aps-filter{max-width:220px}

/* --------------------------------------------------- a number with its unit */
.aps-num{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.24));border-radius:8px;background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.04))}
.aps-num:focus-within{border-color:var(--dsw-alias-brand-primary,#6b9bff)}
.aps-num-input{width:8ch;min-width:0;border:none;outline:none;background:transparent;color:var(--dsw-alias-label-primary,inherit);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:${SIZE(13)}}
.aps-num-input::placeholder{color:var(--dsw-alias-label-dimmed,#8a8a8a)}
.aps-num-unit{font-size:${SIZE(11)};color:var(--dsw-alias-label-tertiary,inherit)}
.aps-num select{border:none;outline:none;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:${SIZE(12)}}
.aps-input{min-width:0;flex:1}
.aps-input-narrow{width:120px;flex:none}
.aps-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:${SIZE(12)}}

/* ------------------------------------------------------------------ colour */
.aps-error{font-size:${SIZE(12)};color:var(--dsw-alias-state-error-primary,#e5484d)}
.aps-warning{font-size:${SIZE(12)};color:var(--dsw-alias-state-warn-primary,#d97706)}
/* A note is a sentence, not a box. Only the tones that can block a save —
   warning and danger — get a fill, so a coloured rectangle always means
   "this needs a decision". */
.aps-note{display:flex;gap:8px;align-items:flex-start;margin:0;font-size:${SIZE(12)};line-height:1.5;color:var(--dsw-alias-label-tertiary,inherit);padding:2px 0}
.aps-note b{font-weight:500;color:var(--dsw-alias-label-secondary,inherit)}
.aps-notice{display:flex;gap:8px;margin:4px 0;padding:8px 10px;border-radius:8px;font-size:${SIZE(12)};line-height:1.5;align-items:flex-start}
.aps-notice-info{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.06));color:var(--dsw-alias-label-secondary,inherit)}
.aps-notice-warning{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 12%,transparent);color:var(--dsw-alias-state-warn-primary,#d97706)}
.aps-notice-danger{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 12%,transparent);color:var(--dsw-alias-state-error-primary,#e5484d)}
.aps-notice-success{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22a34a) 12%,transparent);color:var(--dsw-alias-state-success-primary,#22a34a)}
.aps-notice-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.aps-notice-body strong{font-weight:600}

/* ------------------------------------------------------------- backoff bars */
.aps-curve{display:flex;flex-direction:column;gap:4px;margin:2px 0 8px;padding:9px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.05))}
.aps-curve-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:${SIZE(12)};color:var(--dsw-alias-label-secondary,inherit)}
.aps-curve-total{font-size:${SIZE(11)};color:var(--dsw-alias-label-tertiary,inherit);font-variant-numeric:tabular-nums}
.aps-curve-row{display:grid;grid-template-columns:52px 1fr 66px;align-items:center;gap:8px;font-size:${SIZE(12)}}
.aps-curve-label{color:var(--dsw-alias-label-tertiary,inherit)}
.aps-curve-bar-track{height:6px;border-radius:3px;background:var(--dsw-alias-border-l2,rgba(128,128,128,.14));overflow:hidden}
.aps-curve-bar{display:block;height:100%;border-radius:3px;background:var(--dsw-alias-brand-primary,#6b9bff);opacity:.8;min-width:2px}
.aps-curve-value{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,inherit)}

/* --------------------------------------------------------- cluster headings */
.aps-group-head{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-top:2px;padding-top:10px;border-top:0.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.18))}
.aps-group-title{font-weight:600;font-size:${SIZE(12)};color:var(--dsw-alias-label-secondary,inherit)}
.aps-group-count{font-size:${SIZE(11)};color:var(--dsw-alias-label-tertiary,inherit);font-variant-numeric:tabular-nums}
.aps-group-note{font-size:${SIZE(11)};color:var(--dsw-alias-label-tertiary,inherit);flex:1;min-width:0}
.aps-flag-groups{display:flex;flex-direction:column}
.aps-flag-group{display:flex;flex-direction:column}

/* ----------------------------------------------------------- header editor */
/* Same hairline rhythm as a card's rows: the inputs are the content, so the row
   only has to keep them lined up and separated. */
.aps-header-table{display:flex;flex-direction:column}
.aps-header-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(128,128,128,.1))}
.aps-header-row:first-child{border-top:none}
.aps-header-name{width:34%;min-width:110px}
.aps-header-value{flex:1;min-width:0}
.aps-header-actions{display:flex;gap:2px;flex:none}
.aps-header-issue{flex:1 1 100%;padding-left:calc(34% + 6px)}

/* ----------------------------------------------------------------- the rest */
.aps-badge{font-family:ui-monospace,Consolas,monospace;font-size:${SIZE(11)};padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.1));color:var(--dsw-alias-label-tertiary,inherit);white-space:nowrap}
.aps-preset-list{display:flex;flex-direction:column;gap:6px}
.aps-preset{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border:0.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.2));border-radius:8px;cursor:pointer}
.aps-preset[data-active="true"]{border-color:var(--dsw-alias-brand-primary,#6b9bff);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#6b9bff) 8%,transparent)}
.aps-preset-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.aps-preset-title{font-weight:600}
.aps-preview{display:flex;flex-direction:column;gap:3px;font-size:${SIZE(12)}}
.aps-preview-line{display:flex;gap:8px;align-items:baseline}
.aps-preview-key{color:var(--dsw-alias-label-tertiary,inherit);min-width:132px}
.aps-preview-value{font-family:ui-monospace,Consolas,monospace;word-break:break-all}
.aps-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:10px 0 0}
.aps-spacer{flex:1}
/* ------------------------------------------------------- per-model editor */
.aps-model-picker{display:flex;flex-direction:column;gap:8px;padding:2px 0 10px}
.aps-model-picker .aps-input{max-width:240px;flex:0 1 auto}
.aps-picker-list{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.aps-picker-name{display:inline-block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;font-family:ui-monospace,Consolas,monospace;font-size:${SIZE(12)}}
.aps-picker-mark{display:inline-block;margin-left:5px;padding:0 4px;border-radius:999px;font-size:${SIZE(10)};line-height:1.7;background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#8a8f98) 22%,transparent)}
.aps-picker-mark[data-image="true"]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4c8dff) 24%,transparent);color:var(--dsw-alias-brand-primary,inherit)}
.aps-picker-dot{width:6px;height:6px;border-radius:999px;background:var(--dsw-alias-brand-primary,#6b9bff)}
.aps-model-editor{display:flex;flex-direction:column;gap:2px;padding:10px;border:0.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.18));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.04))}
.aps-model-editor-head{display:flex;gap:8px;align-items:center;padding:0 0 6px}
.aps-model-editor-id{font-family:ui-monospace,Consolas,monospace;font-size:${SIZE(12)};color:var(--dsw-alias-label-secondary,inherit)}
.aps-diagnostics{display:flex;flex-direction:column;font-size:${SIZE(12)}}
.aps-diag-row{display:flex;gap:8px;align-items:baseline;padding:5px 0;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(128,128,128,.1))}
.aps-diag-row:first-child{border-top:none}
.aps-diag-key{min-width:160px;color:var(--dsw-alias-label-tertiary,inherit)}
.aps-diag-detail{color:var(--dsw-alias-label-dimmed,#8a8a8a);font-family:ui-monospace,Consolas,monospace;font-size:${SIZE(11)};word-break:break-all}
.aps-tag-list{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.aps-sticky-actions{display:flex;gap:8px;align-items:center;padding:12px 0 0;border-top:0.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2))}
.aps-visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
`

/**
 * Inject the stylesheet once per document.
 *
 * Idempotent by tag identity, so a second module instance (a reload, or two
 * plugin instances in one page) does not stack duplicate rules.
 */
export function injectStyles(): void {
  if (typeof document === 'undefined') return
  const marker = `${PLUGIN_ID}/styles.css`
  const existing = document.head.querySelector(`style[data-plugin-css="${marker}"]`)
  if (existing !== null) return
  const style = document.createElement('style')
  style.setAttribute('data-plugin', PLUGIN_ID)
  style.setAttribute('data-plugin-css', marker)
  style.textContent = CSS
  document.head.appendChild(style)
}

/** Class names used by the client components. */
export const cls = {
  curve: 'aps-curve',
  curveHead: 'aps-curve-head',
  curveTotal: 'aps-curve-total',
  curveRow: 'aps-curve-row',
  curveLabel: 'aps-curve-label',
  curveBarTrack: 'aps-curve-bar-track',
  curveBar: 'aps-curve-bar',
  curveValue: 'aps-curve-value',
  groupHead: 'aps-group-head',
  groupTitle: 'aps-group-title',
  groupCount: 'aps-group-count',
  groupNote: 'aps-group-note',
  flagGroups: 'aps-flag-groups',
  flagGroup: 'aps-flag-group',
  root: 'aps-root',
  shell: 'aps-shell',
  shellHeader: 'aps-shell-header',
  shellTitle: 'aps-shell-title',
  shellChevron: 'aps-shell-chevron',
  shellBody: 'aps-shell-body',
  embedded: 'aps-embedded',
  providerPicker: 'aps-provider-picker',
  card: 'aps-card',
  cardHead: 'aps-card-head',
  cardTitle: 'aps-card-title',
  cardChevron: 'aps-card-chevron',
  cardDesc: 'aps-card-desc',
  cardBody: 'aps-card-body',
  section: 'aps-section',
  row: 'aps-row',
  rowText: 'aps-row-text',
  rowLabel: 'aps-row-label',
  rowKey: 'aps-row-key',
  rowNote: 'aps-row-note',
  rowControl: 'aps-row-control',
  field: 'aps-field',
  fieldRow: 'aps-field-row',
  label: 'aps-label',
  hint: 'aps-hint',
  input: 'aps-input',
  inputNarrow: 'aps-input-narrow',
  grid: 'aps-grid',
  levelState: 'aps-level-state',
  num: 'aps-num',
  numInput: 'aps-num-input',
  numUnit: 'aps-num-unit',
  error: 'aps-error',
  warning: 'aps-warning',
  note: 'aps-note',
  notice: 'aps-notice',
  noticeInfo: 'aps-notice-info',
  noticeWarning: 'aps-notice-warning',
  noticeDanger: 'aps-notice-danger',
  noticeSuccess: 'aps-notice-success',
  noticeBody: 'aps-notice-body',
  headerTable: 'aps-header-table',
  headerRow: 'aps-header-row',
  headerName: 'aps-header-name',
  headerValue: 'aps-header-value',
  headerActions: 'aps-header-actions',
  headerIssue: 'aps-header-issue',
  mono: 'aps-mono',
  badge: 'aps-badge',
  presetList: 'aps-preset-list',
  preset: 'aps-preset',
  presetBody: 'aps-preset-body',
  presetTitle: 'aps-preset-title',
  preview: 'aps-preview',
  previewLine: 'aps-preview-line',
  previewKey: 'aps-preview-key',
  previewValue: 'aps-preview-value',
  toolbar: 'aps-toolbar',
  spacer: 'aps-spacer',
  modelPicker: 'aps-model-picker',
  pickerList: 'aps-picker-list',
  pickerName: 'aps-picker-name',
  pickerMark: 'aps-picker-mark',
  pickerDot: 'aps-picker-dot',
  modelEditor: 'aps-model-editor',
  modelEditorHead: 'aps-model-editor-head',
  modelEditorId: 'aps-model-editor-id',
  diagnostics: 'aps-diagnostics',
  diagRow: 'aps-diag-row',
  diagKey: 'aps-diag-key',
  diagDetail: 'aps-diag-detail',
  tagList: 'aps-tag-list',
  stickyActions: 'aps-sticky-actions',
  filter: 'aps-filter',
  visuallyHidden: 'aps-visually-hidden',
} as const
