/**
 * Network section: transport, timeouts and cache retention (spec sections 33-36).
 *
 * `maxRetries` and `maxRetryDelayMs` are deliberately absent: the `llm-pi-ai`
 * provider schema rejects both outright, so offering them would produce a
 * profile that fails to load. The section says so instead of staying silent,
 * because a user migrating from a hand-written YAML is likely looking for them.
 *
 * Durations are the reason this section uses sliders. `300000` is a number
 * nobody can read at a glance, and the schema's ceiling is 2147483647 — a value
 * that looks unremarkable while being about 24 days. Rendering the same value as
 * "5 min" against a visible range removes the most common way to misconfigure a
 * timeout: being off by a factor of 1000.
 */
import type { ReactNode } from 'react'
import { CACHE_RETENTIONS, TRANSPORTS } from '../../shared/capabilities.js'
import { ChoiceRow, Notice } from '../components/primitives.js'
import { SliderField, ValueSource, formatDuration } from '../components/visual.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

/** DeepSeek Harness's own defaults, shown as the inherited slider position. */
const IDLE_DEFAULT_MS = 300_000

/** One hour is far beyond any sane timeout; the schema's real ceiling is 24 days. */
const TIMEOUT_MAX_MS = 3_600_000

/** Render the Network section body. */
export function NetworkSection(props: {
  t: Translate
  profile: ProviderProfile
  disabled: boolean
  /** Field-keyed validation messages from the host validator. */
  issues: ReadonlyMap<string, string>
  onChange: (field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, disabled, onChange } = props

  return (
    <div className={cls.section}>
      <ChoiceRow
        label={t('network.transport')}
        hint={t('network.transportDesc')}
        value={profile.transport ?? ''}
        disabled={disabled}
        options={[
          { value: '', label: t('common.inherit'), title: t('common.inheritHint') },
          ...TRANSPORTS.map((transport) => ({
            value: transport,
            label: t(`transport.${transport}.label`),
            title: t(`transport.${transport}.note`),
          })),
        ]}
        onChange={(next) => { onChange('transport', next === '' ? undefined : next) }}
      />

      <div className={cls.grid}>
        <SliderField
          t={t}
          id="aps-network-timeout"
          label={t('network.timeoutMs')}
          hint={t('network.timeoutMsDesc')}
          value={profile.timeoutMs}
          inherited={0}
          min={0}
          max={TIMEOUT_MAX_MS}
          step={1000}
          format={(value) => (value === 0 ? t('network.noTimeout') : formatDuration(value, t))}
          disabled={disabled}
          error={props.issues.get('timeoutMs')}
          onChange={(next) => { onChange('timeoutMs', next) }}
        />
        <SliderField
          t={t}
          id="aps-network-idle"
          label={t('network.streamIdleTimeoutMs')}
          hint={t('network.streamIdleTimeoutMsDesc')}
          value={profile.streamIdleTimeoutMs}
          inherited={IDLE_DEFAULT_MS}
          min={1000}
          max={TIMEOUT_MAX_MS}
          step={1000}
          format={(value) => formatDuration(value, t)}
          disabled={disabled}
          error={props.issues.get('streamIdleTimeoutMs')}
          onChange={(next) => { onChange('streamIdleTimeoutMs', next) }}
        />
        <SliderField
          t={t}
          id="aps-network-ws"
          label={t('network.websocketConnectTimeoutMs')}
          hint={t('network.websocketConnectTimeoutMsDesc')}
          value={profile.websocketConnectTimeoutMs}
          inherited={0}
          min={0}
          max={600_000}
          step={1000}
          format={(value) => (value === 0 ? t('network.noTimeout') : formatDuration(value, t))}
          disabled={disabled}
          error={props.issues.get('websocketConnectTimeoutMs')}
          onChange={(next) => { onChange('websocketConnectTimeoutMs', next) }}
        />
      </div>

      <ChoiceRow
        label={t('network.cacheRetention')}
        hint={t('network.cacheRetentionDesc')}
        value={profile.cacheRetention ?? ''}
        disabled={disabled}
        options={[
          { value: '', label: t('common.inherit'), title: t('common.inheritHint') },
          ...CACHE_RETENTIONS.map((retention) => ({
            value: retention,
            label: t(`cache.${retention}.label`),
            title: t(`cache.${retention}.note`),
          })),
        ]}
        onChange={(next) => { onChange('cacheRetention', next === '' ? undefined : next) }}
      />

      <Notice tone="info" title={t('network.unsupportedTitle')}>
        {t('network.unsupportedBody')}
      </Notice>

      <div className={cls.field}>
        <span className={cls.label}>
          <span>{t('retry.effective')}</span>
          <ValueSource t={t} overridden={profile.transport !== undefined} />
        </span>
        <span className={cls.hint}>
          {profile.transport === undefined
            ? t('preview.inherited')
            : `${t(`transport.${profile.transport}.label`)} — ${t(`transport.${profile.transport}.note`)}`}
        </span>
      </div>
    </div>
  )
}
