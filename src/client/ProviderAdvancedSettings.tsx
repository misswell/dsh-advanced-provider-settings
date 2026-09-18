/**
 * The provider-card extension: "Advanced Settings" under every `llm-pi-ai` card.
 *
 * WHY THIS IS NOT A MONKEY PATCH (spec sections 4, 40): the Models page declares
 * `settings.models.provider-card` as a keyed extension seat and dispatches it
 * with `entryKey = provider.settingsNs`. This plugin registers ONE entry under
 * `key: 'llm-pi-ai'` and receives every card of that family — saved rows and the
 * add-provider draft alike. The shipped Models section keeps full ownership of
 * its own layout, and nothing here reads or writes its DOM.
 *
 * The seat is a dispatch selector, not a prop: the component learns which
 * provider it belongs to from `provider.settingsNs` / `provider.provider`, which
 * is why the guard below re-checks the namespace instead of trusting the key.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { PROVIDER_NAMESPACE } from '../shared/capabilities.js'
import {
  toRetryEditorState,
  fromRetryEditorState,
  validateRetryPolicy,
  type RetryEditorState,
} from '../shared/retry.js'
import { initiallyExpandedSections, summarizeSections, type SectionSummary } from '../shared/summary.js'
import { cls } from './styles.js'
import { useProviderDraft, type SaveOutcome } from './draft.js'
import { useOwnScope, useProviderScope, useRpc, useRpcQuery, useSettingsSnapshot, useTranslate } from './hooks.js'
import { Field, LinkButton, Notice, SectionShell } from './components/primitives.js'
import { HeaderEditor, hasBlockingRow } from './components/HeaderEditor.js'
import { RetryEditor } from './components/RetryEditor.js'
import { NetworkSection } from './sections/NetworkSection.js'
import { VisionSection } from './sections/VisionSection.js'
import { ReasoningSection } from './sections/ReasoningSection.js'
import { CompatibilitySection } from './sections/CompatibilitySection.js'
import { ModelsSection } from './sections/ModelsSection.js'
import { PreviewSection, type EffectiveHeadersResult } from './sections/PreviewSection.js'
import { headerEntriesOf, type HeaderEntry } from '../shared/headers.js'
import type { ClientContext, ProviderDirectoryEntry, Translate } from './contract.js'

/** Owner props the Models section supplies at this seat. */
export interface ProviderCardSeatProps {
  provider: ProviderDirectoryEntry
  configured: boolean
  keyConfigured: boolean
}

/**
 * Build the seat component for one plugin instance.
 * @param ctx - the client context captured at registration.
 * @returns the component to register.
 */
export function createProviderCardSeat(ctx: ClientContext): (props: ProviderCardSeatProps) => ReactNode {
  return function ProviderCardSeat(props: ProviderCardSeatProps): ReactNode {
    return <ProviderAdvancedSettings ctx={ctx} {...props} />
  }
}

/** The advanced settings panel for one provider. */
export function ProviderAdvancedSettings(props: ProviderCardSeatProps & { ctx: ClientContext }): ReactNode {
  const { ctx, provider, configured } = props
  const t = useTranslate(ctx)

  // The dispatch key already selected this family; this guard covers the case
  // where a different namespace's card is rendered with our entry key.
  if (provider.settingsNs !== PROVIDER_NAMESPACE) return null

  return <Panel t={t} ctx={ctx} provider={provider} configured={configured} />
}

/** The panel proper. Split out so hooks run only for the matching namespace. */
function Panel(props: {
  t: Translate
  ctx: ClientContext
  provider: ProviderDirectoryEntry
  configured: boolean
}): ReactNode {
  const { t, ctx, provider } = props
  const providerId = provider.provider

  const scope = useProviderScope(ctx)
  const draft = useProviderDraft(scope, providerId)
  const ownScope = useOwnScope(ctx)
  const own = useSettingsSnapshot(ownScope)

  const [open, setOpen] = useState(false)
  // Seeded from the committed profile: see `initiallyExpandedSections`.
  const [expanded, setExpanded] = useState<readonly string[]>(() => [...initiallyExpandedSections(draft.committed)])
  const [headers, setHeaders] = useState<HeaderEntry[]>(() => headerEntriesOf(draft.committed.headers))
  const [retryState, setRetryState] = useState(() => toRetryEditorState(draft.committed.retryPolicy))
  const [alwaysAck, setAlwaysAck] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | undefined>(undefined)
  const [acknowledged, setAcknowledged] = useState(false)

  const profile = draft.draft

  // Adopt committed values while the form is clean; never while it is dirty.
  useEffect(() => {
    if (draft.dirty) return
    setHeaders(headerEntriesOf(draft.committed.headers))
    setRetryState(toRetryEditorState(draft.committed.retryPolicy))
  }, [draft.committed, draft.dirty])

  // `ui.advancedExpanded` is the persisted "starts expanded" preference. It is
  // applied once, on the first snapshot that arrives: re-applying it later would
  // fight the user's own toggling every time an unrelated settings write bumped
  // the revision.
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current || own.status !== 'ready') return
    hydrated.current = true
    if (own.value?.ui?.advancedExpanded === true) setOpen(true)
  }, [own])

  const persistOpen = useCallback((next: boolean): void => {
    setOpen(next)
    if (ownScope === undefined) return
    // A UI preference is not worth blocking the panel over, and it is not
    // provider configuration: a failed write costs a remembered toggle.
    void ownScope
      .mutate([{ op: 'set', path: ['ui', 'advancedExpanded'], value: next }], ownScope.getSnapshot().revision)
      .catch(() => undefined)
  }, [ownScope])

  const summaries = useMemo(() => summarizeSections(profile), [profile])
  const summaryById = useMemo(
    () => new Map(summaries.map((summary) => [summary.id, summary])),
    [summaries],
  )
  // Transport and timeout are separate provider fields in the Harness schema but
  // one section here, so their badges are folded into a single label. Folding
  // happens once, here, for both the collapsed row and the section badge.
  const networkBadge = useMemo(
    () => combineBadge(t, [summaryById.get('transport'), summaryById.get('timeout')]),
    [summaryById, t],
  )
  const displaySummaries = useMemo(
    () => buildDisplaySummaries(t, summaries),
    [summaries, t],
  )

  const effective = useRpcQuery<EffectiveHeadersResult>(
    'effective-headers',
    { providerId },
    open && props.configured,
  )

  const toggleSection = useCallback((id: string): void => {
    setExpanded((current) => current.includes(id) ? current.filter((at) => at !== id) : [...current, id])
  }, [])

  const setHeadersAndDraft = useCallback((next: HeaderEntry[]): void => {
    setHeaders(next)
    const record = next.length === 0 ? undefined : Object.fromEntries(next.map((row) => [row.name, row.value]))
    draft.setField('headers', record)
  }, [draft])

  const setRetryAndDraft = useCallback((next: RetryEditorState | null): void => {
    setRetryState(next)
    // `null` is the Harness Default preset: the field is removed rather than
    // written with today's default numbers, so a future DSH release is still
    // inherited (section 46).
    draft.setField('retryPolicy', next === null ? undefined : fromRetryEditorState(next))
  }, [draft])

  const retryIssues = useMemo(() => {
    const map = new Map<string, string>()
    const policy = profile.retryPolicy
    if (policy === undefined) return map
    for (const issue of validateRetryPolicy(policy)) map.set(issue.field, issue.code)
    return map
  }, [profile.retryPolicy])

  const headersInvalid = headers.length > 0 && hasBlockingRow(headers, t)
  const retryInvalid = retryIssues.size > 0
  const alwaysUnacknowledged = profile.retryPolicy?.mode === 'always' && !alwaysAck && !acknowledged

  const onSave = useCallback(async (): Promise<void> => {
    setMessage(undefined)
    const outcome: SaveOutcome = await draft.save()
    if (outcome === 'saved' || outcome === 'noop') {
      setMessage({ tone: 'success', text: t('common.saved') })
      // A successful write makes the draft authoritative until the snapshot
      // catches up, so it is cleared here rather than in the hook.
      draft.discard()
      return
    }
    if (outcome === 'conflict') setMessage({ tone: 'warning', text: t('common.conflict') })
    else setMessage({ tone: 'danger', text: t('common.writeFailed') })
  }, [draft, t])

  const onResetAll = useCallback((): void => {
    // Reset is a DRAFT operation: the user still has to save, so an accidental
    // click cannot wipe a working configuration.
    draft.reset()
    setHeaders(headerEntriesOf(draft.draft.headers))
    setRetryState(toRetryEditorState(draft.draft.retryPolicy))
    setMessage(undefined)
  }, [draft])

  const disabled = !draft.writable || draft.status !== 'ready'

  if (!props.configured) {
    return (
      <div className={cls.root}>
        <Notice tone="info">{t('card.unconfigured')}</Notice>
      </div>
    )
  }

  return (
    <div className={cls.root}>
      <div className={cls.shell}>
        <div
          className={cls.shellHeader}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => { persistOpen(!open) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              persistOpen(!open)
            }
          }}
        >
          <span className={cls.shellChevron} data-open={open}>▶</span>
          <span className={cls.shellTitle}>{t('plugin.title')}</span>
          {displaySummaries.length > 0 ? (
            displaySummaries.slice(0, 4).map((summary) => (
              <Tag key={summary.key} tone={summary.tone}>
                {`${summary.label}: ${summary.badge ?? ''}`}
              </Tag>
            ))
          ) : (
            <Tag tone="quiet">{t('plugin.summaryDefault')}</Tag>
          )}
        </div>

        {open ? (
          <div className={cls.shellBody}>
            {draft.writable ? null : <Notice tone="warning">{t('common.readOnly')}</Notice>}
            {draft.status === 'unavailable' ? <Notice tone="danger">{t('common.unavailable')}</Notice> : null}

            <SectionShell
              id="aps-headers"
              title={t('section.headers')}
              description={t('headers.providerDesc')}
              badge={badgeFor(t, summaryById.get('headers'))}
              open={expanded.includes('headers')}
              onToggle={() => { toggleSection('headers') }}
            >
              <HeaderEditor
                t={t}
                rows={headers}
                onChange={setHeadersAndDraft}
                scope="provider"
                credentialRef={profile.apiKeyEnv}
                disabled={disabled}
              />
            </SectionShell>

            <SectionShell
              id="aps-retry"
              title={t('section.retry')}
              badge={badgeFor(t, summaryById.get('retry'))}
              tone={profile.retryPolicy?.mode === 'always' ? 'warning' : 'outline'}
              open={expanded.includes('retry')}
              onToggle={() => { toggleSection('retry') }}
            >
              <RetryEditor
                t={t}
                state={retryState}
                onChange={setRetryAndDraft}
                issues={retryIssues}
                disabled={disabled}
                acknowledged={alwaysAck || acknowledged}
                onAcknowledge={() => { setAlwaysAck(true); setAcknowledged(true) }}
              />
            </SectionShell>

            <SectionShell
              id="aps-network"
              title={t('section.network')}
              badge={networkBadge}
              tone={networkTone(summaryById)}
              open={expanded.includes('network')}
              onToggle={() => { toggleSection('network') }}
            >
              <NetworkSection
                t={t}
                profile={profile}
                disabled={disabled}
                issues={new Map()}
                onChange={draft.setField}
              />
            </SectionShell>

            <SectionShell
              id="aps-vision"
              title={t('section.vision')}
              badge={badgeFor(t, summaryById.get('vision'))}
              open={expanded.includes('vision')}
              onToggle={() => { toggleSection('vision') }}
            >
              <VisionSection
                t={t}
                profile={profile}
                disabled={disabled}
                issues={new Map()}
                onChange={draft.setField}
              />
            </SectionShell>

            <SectionShell
              id="aps-reasoning"
              title={t('section.reasoning')}
              badge={badgeFor(t, summaryById.get('reasoning'))}
              open={expanded.includes('reasoning')}
              onToggle={() => { toggleSection('reasoning') }}
            >
              <ReasoningSection
                t={t}
                profile={profile}
                disabled={disabled}
                issues={new Map()}
                onChange={draft.setField}
              />
            </SectionShell>

            <SectionShell
              id="aps-compat"
              title={t('section.compatibility')}
              badge={badgeFor(t, summaryById.get('compatibility'))}
              open={expanded.includes('compatibility')}
              onToggle={() => { toggleSection('compatibility') }}
            >
              <CompatibilitySection
                t={t}
                profile={profile}
                disabled={disabled}
                onChange={draft.setField}
              />
            </SectionShell>

            <SectionShell
              id="aps-models"
              title={t('section.models')}
              badge={badgeFor(t, summaryById.get('models'))}
              open={expanded.includes('models')}
              onToggle={() => { toggleSection('models') }}
            >
              <ModelsSection
                t={t}
                profile={profile}
                disabled={disabled}
                onChange={draft.setField}
                onModelField={draft.setModelField}
              />
            </SectionShell>

            <SectionShell
              id="aps-preview"
              title={t('section.preview')}
              description={t('preview.desc')}
              open={expanded.includes('preview')}
              onToggle={() => { toggleSection('preview') }}
            >
              <PreviewSection
                t={t}
                profile={profile}
                effective={effective.data}
                loading={effective.loading}
              />
              <TestProvider
                t={t}
                providerId={providerId}
                baseURL={profile.baseURL}
                api={profile.api}
                headers={headers}
              />
            </SectionShell>

            {message === undefined ? null : <Notice tone={message.tone}>{message.text}</Notice>}
            {draft.dirty ? <span className={cls.hint}>{t('common.dirty')}</span> : null}

            <div className={cls.stickyActions}>
              <Button
                variant="primary"
                size="md"
                disabled={disabled || !draft.dirty || headersInvalid || retryInvalid || alwaysUnacknowledged}
                onClick={() => { void onSave() }}
              >
                {t('common.save')}
              </Button>
              <LinkButton label={t('common.discard')} disabled={!draft.dirty} onClick={() => { draft.discard() }} />
              <LinkButton label={t('common.inherit')} title={t('common.inheritHint')} disabled={disabled} onClick={onResetAll} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** The Test Provider action, which spends a model-discovery call instead of a completion. */
function TestProvider(props: {
  t: Translate
  providerId: string
  baseURL: string | undefined
  api: string | undefined
  headers: readonly HeaderEntry[]
}): ReactNode {
  const rpc = useRpc()
  const [state, setState] = useState<{ tone: 'success' | 'danger'; text: string } | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async (): Promise<void> => {
    setBusy(true)
    setState(undefined)
    const payload: Record<string, string | Record<string, string>> = { providerId: props.providerId }
    if (props.baseURL !== undefined) payload.baseURL = props.baseURL
    if (props.api !== undefined) payload.api = props.api
    const record: Record<string, string> = {}
    for (const header of props.headers) {
      if (header.name.trim().length > 0 && header.value.length > 0) record[header.name] = header.value
    }
    payload.headers = record

    const result = await rpc<{ ok: boolean; modelCount: number; elapsedMs: number; status?: number; message?: string }>(
      'discover',
      payload,
    )
    setBusy(false)
    if (result === undefined) {
      setState({ tone: 'danger', text: props.t('common.unavailable') })
      return
    }
    if (result.ok) {
      setState({
        tone: 'success',
        text: props.t('test.ok', { count: result.modelCount, ms: result.elapsedMs }),
      })
      return
    }
    const detail = [
      result.status === undefined ? undefined : props.t('test.http', { status: result.status }),
      result.message,
    ].filter((part): part is string => part !== undefined).join(' · ')
    setState({ tone: 'danger', text: props.t('test.fail', { detail }) })
  }, [rpc, props])

  return (
    <Field label={props.t('test.title')} hint={props.t('test.desc')}>
      <div className={cls.toolbar}>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || props.baseURL === undefined}
          onClick={() => { void run() }}
        >
          {busy ? props.t('common.testing') : props.t('test.run')}
        </Button>
        <Tag tone="neutral">{props.t('test.useHeaders', { count: props.headers.length })}</Tag>
        {props.baseURL === undefined ? <span className={cls.hint}>{props.t('test.needEndpoint')}</span> : null}
      </div>
      {state === undefined ? null : <Notice tone={state.tone}>{state.text}</Notice>}
    </Field>
  )
}

/**
 * Fold several section summaries into one badge, for a UI section that covers
 * more than one provider field.
 * @param t - translate function.
 * @param summaries - the contributing summaries, in display order.
 * @returns the first non-default badge, or the default label.
 */
function combineBadge(t: Translate, summaries: readonly (SectionSummary | undefined)[]): string | undefined {
  if (summaries.every((summary) => summary === undefined)) return undefined
  const active = summaries.find(
    (summary) => summary !== undefined && summary.status.kind !== 'default' && summary.status.kind !== 'default-warning',
  )
  if (active !== undefined) return badgeFor(t, active)
  const warning = summaries.find((summary) => summary?.status.kind === 'default-warning')
  return badgeFor(t, warning)
}

/** Warning tone when either contributing summary asks for attention. */
function networkTone(summaryById: ReadonlyMap<string, SectionSummary>): 'warning' | 'outline' {
  return summaryById.get('transport')?.status.kind === 'default-warning' ? 'warning' : 'outline'
}

/** Short badge text for a section summary. */
function badgeFor(t: Translate, summary: SectionSummary | undefined): string | undefined {
  if (summary === undefined) return undefined
  switch (summary.status.kind) {
    case 'default':
      return t('status.default')
    case 'default-warning':
      return t('status.warning')
    case 'count':
      return t('status.count', { count: summary.status.count })
    case 'retries':
      return t('status.retries', { count: summary.status.count })
    case 'always':
      return t('status.always')
    case 'level':
      return t('status.level', { level: summary.status.level })
    case 'custom':
      return t('status.custom')
    case 'custom-warning':
      return t('status.warning')
    default:
      return undefined
  }
}

/** One entry of the collapsed summary row. */
interface DisplaySummary {
  /** Stable React key, also the dictionary id for `section.<key>`. */
  key: string
  label: string
  badge: string | undefined
  /** `Tag` tone; `networkTone` may return `outline` for an unremarkable value. */
  tone: 'warning' | 'info' | 'outline'
}

/**
 * Collapse the per-field summaries into the sections the card actually shows.
 *
 * `summarizeSections` reports `timeout` and `transport` separately, because they
 * are independent provider fields. They render as one Network section, so the
 * row must fold them: emitting both would print the same label twice with
 * different counts, and asking the dictionary for `section.timeout` — a key that
 * deliberately does not exist, since there is no Timeout section — would print
 * the raw key to the user.
 * @param t - bound translate for this plugin's namespace.
 * @param summaries - per-field summaries in display order.
 * @returns one row per visible section, non-default entries only.
 */
function buildDisplaySummaries(t: Translate, summaries: readonly SectionSummary[]): DisplaySummary[] {
  const byId = new Map(summaries.map((summary) => [summary.id, summary]))
  const rows: DisplaySummary[] = []
  for (const summary of summaries) {
    const id = summary.id
    // `transport` is consumed by the `timeout` iteration, whichever comes first.
    if (id === 'transport') continue
    if (id === 'timeout') {
      const badge = combineBadge(t, [byId.get('transport'), byId.get('timeout')])
      if (badge !== undefined) {
        rows.push({
          key: 'network',
          label: t('section.network'),
          badge,
          tone: networkTone(byId),
        })
      }
      continue
    }
    if (summary.status.kind === 'default') continue
    rows.push({
      key: id,
      label: t(`section.${id}`),
      badge: badgeFor(t, summary),
      tone: summary.status.kind.includes('warning') ? 'warning' : 'info',
    })
  }
  return rows
}

