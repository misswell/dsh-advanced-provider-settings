/**
 * Draft state for one provider's advanced configuration.
 *
 * The draft is `null` while nothing has been edited, and the committed value
 * flows straight through — there is no shadow copy to keep in sync. The first
 * edit materializes a draft, and only then can the committed value stop being
 * adopted. That removes the usual class of bug where an incoming settings
 * change is either swallowed (the user loses their edit) or applied (the user
 * loses their edit to someone else's write) with no way to tell which.
 */
import { useCallback, useMemo, useState } from 'react'
import { diffManagedProviderConfig, diffManagedProviderFields, resetAllAdvanced, resetProviderFields } from '../shared/patch.js'
import type { AdvancedSectionId } from '../shared/summary.js'
import type { ProviderModelEntry, ProviderProfile, SettingsPathOp } from '../shared/types.js'
import type { SettingsScopeLike, SettingsSnapshotLike } from './contract.js'
import { useSettingsSnapshot } from './hooks.js'

/** Outcome of a save attempt. */
export type SaveOutcome = 'saved' | 'noop' | 'conflict' | 'rejected' | 'unavailable'

/** The editing surface one provider card needs. */
export interface ProviderDraft {
  /** Committed profile, as the settings document resolves it. */
  committed: ProviderProfile
  /** Profile with the user's edits applied, or the committed one when clean. */
  draft: ProviderProfile
  /** Whether the user has edited anything not yet written. */
  dirty: boolean
  /** Whether the namespace accepts writes at all. */
  writable: boolean
  /** Load state of the namespace. */
  status: SettingsSnapshotLike<unknown>['status']
  /** Replace one provider-level field. */
  setField: (field: string, value: unknown) => void
  /** Replace one field on one model. */
  setModelField: (index: number, field: string, value: unknown) => void
  /** Drop every managed field in the named sections, or all of them. */
  reset: (sections?: readonly AdvancedSectionId[]) => void
  /** Throw away local edits. */
  discard: () => void
  /** Write the diff, fenced by the revision the edit was based on. */
  save: () => Promise<SaveOutcome>
  /** Wholesale replace the draft, used by the migration importer and tests. */
  replace: (next: ProviderProfile) => void
}

/**
 * Build the draft surface for one provider.
 *
 * @param scope - the bound `llm-pi-ai` scope, or undefined when unavailable.
 * @param providerId - the route id this card edits.
 * @returns the draft surface.
 */
export function useProviderDraft(
  scope: SettingsScopeLike<{ providers?: Record<string, ProviderProfile> }> | undefined,
  providerId: string,
): ProviderDraft {
  const snapshot = useSettingsSnapshot(scope)
  const committed = useMemo<ProviderProfile>(
    () => snapshot.value?.providers?.[providerId] ?? {},
    [snapshot, providerId],
  )

  const [patch, setPatch] = useState<ProviderProfile | null>(null)
  const draft = patch ?? committed
  const dirty = patch !== null

  const setField = useCallback((field: string, value: unknown): void => {
    setPatch((previous) => {
      const base = previous ?? committed
      const next = { ...base }
      if (value === undefined) delete next[field]
      else next[field] = value
      return next
    })
  }, [committed])

  const setModelField = useCallback((index: number, field: string, value: unknown): void => {
    setPatch((previous) => {
      const base = previous ?? committed
      const models: ProviderModelEntry[] = Array.isArray(base.models) ? [...base.models] : []
      const existing = models[index]
      // A model's `id` is required and owned by the Models page; an edit to a
      // model index that has no row yet is a no-op rather than a new model.
      if (existing === undefined) return base
      const model: Record<string, unknown> = { ...existing }
      if (value === undefined) delete model[field]
      else model[field] = value
      models[index] = model as unknown as ProviderModelEntry
      return { ...base, models }
    })
  }, [committed])

  const reset = useCallback((sections?: readonly AdvancedSectionId[]): void => {
    setPatch((previous) => {
      const base = previous ?? committed
      const ops: SettingsPathOp[] = sections === undefined
        ? resetAllAdvanced(providerId, base)
        : resetProviderFields(providerId, base, sections, base.models)
      return applyOpsLocally(base, ops)
    })
  }, [committed, providerId])

  const discard = useCallback((): void => { setPatch(null) }, [])

  const replace = useCallback((next: ProviderProfile): void => { setPatch(next) }, [])

  const save = useCallback(async (): Promise<SaveOutcome> => {
    if (scope === undefined) return 'unavailable'
    if (!dirty) return 'noop'

    // Reload the freshest committed value rather than trusting `committed`:
    // the snapshot may have advanced while the user was typing, and diffing
    // against a stale base would rewrite fields nobody touched.
    const latest = scope.getSnapshot()
    const current = latest.value?.providers?.[providerId] ?? {}
    const ops = diffManagedProviderConfig(providerId, current, draft)
    if (ops.length === 0) {
      setPatch(null)
      return 'noop'
    }

    try {
      await scope.mutate(ops, latest.revision)
      // Keep the draft visible until the snapshot catches up, so the form does
      // not flicker back to the pre-edit value between the write and the read.
      return 'saved'
    } catch (error) {
      const code = errorCodeOf(error)
      if (code === 'SETTINGS_CONFLICT' || code === 'settings/conflict') return 'conflict'
      return 'rejected'
    }
  }, [scope, dirty, draft, providerId])

  return {
    committed,
    draft,
    dirty,
    writable: snapshot.writable,
    status: snapshot.status,
    setField,
    setModelField,
    reset,
    discard,
    save,
    replace,
  }
}

/**
 * Diff one provider without models, for a section-scoped save.
 * @param providerId - route id.
 * @param before - committed profile.
 * @param after - edited profile.
 * @returns provider-level operations.
 */
export function providerSectionOps(
  providerId: string,
  before: ProviderProfile,
  after: ProviderProfile,
): SettingsPathOp[] {
  return diffManagedProviderFields(providerId, before, after)
}

/**
 * Apply operations to a detached copy, so the draft mirrors what a save would
 * produce. Kept here rather than imported from the host half: the browser
 * bundle must not pull in host modules.
 */
function applyOpsLocally(profile: ProviderProfile, ops: readonly SettingsPathOp[]): ProviderProfile {
  const next = structuredClone(profile) as Record<string, unknown>
  for (const op of ops) {
    const rest = op.path.slice(2) // drop ['providers', providerId]
    if (op.op === 'unset') deleteIn(next, rest)
    else setIn(next, rest, op.value)
  }
  return next as ProviderProfile
}

/** Write a value at a relative path, creating containers as needed. */
function setIn(node: Record<string, unknown>, path: readonly string[], value: unknown): void {
  const key = path[0]
  if (key === undefined) return
  if (path.length === 1) {
    node[key] = value
    return
  }
  const child = node[key]
  if (child === null || typeof child !== 'object') {
    node[key] = /^\d+$/.test(path[1] ?? '') ? [] : {}
  }
  setIn(node[key] as Record<string, unknown>, path.slice(1), value)
}

/** Delete a value at a relative path, tolerating an absent path. */
function deleteIn(node: Record<string, unknown>, path: readonly string[]): void {
  const key = path[0]
  if (key === undefined) return
  if (path.length === 1) {
    delete node[key]
    return
  }
  const child = node[key]
  if (child === null || typeof child !== 'object') return
  deleteIn(child as Record<string, unknown>, path.slice(1))
}

/** Read the error code off anything thrown by the settings transport. */
function errorCodeOf(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}
