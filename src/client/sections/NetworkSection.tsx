/**
 * Network section: transport, timeouts and cache retention (spec sections 33-36).
 *
 * `maxRetries` and `maxRetryDelayMs` are deliberately absent: the `llm-pi-ai`
 * provider schema rejects both outright, so offering them would produce a
 * profile that fails to load. The section says so instead of staying silent,
 * because a user migrating from a hand-written YAML is likely looking for them.
 *
 * Durations are shown as the number the schema stores plus its human form on the
 * same line. `300000` is a number nobody can read at a glance, and rendering it
 * as "5 min" beside the box removes the most common way to misconfigure a
 * timeout: being off by a factor of 1000.
 */
import type { ReactNode } from 'react'
import { CACHE_RETENTIONS, TRANSPORTS } from '../../shared/capabilities.js'
import { ChoiceRow, Note, NumberBox, Row } from '../components/primitives.js'
import { InheritButton, formatDuration } from '../components/visual.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderProfile } from '../../shared/types.js'

/** DeepSeek Harness's own default stream-idle timeout. */
const IDLE_DEFAULT_MS = 300_000

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

  /** One duration row: the stored number, and what it means out loud. */
  const duration = (
    field: 'timeoutMs' | 'streamIdleTimeoutMs' | 'websocketConnectTimeoutMs',
    label: string,
    hint: string,
    fallback: number,
  ): ReactNode => {
    const value = profile[field]
    const shown = value ?? fallback
    const human = shown === 0 ? t('network.noTimeout') : formatDuration(shown, t)
    return (
      <Row
        label={label}
        note={`${value === undefined ? t('field.defaultIs', { value: human }) : human} · ${hint}`}
        error={props.issues.get(field)}
        overridden={value !== undefined}
      >
        <NumberBox
          value={value}
          placeholder={String(fallback)}
          unit="ms"
          ariaLabel={label}
          disabled={disabled}
          onChange={(next) => { onChange(field, next) }}
        />
        <InheritButton
          t={t}
          overridden={value !== undefined}
          disabled={disabled}
          onInherit={() => { onChange(field, undefined) }}
        />
      </Row>
    )
  }

  return (
    <div className={cls.section}>
      <ChoiceRow
        label={t('network.transport')}
        note={t('network.transportDesc')}
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

      {duration('timeoutMs', t('network.timeoutMs'), t('network.timeoutMsDesc'), 0)}
      {duration('streamIdleTimeoutMs', t('network.streamIdleTimeoutMs'), t('network.streamIdleTimeoutMsDesc'), IDLE_DEFAULT_MS)}
      {duration(
        'websocketConnectTimeoutMs',
        t('network.websocketConnectTimeoutMs'),
        t('network.websocketConnectTimeoutMsDesc'),
        0,
      )}

      <ChoiceRow
        label={t('network.cacheRetention')}
        note={t('network.cacheRetentionDesc')}
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

      <Note>
        <b>{t('network.unsupportedTitle')}</b> {t('network.unsupportedBody')}
      </Note>
    </div>
  )
}
