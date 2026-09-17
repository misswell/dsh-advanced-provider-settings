/**
 * Models section: the per-model fields this plugin owns (spec sections 29, 30, 40).
 *
 * Only `input` and `reasoningEfforts` are editable — everything else about a
 * model (its id, context window, output limit) belongs to the Models page, so
 * the editor addresses models by index and never reorders or renames them.
 *
 * The per-model compat grid is filtered by the ROUTE protocol because a
 * mismatched field here is a hard error in Harness rather than a no-op.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Button, Input, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { THINKING_LEVELS } from '../../shared/capabilities.js'
import { compatFieldsFor } from '../../shared/capabilities.js'
import { ChoiceRow, Field, Notice } from '../components/primitives.js'
import { CompatFieldGrid, withValue } from './CompatibilitySection.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderModelEntry, ProviderProfile } from '../../shared/types.js'

/** Render the Models section body. */
export function ModelsSection(props: {
  t: Translate
  profile: ProviderProfile
  disabled: boolean
  onChange: (field: string, value: unknown) => void
  onModelField: (index: number, field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, disabled, onChange, onModelField } = props
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<readonly number[]>([])

  const models = useMemo(
    () => (Array.isArray(profile.models) ? profile.models : []),
    [profile.models],
  )
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return models
      .map((model, index) => ({ model, index }))
      .filter(({ model }) => needle.length === 0 || (model.id ?? '').toLowerCase().includes(needle) || (model.name ?? '').toLowerCase().includes(needle))
  }, [models, filter])

  if (models.length === 0) {
    return (
      <div className={cls.section}>
        <Notice tone="info">{t('models.none')}</Notice>
      </div>
    )
  }

  const toggle = (index: number): void => {
    setExpanded((current) => current.includes(index) ? current.filter((at) => at !== index) : [...current, index])
  }

  return (
    <div className={cls.section}>
      <p className={cls.hint} style={{ margin: 0 }}>{t('models.desc')}</p>

      <div className={cls.modelFilter}>
        <Input
          className={`${cls.mono} ${cls.input}`}
          value={filter}
          placeholder={t('models.filter')}
          aria-label={t('models.filter')}
          spellCheck={false}
          onChange={(event) => { setFilter(event.currentTarget.value) }}
        />
        <Tag tone="neutral">{visible.length} / {models.length}</Tag>
      </div>

      <div className={cls.modelList}>
        {visible.map(({ model, index }) => (
          <ModelRow
            key={`${model.id ?? 'model'}-${String(index)}`}
            t={t}
            model={model}
            index={index}
            protocol={profile.api}
            disabled={disabled}
            open={expanded.includes(index)}
            onToggle={() => { toggle(index) }}
            onModelField={onModelField}
          />
        ))}
      </div>

      {Object.keys(profile.compat ?? {}).length === 0 ? null : (
        <Notice tone="warning">{t('compat.routeDesc')}</Notice>
      )}
      <div className={cls.toolbar}>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => { onChange('models', undefined) }}
          title={t('common.inheritHint')}
        >
          {t('common.resetSection')}
        </Button>
      </div>
    </div>
  )
}

/** One model's row and its expanded editor. */
function ModelRow(props: {
  t: Translate
  model: ProviderModelEntry
  index: number
  protocol: string | undefined
  disabled: boolean
  open: boolean
  onToggle: () => void
  onModelField: (index: number, field: string, value: unknown) => void
}): ReactNode {
  const { t, model, index, disabled, onModelField } = props
  const efforts = model.reasoningEfforts
  const effortsDisabled = efforts === false
  const mapping = effortsDisabled || efforts === undefined ? {} : efforts

  const overrideCount = [model.input, model.reasoningEfforts, model.compat]
    .filter((value) => value !== undefined).length

  return (
    <div className={cls.modelRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div className={cls.fieldRow}>
        <button
          type="button"
          className={cls.modelId}
          aria-expanded={props.open}
          onClick={props.onToggle}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
        >
          {props.open ? '▾' : '▸'} {model.id ?? `#${String(index)}`}
        </button>
        {overrideCount === 0 ? null : <Tag tone="info">{t('models.overrides', { count: overrideCount })}</Tag>}
        <Tag tone={inputHasImage(model.input) ? 'success' : 'outline'}>
          {inputHasImage(model.input) ? t('vision.textImage') : t('vision.textOnly')}
        </Tag>
      </div>

      {props.open ? (
        <div className={cls.section} style={{ paddingLeft: 14 }}>
          <ChoiceRow
            label={t('vision.defaultInput')}
            value={inputChoiceOf(model.input)}
            disabled={disabled}
            options={[
              { value: 'inherit', label: t('common.inherit'), title: t('common.inheritHint') },
              { value: 'text', label: t('vision.textOnly') },
              { value: 'text-image', label: t('vision.textImage') },
            ]}
            onChange={(next) => {
              onModelField(index, 'input', next === 'inherit' ? undefined : next === 'text' ? ['text'] : ['text', 'image'])
            }}
          />

          <Field label={t('reasoning.levelsTitle')} hint={t('reasoning.levelsDesc')}>
            {effortsDisabled ? (
              <Notice tone="info">{t('reasoning.effortsDisabled')}</Notice>
            ) : (
              <div className={cls.grid}>
                {THINKING_LEVELS.map((level) => {
                  const wire = (mapping as Record<string, string | null>)[level]
                  return (
                    <Field key={level} label={level}>
                      <Input
                        className={`${cls.mono} ${cls.input}`}
                        value={wire === null || wire === undefined ? '' : wire}
                        placeholder={t('reasoning.unsupported')}
                        aria-label={`${level} ${t('reasoning.wireValue')}`}
                        disabled={disabled}
                        spellCheck={false}
                        onChange={(event) => {
                          const raw = event.currentTarget.value
                          const next = { ...(mapping as Record<string, string | null>) }
                          // Blank clears the level: DSH pins an undeclared level
                          // to null, which means "this model does not support it".
                          if (raw === '') delete next[level]
                          else next[level] = raw
                          onModelField(index, 'reasoningEfforts', Object.keys(next).length === 0 ? undefined : next)
                        }}
                      />
                    </Field>
                  )
                })}
              </div>
            )}
          </Field>

          {compatFieldsFor(props.protocol).length === 0 ? null : (
            <Field label={t('compat.modelTitle')} hint={t('compat.modelDesc')}>
              <CompatFieldGrid
                t={t}
                fields={compatFieldsFor(props.protocol)}
                values={(model.compat ?? {}) as Record<string, unknown>}
                disabled={disabled}
                onChange={(key, value) => {
                  onModelField(index, 'compat', withValue((model.compat ?? {}) as Record<string, unknown>, key, value))
                }}
              />
            </Field>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Whether a stored input list claims image support. */
function inputHasImage(input: readonly string[] | undefined): boolean {
  return Array.isArray(input) && input.includes('image')
}

/** Map a stored `input` list onto one of the three editor choices. */
function inputChoiceOf(input: readonly string[] | undefined): string {
  if (input === undefined || input.length === 0) return 'inherit'
  return input.includes('image') ? 'text-image' : 'text'
}
