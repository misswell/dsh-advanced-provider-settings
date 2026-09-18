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

/** Package name used as the style tag's owner marker. */
const PLUGIN_ID = 'dsh-advanced-provider-settings'

/** Stylesheet source. Kept in one string so the whole surface ships together. */
const CSS = `
/* Value-source dot: green when set here, hollow when inherited. */
.aps-source{display:inline-flex;align-items:center;gap:4px;font-size:11px;opacity:.72;white-space:nowrap}
.aps-source[data-overridden="true"]{opacity:1;color:var(--dsw-accent,#679efe)}

/* Slider: the track shows the legal range, the tick the inherited default. */
.aps-slider{display:flex;flex-direction:column;gap:2px;min-width:0}
.aps-slider-track{position:relative;height:4px;border-radius:2px;background:var(--dsw-surface-3,rgba(128,128,128,.16));margin:6px 0 -12px}
.aps-slider-fill{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:var(--dsw-accent,#679efe);opacity:.5}
.aps-slider-inherited{position:absolute;top:-3px;width:2px;height:10px;border-radius:1px;background:var(--dsw-text-1,#f9fafb);opacity:.45}
.aps-slider-input{width:100%;margin:0;accent-color:var(--dsw-accent,#679efe);background:transparent}
.aps-slider-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.aps-slider-value{font-size:11.5px;opacity:.8;font-variant-numeric:tabular-nums}
.aps-slider-default{font-size:11px;opacity:.55;font-variant-numeric:tabular-nums}

/* Backoff curve: bar length is proportional to the wait. */
.aps-curve{display:flex;flex-direction:column;gap:4px;padding:8px;border-radius:6px;background:var(--dsw-surface-2,rgba(128,128,128,.05));border:1px solid var(--dsw-border-1,rgba(128,128,128,.2))}
.aps-curve-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;font-weight:500}
.aps-curve-total{font-size:11px;opacity:.66;font-weight:400;font-variant-numeric:tabular-nums}
.aps-curve-row{display:grid;grid-template-columns:64px 1fr 74px;align-items:center;gap:8px;font-size:11.5px}
.aps-curve-label{opacity:.72}
.aps-curve-bar-track{height:8px;border-radius:2px;background:var(--dsw-surface-3,rgba(128,128,128,.12));overflow:hidden}
.aps-curve-bar{display:block;height:100%;border-radius:2px;background:var(--dsw-accent,#679efe);opacity:.75;min-width:2px}
.aps-curve-value{text-align:right;font-variant-numeric:tabular-nums;opacity:.85}

/* Effort ladder: five stops that reach the wire. */
.aps-ladder{display:flex;flex-direction:column;gap:4px}
.aps-ladder-row{display:flex;align-items:flex-end;gap:3px}
.aps-ladder-step{flex:1;display:flex;flex-direction:column;gap:3px;align-items:center;min-width:0}
.aps-ladder-bar{width:100%;height:5px;border-radius:2px;background:var(--dsw-surface-3,rgba(128,128,128,.18))}
.aps-ladder-step[data-reached="true"] .aps-ladder-bar{background:var(--dsw-accent,#679efe);opacity:.55}
.aps-ladder-step[data-active="true"] .aps-ladder-bar{opacity:1;height:9px}
.aps-ladder-name{font-size:10.5px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.aps-ladder-step[data-active="true"] .aps-ladder-name{opacity:1;font-weight:600}

/* Cluster heading for a group of related flags. */
.aps-group-head{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-top:4px;padding-top:6px;border-top:1px solid var(--dsw-border-1,rgba(128,128,128,.16))}
.aps-group-title{font-weight:600;font-size:12px}
.aps-group-count{font-size:11px;opacity:.6;font-variant-numeric:tabular-nums;padding:0 4px;border-radius:3px;background:var(--dsw-surface-3,rgba(128,128,128,.14))}
.aps-group-note{font-size:11px;opacity:.6;flex:1;min-width:0}

/* A flag row: label + note on the left, control on the right. */
/* The control can be a 12-option enum, so the row wraps instead of squeezing
   the label: a rigid two-column layout turns the label into a vertical ribbon
   one character wide, which is worse than a taller row. */
.aps-flag{display:flex;align-items:flex-start;gap:10px;padding:5px 0;flex-wrap:wrap}
.aps-flag-text{flex:1 1 260px;min-width:220px;display:flex;flex-direction:column;gap:1px}
.aps-flag-label{font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.aps-flag-note{font-size:11px;opacity:.6;line-height:1.45}
.aps-flag-control{flex:1 1 auto;display:flex;align-items:center;gap:6px;justify-content:flex-end}
.aps-flag-control [role="radiogroup"]{justify-content:flex-end}
.aps-flag[data-overridden="true"] .aps-flag-label{color:var(--dsw-accent,#679efe)}

.aps-filter{max-width:220px}

/* Grouped flag list: the cluster boundary is a rule, not a box, so nesting
   does not multiply borders inside the panel. */
.aps-flag-groups{display:flex;flex-direction:column;gap:10px}
.aps-flag-group{display:flex;flex-direction:column;gap:2px}
.aps-flag-key{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;opacity:.5;font-weight:400}
.aps-root{display:flex;flex-direction:column;gap:10px;font-size:13px;line-height:1.5;color:var(--dsw-text-1,inherit)}
.aps-shell{border:1px solid var(--dsw-border-1,rgba(128,128,128,.28));border-radius:8px;overflow:hidden;background:var(--dsw-surface-1,transparent)}
.aps-shell-header{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;user-select:none;background:var(--dsw-surface-2,rgba(128,128,128,.05))}
.aps-shell-header:hover{background:var(--dsw-surface-3,rgba(128,128,128,.09))}
.aps-shell-title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aps-shell-chevron{transition:transform .15s ease;font-size:10px;opacity:.7}
.aps-shell-chevron[data-open="true"]{transform:rotate(90deg)}
.aps-shell-body{display:flex;flex-direction:column;gap:12px;padding:10px;border-top:1px solid var(--dsw-border-1,rgba(128,128,128,.2))}
.aps-section{display:flex;flex-direction:column;gap:8px}
.aps-section-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.aps-section-title{font-weight:600}
.aps-section-desc{opacity:.72;font-size:12px}
.aps-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.aps-field-row{display:flex;align-items:center;gap:8px}
.aps-label{font-weight:500;display:flex;align-items:center;gap:6px}
.aps-hint{opacity:.66;font-size:11.5px}
.aps-input{min-width:0;flex:1}
.aps-input-narrow{width:120px;flex:none}
.aps-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}
.aps-error{color:var(--dsw-danger,#e5484d);font-size:11.5px}
.aps-warning{color:var(--dsw-warning,#d97706);font-size:11.5px}
.aps-notice{display:flex;gap:8px;padding:8px;border-radius:6px;font-size:12px;align-items:flex-start;border:1px solid transparent}
.aps-notice-info{background:var(--dsw-info-bg,rgba(59,130,246,.10));border-color:var(--dsw-info-border,rgba(59,130,246,.35))}
.aps-notice-warning{background:var(--dsw-warning-bg,rgba(217,119,6,.10));border-color:var(--dsw-warning-border,rgba(217,119,6,.35))}
.aps-notice-danger{background:var(--dsw-danger-bg,rgba(229,72,77,.10));border-color:var(--dsw-danger-border,rgba(229,72,77,.35))}
.aps-notice-success{background:var(--dsw-success-bg,rgba(22,163,74,.10));border-color:var(--dsw-success-border,rgba(22,163,74,.35))}
.aps-notice-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.aps-header-table{display:flex;flex-direction:column;gap:6px}
.aps-header-row{display:flex;gap:6px;align-items:flex-start}
.aps-header-name{width:34%;min-width:110px}
.aps-header-value{flex:1;min-width:0}
.aps-header-actions{display:flex;gap:2px;flex:none}
.aps-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}
.aps-badge{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;padding:1px 5px;border-radius:4px;background:var(--dsw-surface-3,rgba(128,128,128,.16));opacity:.85;white-space:nowrap}
.aps-preset-list{display:flex;flex-direction:column;gap:6px}
.aps-preset{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border:1px solid var(--dsw-border-1,rgba(128,128,128,.28));border-radius:6px;cursor:pointer}
.aps-preset[data-active="true"]{border-color:var(--dsw-accent,#3b82f6);background:var(--dsw-accent-bg,rgba(59,130,246,.08))}
.aps-preset-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.aps-preset-title{font-weight:600}
.aps-preview{display:flex;flex-direction:column;gap:3px;font-size:12px}
.aps-preview-line{display:flex;gap:8px;align-items:baseline}
.aps-preview-key{opacity:.72;min-width:132px}
.aps-preview-value{font-family:ui-monospace,Consolas,monospace;word-break:break-all}
.aps-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.aps-spacer{flex:1}
.aps-model-list{display:flex;flex-direction:column;gap:4px;max-height:340px;overflow:auto}
.aps-model-row{display:flex;gap:8px;align-items:center;padding:5px 6px;border-radius:5px}
.aps-model-row:hover{background:var(--dsw-surface-2,rgba(128,128,128,.07))}
.aps-model-id{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,Consolas,monospace;font-size:12px}
.aps-model-filter{display:flex;gap:6px;align-items:center}
.aps-diagnostics{display:flex;flex-direction:column;gap:3px;font-size:12px}
.aps-diag-row{display:flex;gap:8px;align-items:baseline}
.aps-diag-key{min-width:180px;opacity:.75}
.aps-diag-detail{opacity:.6;font-family:ui-monospace,Consolas,monospace;font-size:11px;word-break:break-all}
.aps-tag-list{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.aps-sticky-actions{display:flex;gap:8px;align-items:center;padding-top:8px;border-top:1px solid var(--dsw-border-1,rgba(128,128,128,.2))}
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
  source: 'aps-source',
  slider: 'aps-slider',
  sliderTrack: 'aps-slider-track',
  sliderFill: 'aps-slider-fill',
  sliderInherited: 'aps-slider-inherited',
  sliderInput: 'aps-slider-input',
  sliderRow: 'aps-slider-row',
  sliderValue: 'aps-slider-value',
  sliderDefault: 'aps-slider-default',
  curve: 'aps-curve',
  curveHead: 'aps-curve-head',
  curveTotal: 'aps-curve-total',
  curveRow: 'aps-curve-row',
  curveLabel: 'aps-curve-label',
  curveBarTrack: 'aps-curve-bar-track',
  curveBar: 'aps-curve-bar',
  curveValue: 'aps-curve-value',
  ladder: 'aps-ladder',
  ladderRow: 'aps-ladder-row',
  ladderStep: 'aps-ladder-step',
  ladderBar: 'aps-ladder-bar',
  ladderName: 'aps-ladder-name',
  groupHead: 'aps-group-head',
  groupTitle: 'aps-group-title',
  groupCount: 'aps-group-count',
  groupNote: 'aps-group-note',
  flag: 'aps-flag',
  flagText: 'aps-flag-text',
  flagLabel: 'aps-flag-label',
  flagNote: 'aps-flag-note',
  flagControl: 'aps-flag-control',
  filter: 'aps-filter',
  flagGroups: 'aps-flag-groups',
  flagGroup: 'aps-flag-group',
  flagKey: 'aps-flag-key',
  root: 'aps-root',
  shell: 'aps-shell',
  shellHeader: 'aps-shell-header',
  shellTitle: 'aps-shell-title',
  shellChevron: 'aps-shell-chevron',
  shellBody: 'aps-shell-body',
  section: 'aps-section',
  sectionHead: 'aps-section-head',
  sectionTitle: 'aps-section-title',
  sectionDesc: 'aps-section-desc',
  field: 'aps-field',
  fieldRow: 'aps-field-row',
  label: 'aps-label',
  hint: 'aps-hint',
  input: 'aps-input',
  inputNarrow: 'aps-input-narrow',
  grid: 'aps-grid',
  error: 'aps-error',
  warning: 'aps-warning',
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
  modelList: 'aps-model-list',
  modelRow: 'aps-model-row',
  modelId: 'aps-model-id',
  modelFilter: 'aps-model-filter',
  diagnostics: 'aps-diagnostics',
  diagRow: 'aps-diag-row',
  diagKey: 'aps-diag-key',
  diagDetail: 'aps-diag-detail',
  tagList: 'aps-tag-list',
  stickyActions: 'aps-sticky-actions',
  visuallyHidden: 'aps-visually-hidden',
} as const
