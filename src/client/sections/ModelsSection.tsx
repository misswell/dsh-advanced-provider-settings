/**
 * Per-model configuration (spec sections 29, 30, 40).
 *
 * This is the level the user actually thinks in: a provider is a credential and
 * a URL, but "does THIS model take images" and "what does its `high` map to on
 * the wire" are per-model facts. So the card is a master-detail — pick a model,
 * edit that model — rather than a list of accordions, and it sits above the
 * provider-wide cards instead of trailing them.
 *
 * There are two channels, and the profile decides which one is in play:
 *
 *  - A non-empty `models` list REPLACES the served catalog, so its entries are
 *    the models. They are edited in place, addressed by index.
 *  - A route with no `models` list serves the INSTALLED CATALOG, and the only
 *    per-model channel left is `modelOverrides.<id>` — keyed by model id, which
 *    is why the model list itself has to come from the host (`catalog-models`).
 *    Harness refuses an id the catalog does not describe.
 *
 * The two channels carry different field sets, and that is the schema's doing,
 * not a UI simplification. On a `models` entry the Models page already edits
 * identity and capacity (`name`, `contextWindow`, `maxTokens`), so only the
 * three advanced fields appear here. A `modelOverrides` entry has no other
 * editor at all, so all six fields appear — leaving them out would make the
 * finest level the schema offers unreachable.
 *
 * The per-model compat grid is filtered by the model's protocol: a field the
 * protocol does not read is a hard error at model level where it is only
 * ignored at route level.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Button, Input, Pill, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { MANAGED_MODEL_KEYS, MODEL_OVERRIDE_KEYS, THINKING_LEVELS, compatFieldsFor } from '../../shared/capabilities.js'
import type { CatalogListing } from '../../shared/catalog.js'
import {
  buildModelPickerRows,
  catalogFailureOf,
  currentOverrideRow,
  filterModelRows,
  usesModelList,
  type ModelPickerRow,
} from '../../shared/models.js'
import { overrideEntryCount } from '../../shared/summary.js'
import { claimsImageSupport } from '../../shared/vision.js'
import { ChoiceRow, Field, Note, Notice, NumberBox, Row } from '../components/primitives.js'
import { InheritButton } from '../components/visual.js'
import { CompatFieldGrid, withValue } from './CompatibilitySection.js'
import { useRpcQuery } from '../hooks.js'
import { cls } from '../styles.js'
import type { Translate } from '../contract.js'
import type { ProviderModelEntry, ProviderModelOverride, ProviderProfile } from '../../shared/types.js'

/** How many models make a picker long enough to need a filter box. */
const FILTER_AT = 8

/** Render the per-model editor for one provider. */
export function ModelsSection(props: {
  t: Translate
  /** Route id, the key the catalog listing is asked under. */
  providerId: string
  profile: ProviderProfile
  disabled: boolean
  onModelField: (index: number, field: string, value: unknown) => void
  onModelOverrideField: (modelId: string, field: string, value: unknown) => void
}): ReactNode {
  const { t, providerId, profile, disabled, onModelField, onModelOverrideField } = props
  const [filter, setFilter] = useState('')
  const [selectedList, setSelectedList] = useState(0)
  const [selectedOverride, setSelectedOverride] = useState<string | undefined>(undefined)

  const listed = useMemo(
    () => (Array.isArray(profile.models) ? profile.models : []),
    [profile.models],
  )
  // A non-empty list replaces the catalog, so the override channel is only
  // meaningful — and only legal in Harness — when there is none.
  const listMode = usesModelList(profile)

  // The id is the dict key, so the editor cannot be drawn without the catalog's
  // own model list. It is host-only state: the installed catalog merged with
  // every configuration layer.
  const catalog = useRpcQuery<CatalogListing>('catalog-models', { providerId }, !listMode)

  const rows = useMemo<ModelPickerRow[]>(
    () => buildModelPickerRows(profile, listMode ? [] : catalog.data?.models ?? []),
    [profile, listMode, catalog.data],
  )
  const visible = useMemo(() => filterModelRows(rows, filter), [rows, filter])

  if (rows.length === 0) {
    return (
      <div className={cls.section}>
        <EmptyCatalog t={t} state={catalog} />
      </div>
    )
  }

  // A filter that hides the current selection must not hide the editor with it:
  // both modes fall back to a row rather than to nothing.
  const current = (listMode
    ? rows[Math.min(selectedList, rows.length - 1)]
    : currentOverrideRow(rows, selectedOverride)) as ModelPickerRow

  return (
    <div className={cls.section}>
      <div className={cls.modelPicker}>
        {rows.length > FILTER_AT ? (
          <div className={cls.fieldRow}>
            <Input
              className={`${cls.mono} ${cls.input}`}
              value={filter}
              placeholder={t('models.filter')}
              aria-label={t('models.filter')}
              spellCheck={false}
              onChange={(event) => { setFilter(event.currentTarget.value) }}
            />
            <Tag tone="neutral">{visible.length} / {rows.length}</Tag>
          </div>
        ) : null}

        {listMode ? null : <Note>{t('models.catalogDesc')}</Note>}
        {listMode ? null : <CatalogState t={t} state={catalog} />}

        <div className={cls.pickerList} role="radiogroup" aria-label={t('models.pick')}>
          {visible.length === 0 ? (
            <p className={cls.hint}>{t('models.noneMatch')}</p>
          ) : null}
          {visible.map((row) => {
            const active = listMode
              ? row.index === current.index
              : row.id === current.id
            return (
              <Pill
                key={row.key}
                role="radio"
                aria-checked={active}
                active={active}
                title={[
                  row.id,
                  row.overrides > 0 ? t('models.hasOverrides', { count: row.overrides }) : '',
                ].filter((part) => part !== '').join(' · ')}
                onClick={() => {
                  if (listMode) setSelectedList(row.index)
                  else setSelectedOverride(row.id)
                }}
              >
                <span className={cls.pickerName}>{row.id}</span>
                {claimsImageSupport(row.declaredInput) ? (
                  <span className={cls.pickerMark} data-image="true">{t('models.imageMark')}</span>
                ) : null}
                {row.overrides > 0 ? <span className={cls.pickerDot} /> : null}
              </Pill>
            )
          })}
        </div>
      </div>

      {listMode ? (
        <ListedModelEditor
          // Remounting on selection keeps a typed-but-empty field from carrying
          // over from the previous model.
          key={`model-${String(current.index)}`}
          t={t}
          profile={profile}
          model={listed[current.index] as ProviderModelEntry}
          index={current.index}
          disabled={disabled}
          onModelField={onModelField}
        />
      ) : (
        <OverrideModelEditor
          key={`override-${current.id}`}
          t={t}
          profile={profile}
          modelId={current.id}
          catalogName={current.catalogName}
          catalogInput={current.catalogInput}
          inCatalog={current.inCatalog}
          override={profile.modelOverrides?.[current.id]}
          disabled={disabled}
          onModelOverrideField={onModelOverrideField}
        />
      )}
    </div>
  )
}

/** The catalog listing's own state, said rather than implied by an empty list. */
function CatalogState(props: { t: Translate; state: CatalogQueryState }): ReactNode {
  const { t, state } = props
  if (state.loading) return <Note>{t('models.catalogLoading')}</Note>
  const failure = catalogFailureOf(state)
  if (failure === undefined) return null
  return (
    <Notice tone="warning">
      {t(`models.catalogError.${failure.code}`, failure.detail === undefined ? {} : { detail: failure.detail })}
      {failure.code === 'listing-failed' ? (
        <>
          {' '}
          <Button variant="ghost" size="sm" onClick={() => { state.reload() }}>
            {t('models.catalogRetry')}
          </Button>
        </>
      ) : null}
    </Notice>
  )
}

/** What is shown when there is no model to configure at all. */
function EmptyCatalog(props: { t: Translate; state: CatalogQueryState }): ReactNode {
  const { t, state } = props
  if (state.loading) return <Note>{t('models.catalogLoading')}</Note>
  return (
    <>
      <Note>{t('models.catalogEmpty')}</Note>
      <CatalogState t={t} state={state} />
    </>
  )
}

/** The `catalog-models` query, as this card consumes it. */
interface CatalogQueryState {
  data: CatalogListing | undefined
  loading: boolean
  error: string | undefined
  reload: () => void
}

/** The three fields a `models` entry can carry here, edited in place. */
function ListedModelEditor(props: {
  t: Translate
  profile: ProviderProfile
  model: ProviderModelEntry
  index: number
  disabled: boolean
  onModelField: (index: number, field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, model, index, disabled, onModelField } = props
  const id = model.id ?? `#${String(index)}`

  return (
    <div className={cls.modelEditor}>
      <div className={cls.modelEditorHead}>
        <code className={cls.modelEditorId}>{id}</code>
        <span className={cls.spacer} />
        {MANAGED_MODEL_KEYS.some((field) => model[field] !== undefined) ? (
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

      <ModelInputChoice
        t={t}
        profile={profile}
        value={model.input}
        disabled={disabled}
        onChange={(next) => { onModelField(index, 'input', next) }}
      />

      <ModelEffortsGrid
        t={t}
        efforts={model.reasoningEfforts}
        disabled={disabled}
        onChange={(next) => { onModelField(index, 'reasoningEfforts', next) }}
      />

      <ModelCompatRow
        t={t}
        profile={profile}
        compat={model.compat}
        disabled={disabled}
        onChange={(next) => { onModelField(index, 'compat', next) }}
      />

      <Note>{t('models.listedNote')}</Note>
      <Note>{t('models.providerOnly')}</Note>
    </div>
  )
}

/**
 * The per-model editor for a catalog route: every field a `modelOverrides`
 * entry accepts.
 *
 * Identity and capacity are here, unlike on a listed model, because nothing
 * else edits this channel — the Models page has no `modelOverrides` seat.
 */
function OverrideModelEditor(props: {
  t: Translate
  profile: ProviderProfile
  modelId: string
  catalogName: string | undefined
  /** Modalities the CATALOG declares for this model, for the inherit hint. */
  catalogInput: readonly string[] | undefined
  inCatalog: boolean
  override: ProviderModelOverride | undefined
  disabled: boolean
  onModelOverrideField: (modelId: string, field: string, value: unknown) => void
}): ReactNode {
  const { t, profile, modelId, catalogName, catalogInput, inCatalog, override, disabled, onModelOverrideField } = props
  const set = (field: string, value: unknown): void => { onModelOverrideField(modelId, field, value) }
  const count = overrideEntryCount(override)

  return (
    <div className={cls.modelEditor}>
      <div className={cls.modelEditorHead}>
        <code className={cls.modelEditorId}>{modelId}</code>
        <span className={cls.spacer} />
        {count > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              for (const field of MODEL_OVERRIDE_KEYS) set(field, undefined)
            }}
          >
            {t('models.clearOverrides')}
          </Button>
        ) : null}
      </div>

      {inCatalog ? null : <Notice tone="warning">{t('models.unknownInCatalog')}</Notice>}

      <Row
        label={t('models.name')}
        fieldKey="name"
        note={override?.name === undefined ? t('models.nameFallback') : t('models.nameDesc')}
        overridden={override?.name !== undefined}
      >
        <Input
          className={`${cls.mono} ${cls.input}`}
          value={override?.name ?? ''}
          placeholder={catalogName ?? ''}
          aria-label={t('models.name')}
          disabled={disabled}
          spellCheck={false}
          onChange={(event) => {
            const raw = event.currentTarget.value
            set('name', raw.length === 0 ? undefined : raw)
          }}
        />
        <InheritButton
          t={t}
          overridden={override?.name !== undefined}
          disabled={disabled}
          onInherit={() => { set('name', undefined) }}
        />
      </Row>

      <CapacityRow
        t={t}
        label={t('models.contextWindow')}
        fieldKey="contextWindow"
        value={override?.contextWindow}
        disabled={disabled}
        onChange={(next) => { set('contextWindow', next) }}
      />

      <CapacityRow
        t={t}
        label={t('models.maxTokens')}
        fieldKey="maxTokens"
        value={override?.maxTokens}
        disabled={disabled}
        onChange={(next) => { set('maxTokens', next) }}
      />

      <ModelInputChoice
        t={t}
        profile={profile}
        value={override?.input}
        catalogInput={catalogInput}
        disabled={disabled}
        onChange={(next) => { set('input', next) }}
      />

      <ModelEffortsGrid
        t={t}
        efforts={override?.reasoningEfforts}
        disabled={disabled}
        onChange={(next) => { set('reasoningEfforts', next) }}
      />

      <ModelCompatRow
        t={t}
        profile={profile}
        compat={override?.compat}
        disabled={disabled}
        onChange={(next) => { set('compat', next) }}
      />

      <Note>{t('models.overrideNote')}</Note>
      <Note>{t('models.providerOnly')}</Note>
    </div>
  )
}

/** One capacity field of an override entry. */
function CapacityRow(props: {
  t: Translate
  label: string
  fieldKey: string
  value: number | undefined
  disabled: boolean
  onChange: (next: number | undefined) => void
}): ReactNode {
  const { t, label, fieldKey, value, disabled, onChange } = props
  return (
    <Row
      label={label}
      fieldKey={fieldKey}
      note={value === undefined ? t('models.capacityFallback') : t('models.capacityOverridden')}
      overridden={value !== undefined}
    >
      <NumberBox
        value={value}
        unit={t('unit.tokens')}
        ariaLabel={label}
        disabled={disabled}
        parse={parseCapacity}
        onChange={onChange}
      />
      <InheritButton
        t={t}
        overridden={value !== undefined}
        disabled={disabled}
        onInherit={() => { onChange(undefined) }}
      />
    </Row>
  )
}

/** Accept only what the schema accepts: a positive whole token count. */
function parseCapacity(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : undefined
}

/** The per-model input-modality choice, shared by both channels. */
function ModelInputChoice(props: {
  t: Translate
  profile: ProviderProfile
  value: readonly string[] | undefined
  /**
   * Modalities the catalog declares for this model, when the override channel
   * knows them. Naming the value it falls back to is the whole point of the
   * inherit hint: "along the catalog" without saying what is not an answer.
   */
  catalogInput?: readonly string[] | undefined
  disabled: boolean
  onChange: (next: readonly string[] | undefined) => void
}): ReactNode {
  const { t, profile, value, catalogInput, disabled, onChange } = props

  const note = value !== undefined
    ? t('models.inputOverridesCatalog')
    : catalogInput !== undefined
      ? t('models.inheritsCatalogValue', {
        value: claimsImageSupport(catalogInput) ? t('vision.textImage') : t('vision.textOnly'),
      })
      : profile.defaultInput === undefined || profile.defaultInput.length === 0
        ? t('models.inheritsCatalog')
        : t('models.inheritsDefault', {
          value: claimsImageSupport(profile.defaultInput) ? t('vision.textImage') : t('vision.textOnly'),
        })

  return (
    <ChoiceRow
      label={t('models.inputTitle')}
      note={note}
      value={inputChoiceOf(value)}
      overridden={value !== undefined}
      disabled={disabled}
      options={[
        { value: 'inherit', label: t('common.inherit'), title: t('common.inheritHint') },
        { value: 'text', label: t('vision.textOnly') },
        { value: 'text-image', label: t('vision.textImage') },
      ]}
      onChange={(next) => {
        onChange(next === 'inherit' ? undefined : next === 'text' ? ['text'] : ['text', 'image'])
      }}
    />
  )
}

/** The level → wire-value grid, shared by both channels. */
function ModelEffortsGrid(props: {
  t: Translate
  efforts: false | Record<string, string | null> | undefined
  disabled: boolean
  onChange: (next: false | Record<string, string | null> | undefined) => void
}): ReactNode {
  const { t, efforts, disabled, onChange } = props
  const mapping = efforts === false || efforts === undefined ? {} : efforts

  const setEffort = (level: string, raw: string): void => {
    const next = { ...(mapping as Record<string, string | null>) }
    // Blank clears the level: DSH pins an undeclared level to null, which means
    // "this model does not support it".
    if (raw === '') delete next[level]
    else next[level] = raw
    onChange(Object.keys(next).length === 0 ? undefined : next)
  }

  // `off` is the one level the schema lets map to null: DSH then keeps it
  // selectable while sending no thinking parameter. The wire input cannot
  // express that state (blank means unsupported), so a switch carries it.
  const setOffNullable = (nullable: boolean): void => {
    const next = { ...(mapping as Record<string, string | null>) }
    if (nullable) next.off = null
    else delete next.off
    onChange(Object.keys(next).length === 0 ? undefined : next)
  }

  return (
    <Row label={t('reasoning.levelsTitle')} note={t('reasoning.levelsDesc')} wide>
      {efforts === false ? (
        <>
          <Note>{t('reasoning.effortsDisabled')}</Note>
          <InheritButton
            t={t}
            overridden
            disabled={disabled}
            onInherit={() => { onChange(undefined) }}
          />
        </>
      ) : (
        <>
          <div className={cls.grid}>
            {THINKING_LEVELS.map((level) => {
              const wire = (mapping as Record<string, string | null>)[level]
              return (
                <Field key={level} label={t(`level.${level}.label`)}>
                  <Input
                    className={`${cls.mono} ${cls.input}`}
                    value={wire === null || wire === undefined ? '' : wire}
                    placeholder={wire === null ? t('reasoning.offSendsNothing') : t('reasoning.unsupported')}
                    aria-label={`${level} ${t('reasoning.wireValue')}`}
                    disabled={disabled}
                    spellCheck={false}
                    onChange={(event) => { setEffort(level, event.currentTarget.value) }}
                  />
                  {level === 'off' ? (
                    <Switch
                      checked={wire === null}
                      disabled={disabled}
                      label={t('reasoning.offNullable')}
                      title={t('reasoning.offNullableHint')}
                      onChange={setOffNullable}
                    />
                  ) : null}
                </Field>
              )
            })}
          </div>
          {/*
            `false` is a per-model state with no provider-level equivalent and no
            other editor anywhere, so leaving it unreachable would keep one legal
            value of the finest level unsettable. The reverse direction goes
            through Inherit rather than through a seeded mapping: this plugin does
            not invent a wire value for a level the user has not declared.
          */}
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            title={t('reasoning.effortsDisabled')}
            onClick={() => { onChange(false) }}
          >
            {t('reasoning.setDisabled')}
          </Button>
        </>
      )}
    </Row>
  )
}

/** The per-model compat grid, filtered to the route's protocol. */
function ModelCompatRow(props: {
  t: Translate
  profile: ProviderProfile
  compat: Record<string, unknown> | undefined
  disabled: boolean
  onChange: (next: Record<string, unknown> | undefined) => void
}): ReactNode {
  const { t, profile, compat, disabled, onChange } = props
  const fields = compatFieldsFor(profile.api)
  if (fields.length === 0) return null
  return (
    <Row label={t('compat.modelTitle')} note={t('compat.modelDesc')} wide>
      <CompatFieldGrid
        t={t}
        fields={fields}
        values={compat ?? {}}
        disabled={disabled}
        inheritedValues={(profile.compat ?? {}) as Record<string, unknown>}
        inheritedFrom={t('compat.routeLevel')}
        onChange={(key, value) => {
          // `withValue` answers `undefined` once the last key goes, which is the
          // "inherit the route" state — not an empty object.
          onChange(withValue(compat ?? {}, key, value))
        }}
      />
    </Row>
  )
}

/** Map a stored `input` list onto one of the three editor choices. */
function inputChoiceOf(input: readonly string[] | undefined): string {
  if (input === undefined || input.length === 0) return 'inherit'
  return input.includes('image') ? 'text-image' : 'text'
}
