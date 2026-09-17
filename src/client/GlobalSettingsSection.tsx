/**
 * The Settings → "Provider Advanced" page (spec sections 42, 55, 50).
 *
 * This page owns the one piece of configuration that has no provider to hang
 * off: the global request header list. It also carries diagnostics, the legacy
 * migration prompt, and a read-only roll-up of what each provider resolves to —
 * all of which are cross-provider questions that no provider card can answer.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { PLUGIN_NAMESPACE, PROVIDER_NAMESPACE, VERIFIED_DSH_VERSION } from '../shared/capabilities.js'
import { diffGlobalHeaders } from '../shared/patch.js'
import { headerEntriesOf, type HeaderEntry } from '../shared/headers.js'
import { cls } from './styles.js'
import { useOwnScope, useProviderScope, useRpcQuery, useSettingsSnapshot, useTranslate } from './hooks.js'
import { Field, LinkButton, Notice, SectionShell, Toolbar } from './components/primitives.js'
import { HeaderEditor, hasBlockingRow } from './components/HeaderEditor.js'
import type { ClientContext, Translate } from './contract.js'

/** Diagnostics payload the host returns. */
interface DiagnosticsResult {
  pluginVersion: string
  verifiedDshVersion: string
  detectedDshVersion?: string
  probes: { key: string; state: 'ok' | 'missing' | 'unknown'; detail?: string }[]
  reservedHeaders: string[]
  migrationAvailable: boolean
}

/** Legacy-plugin snapshot the host returns. */
interface LegacyResult {
  namespaceDetected: boolean
  packageInstalled: boolean
  bothActive: boolean
  globalHeaders: Record<string, string>
  rejectedCount: number
}

/**
 * Build the settings page component for one plugin instance.
 * @param ctx - the client context captured at registration.
 * @returns the component to register.
 */
export function createGlobalSeat(ctx: ClientContext): () => ReactNode {
  return function GlobalSeat(): ReactNode {
    return <GlobalSettingsPage ctx={ctx} />
  }
}

/**
 * The page body.
 *
 * The context arrives as a prop rather than through a module-level singleton,
 * so a test can render the page with its own context and two plugin instances
 * could never share one.
 */
export function GlobalSettingsPage(props: { ctx: ClientContext }): ReactNode {
  const { ctx } = props
  const t = useTranslate(ctx)
  const ownScope = useOwnScope(ctx)
  const providerScope = useProviderScope(ctx)

  const own = useSettingsSnapshot(ownScope)
  const providerSnapshot = useSettingsSnapshot(providerScope)

  const [headers, setHeaders] = useState<HeaderEntry[]>(() => headerEntriesOf(undefined))
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | undefined>(undefined)
  const [expanded, setExpanded] = useState<readonly string[]>(['global-headers', 'preview', 'diagnostics'])

  const committedHeaders = useMemo(() => headerEntriesOf(own.value?.globalHeaders), [own.value])
  const dirty = useMemo(
    () => JSON.stringify(headers) !== JSON.stringify(committedHeaders),
    [headers, committedHeaders],
  )

  useEffect(() => {
    if (dirty) return
    setHeaders(committedHeaders)
  }, [committedHeaders, dirty])

  const diagnostics = useRpcQuery<DiagnosticsResult>('diagnostics', {}, true)
  const legacy = useRpcQuery<LegacyResult>('legacy', {}, true)

  const providers = useMemo(
    () => Object.entries(providerSnapshot.value?.providers ?? {}),
    [providerSnapshot.value],
  )

  const toggle = useCallback((id: string): void => {
    setExpanded((current) => current.includes(id) ? current.filter((at) => at !== id) : [...current, id])
  }, [])

  const onSave = useCallback(async (): Promise<void> => {
    if (ownScope === undefined) return
    setMessage(undefined)
    const latest = ownScope.getSnapshot()
    const before = Object.fromEntries(headerEntriesOf(latest.value?.globalHeaders).map((row) => [row.name, row.value]))
    const after = Object.fromEntries(headers.map((row) => [row.name, row.value]))
    const ops = diffGlobalHeaders(before, after)
    if (ops.length === 0) {
      setMessage({ tone: 'success', text: t('common.saved') })
      return
    }
    try {
      await ownScope.mutate(ops, latest.revision)
      setMessage({ tone: 'success', text: t('common.saved') })
    } catch (error) {
      const code = error !== null && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
      setMessage(
        code === 'SETTINGS_CONFLICT' || code === 'settings/conflict'
          ? { tone: 'warning', text: t('common.conflict') }
          : { tone: 'danger', text: t('common.writeFailed') },
      )
    }
  }, [ownScope, headers, t])

  const onImport = useCallback(async (): Promise<void> => {
    if (ownScope === undefined) return
    const incoming = legacy.data?.globalHeaders ?? {}
    setMessage(undefined)
    const latest = ownScope.getSnapshot()
    const existing = Object.fromEntries(headerEntriesOf(latest.value?.globalHeaders).map((row) => [row.name, row.value]))
    const taken = new Set(Object.keys(existing).map((name) => name.toLowerCase()))
    const ops = Object.entries(incoming)
      .filter(([name]) => !taken.has(name.toLowerCase()))
      .map(([name, value]) => ({ op: 'set' as const, path: ['globalHeaders', name], value }))
    try {
      if (ops.length > 0) await ownScope.mutate(ops, latest.revision)
      await ownScope.mutate(
        [{ op: 'set', path: ['migration'], value: { globalHeaders: 'imported', decidedAt: new Date().toISOString() } }],
        ownScope.getSnapshot().revision,
      )
      setMessage({ tone: 'success', text: t('diag.migrationDone') })
      legacy.reload()
    } catch {
      setMessage({ tone: 'danger', text: t('common.writeFailed') })
    }
  }, [ownScope, legacy, t])

  const onDecline = useCallback(async (): Promise<void> => {
    if (ownScope === undefined) return
    try {
      await ownScope.mutate(
        [{ op: 'set', path: ['migration'], value: { globalHeaders: 'ignored', decidedAt: new Date().toISOString() } }],
        ownScope.getSnapshot().revision,
      )
      setMessage({ tone: 'success', text: t('diag.migrationIgnored') })
      legacy.reload()
    } catch {
      setMessage({ tone: 'danger', text: t('common.writeFailed') })
    }
  }, [ownScope, legacy, t])

  const disabled = ownScope === undefined || !own.writable || own.status !== 'ready'

  return (
    <div className={cls.root}>
      <header>
        <h2 style={{ margin: '0 0 4px' }}>{t('global.title')}</h2>
        <p className={cls.sectionDesc} style={{ margin: 0 }}>{t('global.desc')}</p>
      </header>

      {messages(t, message, own)}

      <SectionShell
        id="aps-global-headers"
        title={t('headers.globalTitle')}
        description={t('headers.globalDesc')}
        badge={headers.length === 0 ? t('status.default') : t('status.count', { count: headers.length })}
        open={expanded.includes('global-headers')}
        onToggle={() => { toggle('global-headers') }}
      >
        <HeaderEditor
          t={t}
          rows={headers}
          onChange={setHeaders}
          scope="global"
          disabled={disabled}
          showPresets
        />
        <Toolbar>
          <Button
            variant="primary"
            size="sm"
            disabled={disabled || !dirty || hasBlockingRow(headers, t)}
            onClick={() => { void onSave() }}
          >
            {t('common.save')}
          </Button>
          <LinkButton label={t('common.discard')} disabled={!dirty} onClick={() => { setHeaders(committedHeaders) }} />
        </Toolbar>
      </SectionShell>

      <SectionShell
        id="aps-preview"
        title={t('global.providersTitle')}
        description={t('global.providersDesc')}
        badge={t('status.count', { count: providers.length })}
        open={expanded.includes('preview')}
        onToggle={() => { toggle('preview') }}
      >
        {providers.length === 0 ? (
          <Notice tone="info">{t('global.providerNone')}</Notice>
        ) : (
          <div className={cls.preview}>
            {providers.map(([providerId, profile]) => (
              <div className={cls.previewLine} key={providerId}>
                <span className={cls.previewKey}>{profile.displayName ?? providerId}</span>
                <span className={cls.previewValue}>
                  {providerId} · {t('preview.key.headers')}: {Object.keys(profile.headers ?? {}).length}
                  {profile.retryPolicy === undefined ? '' : ` · ${t('section.retry')}: ${profile.retryPolicy.mode}`}
                  {profile.reasoning === undefined ? '' : ` · ${t('section.reasoning')}: ${profile.reasoning}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionShell>

      {legacy.data !== undefined && (legacy.data.bothActive || legacy.data.namespaceDetected) ? (
        <Notice tone={legacy.data.bothActive ? 'danger' : 'info'} title={t('diag.migrationTitle')}>
          {legacy.data.bothActive ? <span>{t('diag.legacyBothActive')}</span> : null}
          <span>{t('diag.migrationBody', { count: Object.keys(legacy.data.globalHeaders).length })}</span>
          <Toolbar>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || Object.keys(legacy.data.globalHeaders).length === 0}
              onClick={() => { void onImport() }}
            >
              {t('diag.migrationImport')}
            </Button>
            <LinkButton label={t('diag.migrationIgnore')} disabled={disabled} onClick={() => { void onDecline() }} />
          </Toolbar>
        </Notice>
      ) : null}

      <SectionShell
        id="aps-diagnostics"
        title={t('diag.title')}
        description={t('diag.desc')}
        open={expanded.includes('diagnostics')}
        onToggle={() => { toggle('diagnostics') }}
      >
        <div className={cls.diagnostics}>
          <DiagRow label={t('diag.pluginVersion')} value={diagnostics.data?.pluginVersion ?? '—'} />
          <DiagRow
            label={t('diag.dshVersion')}
            value={diagnostics.data?.detectedDshVersion ?? t('diag.state.unknown')}
          />
          <DiagRow label={t('diag.verifiedVersion')} value={VERIFIED_DSH_VERSION} />
          <DiagRow label={t('diag.reservedHeaders')} value={(diagnostics.data?.reservedHeaders ?? []).join(', ') || '—'} />
          {(diagnostics.data?.probes ?? []).map((probe) => (
            <DiagRow
              key={probe.key}
              label={t(`diag.probe.${probe.key}`)}
              value={t(`diag.state.${probe.state}`)}
              detail={probe.detail}
              tone={probe.state === 'ok' ? 'success' : probe.state === 'missing' ? 'warning' : 'outline'}
            />
          ))}
          {diagnostics.data === undefined ? <span className={cls.hint}>{t('common.loading')}</span> : null}
        </div>
        <Toolbar>
          <CopyDiagnostics t={t} data={diagnostics.data} />
          <Button variant="ghost" size="sm" onClick={() => { diagnostics.reload(); legacy.reload() }}>
            {t('common.test')}
          </Button>
        </Toolbar>
      </SectionShell>

      <Field label={t('global.openModels')}>
        <Toolbar>
          <Tag tone="neutral">{PLUGIN_NAMESPACE}</Tag>
          <Tag tone="neutral">{PROVIDER_NAMESPACE}</Tag>
        </Toolbar>
      </Field>
    </div>
  )
}

/** Render the status message area. */
function messages(
  t: Translate,
  message: { tone: 'success' | 'warning' | 'danger'; text: string } | undefined,
  own: { writable: boolean; status: string },
): ReactNode {
  return (
    <>
      {own.writable ? null : <Notice tone="warning">{t('common.readOnly')}</Notice>}
      {own.status === 'unavailable' ? <Notice tone="danger">{t('common.unavailable')}</Notice> : null}
      {message === undefined ? null : <Notice tone={message.tone}>{message.text}</Notice>}
    </>
  )
}

/** One diagnostics line. */
function DiagRow(props: {
  label: string
  value: string
  detail?: string | undefined
  tone?: 'outline' | 'success' | 'warning'
}): ReactNode {
  return (
    <div className={cls.diagRow}>
      <span className={cls.diagKey}>{props.label}</span>
      <Tag tone={props.tone ?? 'outline'}>{props.value}</Tag>
      {props.detail === undefined ? null : <span className={cls.diagDetail}>{props.detail}</span>}
    </div>
  )
}

/** Copy the diagnostics report as text, for pasting into a bug report. */
function CopyDiagnostics(props: { t: Translate; data: DiagnosticsResult | undefined }): ReactNode {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (): Promise<void> => {
    if (props.data === undefined) return
    const text = [
      `plugin: ${props.data.pluginVersion}`,
      `dsh: ${props.data.detectedDshVersion ?? 'unknown'}`,
      `verified: ${props.data.verifiedDshVersion}`,
      `reserved-headers: ${props.data.reservedHeaders.join(', ')}`,
      ...props.data.probes.map((probe) => `${probe.key}: ${probe.state}${probe.detail === undefined ? '' : ` (${probe.detail})`}`),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 1500)
    } catch {
      // Clipboard access can be denied; the panel still shows everything.
      setCopied(false)
    }
  }, [props.data])

  return (
    <Button variant="ghost" size="sm" disabled={props.data === undefined} onClick={() => { void copy() }}>
      {copied ? props.t('common.copied') : props.t('common.copy')}
    </Button>
  )
}
