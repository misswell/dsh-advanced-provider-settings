/**
 * Network section: transport, timeouts and cache retention (spec sections 33-36).
 *
 * `maxRetries` and `maxRetryDelayMs` are deliberately absent: the `llm-pi-ai`
 * provider schema rejects both outright, so offering them would produce a
 * profile that fails to load. The section says so instead of staying silent,
 * because a user migrating from a hand-written YAML is likely looking for them.
 */
import type { ReactNode } from 'react'
import { CACHE_RETENTIONS, TRANSPORTS } from '../../shared/capabilities.js'
import { ChoiceRow, Field, NumberField, Notice } from '../components/primitives.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

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
          { value: '', label: t('common.inherit') },
          ...TRANSPORTS.map((transport) => ({ value: transport, label: transport })),
        ]}
        onChange={(next) => { onChange('transport', next === '' ? undefined : next) }}
      />

      <div className={cls.grid}>
        <NumberField
          id="aps-network-timeout"
          label={t('network.timeoutMs')}
          hint={t('network.timeoutMsDesc')}
          value={profile.timeoutMs}
          min={0}
          placeholder="0"
          disabled={disabled}
          error={props.issues.get('timeoutMs')}
          onChange={(next) => { onChange('timeoutMs', next) }}
        />
        <NumberField
          id="aps-network-idle"
          label={t('network.streamIdleTimeoutMs')}
          hint={t('network.streamIdleTimeoutMsDesc')}
          value={profile.streamIdleTimeoutMs}
          min={1}
          max={2_147_483_647}
          placeholder="300000"
          disabled={disabled}
          error={props.issues.get('streamIdleTimeoutMs')}
          onChange={(next) => { onChange('streamIdleTimeoutMs', next) }}
        />
        <NumberField
          id="aps-network-ws"
          label={t('network.websocketConnectTimeoutMs')}
          hint={t('network.websocketConnectTimeoutMsDesc')}
          value={profile.websocketConnectTimeoutMs}
          min={0}
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
          { value: '', label: t('common.inherit') },
          ...CACHE_RETENTIONS.map((retention) => ({ value: retention, label: retention })),
        ]}
        onChange={(next) => { onChange('cacheRetention', next === '' ? undefined : next) }}
      />

      <Notice tone="info" title={t('network.unsupportedTitle')}>
        {t('network.unsupportedBody')}
      </Notice>

      <Field label={t('retry.effective')}>
        <span className={cls.hint}>
          {profile.transport === undefined ? t('preview.inherited') : profile.transport}
        </span>
      </Field>
    </div>
  )
}
