/**
 * Effective configuration preview (spec sections 19, 41).
 *
 * The header rows come from the host, which folds the same three layers the
 * transport uses and masks sensitive values there rather than here. The rest of
 * the summary is computed from the local draft, so it reflects what the user is
 * about to save rather than what is currently stored — which is the whole point
 * of a preview.
 */
import { useMemo, type ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { buildPreview } from '../../shared/summary.js'
import { cls } from '../styles.js'
import { Notice } from '../components/primitives.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

/** One header row as the host reports it. */
export interface EffectiveHeaderRow {
  name: string
  value: string
  source: string
  reserved: boolean
  sensitive: boolean
}

/** The host's effective-header answer. */
export interface EffectiveHeadersResult {
  headers: EffectiveHeaderRow[]
  advisories: { code: string; name: string }[]
  attributionOverridden: boolean
}

/** Render the preview. */
export function PreviewSection(props: {
  t: Translate
  profile: ProviderProfile
  effective: EffectiveHeadersResult | undefined
  loading: boolean
}): ReactNode {
  const { t, profile, effective, loading } = props
  const lines = useMemo(() => buildPreview(profile), [profile])

  return (
    <div className={cls.section}>
      <p className={cls.hint} style={{ margin: 0 }}>{t('preview.desc')}</p>

      {lines.length === 0 && (effective?.headers.length ?? 0) === 0 ? (
        <Notice tone="info">{t('preview.empty')}</Notice>
      ) : null}

      {loading && effective === undefined ? <span className={cls.hint}>{t('common.loading')}</span> : null}

      {lines.length === 0 ? null : (
        <div className={cls.preview}>
          {lines.map((line) => (
            <div className={cls.previewLine} key={line.key}>
              <span className={cls.previewKey}>{t(`preview.key.${line.key}`)}</span>
              <span className={cls.previewValue}>{line.value}</span>
            </div>
          ))}
        </div>
      )}

      {effective === undefined ? null : (
        <>
          {effective.attributionOverridden ? (
            <Notice tone="info">{t('preview.attributionOverridden')}</Notice>
          ) : null}
          {effective.advisories.length === 0 ? null : (
            <Notice tone="warning" title={t('preview.advisories')}>
              <ul className={cls.tagList}>
                {effective.advisories.map((advisory) => (
                  <li key={`${advisory.code}:${advisory.name}`}>
                    {t(`preview.advisory.${advisory.code}`, { name: advisory.name })}
                  </li>
                ))}
              </ul>
            </Notice>
          )}
        </>
      )}

      {effective === undefined ? null : (
        <div className={cls.preview}>
          <div className={cls.previewLine}>
            <span className={cls.previewKey}>{t('preview.key.headers')}</span>
            <span className={cls.previewValue}>{effective.headers.length}</span>
          </div>
          {effective.headers.map((header) => (
            <div className={cls.previewLine} key={`${header.source}:${header.name}`}>
              <span className={cls.previewKey}>
                <Tag tone={header.reserved ? 'warning' : header.source === 'harness' ? 'outline' : 'neutral'}>
                  {t(`preview.source.${header.source}`)}
                </Tag>
              </span>
              <span className={cls.previewValue}>
                {header.name}: {header.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
