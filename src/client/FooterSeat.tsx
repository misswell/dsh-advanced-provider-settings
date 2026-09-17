/**
 * The Models page footer seat (spec section 42).
 *
 * The section supplies no owner props here, so this is a self-contained summary
 * that points at the one cross-provider surface: how many providers carry
 * advanced overrides, and the shortcut into the settings page that owns global
 * headers. It deliberately renders nothing when nothing is configured, so an
 * untouched install sees no extra chrome.
 */
import { useMemo, type ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { hasAnyAdvanced } from '../shared/summary.js'
import { cls } from './styles.js'
import { useProviderScope, useSettingsSnapshot, useTranslate } from './hooks.js'
import type { ClientContext } from './contract.js'

/** Build the footer seat for one plugin instance. */
export function createFooterSeat(ctx: ClientContext): () => ReactNode {
  return function FooterSeat(): ReactNode {
    return <ModelsFooter ctx={ctx} />
  }
}

/** The footer content. */
export function ModelsFooter(props: { ctx: ClientContext }): ReactNode {
  const { ctx } = props
  const t = useTranslate(ctx)
  const providerScope = useProviderScope(ctx)
  const snapshot = useSettingsSnapshot(providerScope)

  const counts = useMemo(() => {
    const providers = Object.entries(snapshot.value?.providers ?? {})
    return {
      total: providers.length,
      advanced: providers.filter(([, profile]) => hasAnyAdvanced(profile)).length,
    }
  }, [snapshot.value])

  if (counts.advanced === 0) return null

  return (
    <div className={cls.root}>
      <div className={cls.toolbar}>
        <Tag tone="info">{t('plugin.title')}</Tag>
        <span className={cls.hint}>
          {t('status.count', { count: counts.advanced })} / {counts.total}
        </span>
      </div>
    </div>
  )
}
