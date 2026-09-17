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
