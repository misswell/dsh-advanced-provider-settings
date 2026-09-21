/**
 * Per-model configuration (spec sections 29, 30, 40).
 *
 * This is the level the user actually thinks in: a provider is a credential and
 * a URL, but "does THIS model take images" and "what does its `high` map to on
 * the wire" are per-model facts. So the card is a master-detail — pick a model,
 * edit that model — rather than a list of accordions, and it sits above the
 * provider-wide cards instead of trailing them.
 *
 * Harness accepts exactly three fields on a model entry: `input`,
 * `reasoningEfforts` and `compat` (plus `name`/`contextWindow`/`maxTokens`,
 * which belong to the Models page). Anything else written there is rejected by
 * the strict validation a settings write uses, so this editor offers nothing
 * else — and says so, because "I expected a retry setting here" is otherwise
 * unanswerable from the screen.
 *
 * The per-model compat grid is filtered by the ROUTE protocol for the same
 * reason: a field the protocol does not read is a hard error at model level
 * where it is only ignored at route level.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Button, Input, Pill, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { MANAGED_MODEL_KEYS, THINKING_LEVELS, compatFieldsFor } from '../../shared/capabilities.js'
import { claimsImageSupport } from '../../shared/vision.js'
import { ChoiceRow, Field, Note, Row } from '../components/primitives.js'
import { CompatFieldGrid, withValue } from './CompatibilitySection.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderModelEntry, ProviderProfile } from '../../shared/types.js'

/** How many models make a picker long enough to need a filter box. */
const FILTER_AT = 8

/** Render the per-model editor for one provider. */
export function ModelsSection(props: {
  t: Translate
  profile: ProviderProfile
  disabled: boolean
  onModelField: (index: number, field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, disabled, onModelField } = props
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(0)

  const models = useMemo(
    () => (Array.isArray(profile.models) ? profile.models : []),
    [profile.models],
  )
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return models
      .map((model, index) => ({ model, index }))
      .filter(({ model }) => needle.length === 0
        || (model.id ?? '').toLowerCase().includes(needle)
        || (model.name ?? '').toLowerCase().includes(needle))
  }, [models, filter])

  if (models.length === 0) {
    return (
      <div className={cls.section}>
        <Note>{t('models.none')}</Note>
      </div>
    )
  }

  // A filter that hides the current selection must not hide the editor with it.
  const current = models[Math.min(selected, models.length - 1)] as ProviderModelEntry
  const currentIndex = Math.min(selected, models.length - 1)

  return (
    <div className={cls.section}>
      <div className={cls.modelPicker}>
        {models.length > FILTER_AT ? (
          <div className={cls.fieldRow}>
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
        ) : null}
        <div className={cls.pickerList} role="radiogroup" aria-label={t('models.pick')}>
          {visible.length === 0 ? (
            <p className={cls.hint}>{t('models.noneMatch')}</p>
          ) : null}
          {visible.map(({ model, index }) => {
            const overrides = overrideCountOf(model)
            return (
              <Pill
                key={`${model.id ?? 'model'}-${String(index)}`}
                role="radio"
                aria-checked={index === currentIndex}
                active={index === currentIndex}
                title={[
                  model.id ?? '',
                  overrides > 0 ? t('models.hasOverrides', { count: overrides }) : '',
                ].filter((part) => part !== '').join(' · ')}
                onClick={() => { setSelected(index) }}
              >
                <span className={cls.pickerName}>{model.id ?? `#${String(index)}`}</span>
                {claimsImageSupport(model.input) ? (
                  <span className={cls.pickerMark} data-image="true">{t('models.imageMark')}</span>
                ) : null}
                {overrides > 0 ? <span className={cls.pickerDot} /> : null}
              </Pill>
            )
          })}
        </div>
      </div>

      <ModelEditor
        // Remounting on selection keeps a typed-but-empty field from carrying
        // over from the previous model.
        key={`model-${String(currentIndex)}`}
        t={t}
        profile={profile}
        model={current}
        index={currentIndex}
        disabled={disabled}
        onModelField={onModelField}
      />
    </div>
  )
}

/** The three fields one model can carry, edited in place. */
function ModelEditor(props: {
  t: Translate
  profile: ProviderProfile
  model: ProviderModelEntry
  index: number
  disabled: boolean
  onModelField: (index: number, field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, model, index, disabled, onModelField } = props
  const efforts = model.reasoningEfforts
  const effortsDisabled = efforts === false
  const mapping = effortsDisabled || efforts === undefined ? {} : efforts
  const fields = compatFieldsFor(profile.api)
  const id = model.id ?? `#${String(index)}`

  const setEffort = (level: string, raw: string): void => {
    const next = { ...(mapping as Record<string, string | null>) }
    // Blank clears the level: DSH pins an undeclared level to null, which means
    // "this model does not support it".
    if (raw === '') delete next[level]
    else next[level] = raw
    onModelField(index, 'reasoningEfforts', Object.keys(next).length === 0 ? undefined : next)
  }

  return (
    <div className={cls.modelEditor}>
      <div className={cls.modelEditorHead}>
        <code className={cls.modelEditorId}>{id}</code>
        <span className={cls.spacer} />
        {overrideCountOf(model) > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              for (const field of MANAGED_MODEL_KEYS) onModelField(index, field, undefined)
            }}
          >
            {t('models.clearOverrides')}
          </Button>
        ) : null}
      </div>

      <ChoiceRow
        label={t('models.inputTitle')}
        note={model.input === undefined
          ? profile.defaultInput === undefined || profile.defaultInput.length === 0
            ? t('models.inheritsCatalog')
            : t('models.inheritsDefault', {
              value: claimsImageSupport(profile.defaultInput) ? t('vision.textImage') : t('vision.textOnly'),
            })
          : t('models.inputOverridesCatalog')}
        value={inputChoiceOf(model.input)}
        overridden={model.input !== undefined}
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

      <Row label={t('reasoning.levelsTitle')} note={t('reasoning.levelsDesc')} wide>
        {effortsDisabled ? (
          <Note>{t('reasoning.effortsDisabled')}</Note>
        ) : (
          <div className={cls.grid}>
            {THINKING_LEVELS.map((level) => {
              const wire = (mapping as Record<string, string | null>)[level]
              return (
                <Field key={level} label={t(`level.${level}.label`)}>
                  <Input
                    className={`${cls.mono} ${cls.input}`}
                    value={wire === null || wire === undefined ? '' : wire}
                    placeholder={t('reasoning.unsupported')}
                    aria-label={`${level} ${t('reasoning.wireValue')}`}
                    disabled={disabled}
                    spellCheck={false}
                    onChange={(event) => { setEffort(level, event.currentTarget.value) }}
                  />
                </Field>
              )
            })}
          </div>
        )}
      </Row>

      {fields.length === 0 ? null : (
        <Row label={t('compat.modelTitle')} note={t('compat.modelDesc')} wide>
          <CompatFieldGrid
            t={t}
            fields={fields}
            values={(model.compat ?? {}) as Record<string, unknown>}
            disabled={disabled}
            inheritedValues={(profile.compat ?? {}) as Record<string, unknown>}
            inheritedFrom={t('compat.routeLevel')}
            onChange={(key, value) => {
              onModelField(index, 'compat', withValue((model.compat ?? {}) as Record<string, unknown>, key, value))
            }}
          />
        </Row>
      )}

      <Note>{t('models.providerOnly')}</Note>
    </div>
  )
}

/** How many of the per-model fields this entry sets. */
function overrideCountOf(model: ProviderModelEntry): number {
  return MANAGED_MODEL_KEYS.filter((field) => model[field] !== undefined).length
}

/** Map a stored `input` list onto one of the three editor choices. */
function inputChoiceOf(input: readonly string[] | undefined): string {
  if (input === undefined || input.length === 0) return 'inherit'
  return input.includes('image') ? 'text-image' : 'text'
}
