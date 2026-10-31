import type {
  SessionConfigOption,
  SessionModelState,
  SessionModeState
} from '@agentclientprotocol/sdk'
import { ref, shallowRef } from 'vue'

export interface ACPControlOption {
  value: string
  label: string
  description?: string
}

export interface ACPControl {
  /** `config` uses session/set_config_option; model and mode use their dedicated calls. */
  kind: 'config' | 'model' | 'mode'
  id: string
  name: string
  category: 'model' | 'thought_level' | 'mode' | 'other'
  current: string
  options: ACPControlOption[]
  /** Set when one flat model list was split into a model and a reasoning-effort control. */
  split?: 'base' | 'effort'
}

export interface ACPSessionState {
  agentId: string
  controls: ACPControl[]
}

export interface ACPSessionActions {
  setControl(control: ACPControl, value: string): Promise<void>
}

/** Latest catalog reported by the active ACP agent, shown in the composer. */
export const acpState = ref<ACPSessionState | null>(null)
export const acpActions = shallowRef<ACPSessionActions | null>(null)
export const acpConnecting = ref(false)

function categoryOf(option: SessionConfigOption): ACPControl['category'] {
  const c = option.category
  if (c === 'model' || c === 'thought_level' || c === 'mode') return c
  return 'other'
}

const EFFORT_ID = /^(.*)\[([^\]]+)\]$/
const EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']

/** Agents such as Codex list `model[effort]` as separate models; show them as two controls. */
function splitModels(state: SessionModelState): ACPControl[] | null {
  const parsed = state.availableModels.flatMap((m) => {
    const match = EFFORT_ID.exec(m.modelId)
    return match ? [{ m, base: match[1], effort: match[2] }] : []
  })
  if (!parsed.length || parsed.length !== state.availableModels.length) return null
  const bases = new Map<string, string>()
  const efforts = new Set<string>()
  for (const { m, base, effort } of parsed) {
    efforts.add(effort)
    if (!bases.has(base)) {
      bases.set(base, m.name.replace(/\s*\([^()]*\)\s*$/, '') || base)
    }
  }
  const current = EFFORT_ID.exec(state.currentModelId)
  if (!current) return null
  const sorted = [...efforts].sort((a, b) => {
    const rank = (e: string) => {
      const i = EFFORT_ORDER.indexOf(e)
      return i === -1 ? 99 : i
    }
    return rank(a) - rank(b)
  })
  return [
    {
      kind: 'model',
      id: 'model',
      name: 'Model',
      category: 'model',
      current: current[1],
      split: 'base',
      options: [...bases].map(([value, label]) => ({ value, label }))
    },
    {
      kind: 'model',
      id: 'effort',
      name: 'Reasoning',
      category: 'thought_level',
      current: current[2],
      split: 'effort',
      options: sorted.map((value) => ({ value, label: value }))
    }
  ]
}

/** The full model id a split control choice maps to, or null if that pairing does not exist. */
export function resolveSplitModel(
  state: SessionModelState,
  control: ACPControl,
  value: string
): string | null {
  const ids = state.availableModels.map((m) => m.modelId)
  const cur = EFFORT_ID.exec(state.currentModelId)
  if (!cur) return null
  const base = control.split === 'base' ? value : cur[1]
  const effort = control.split === 'effort' ? value : cur[2]
  const exact = `${base}[${effort}]`
  if (ids.includes(exact)) return exact
  return (
    ids.find((id) => id.startsWith(`${base}[medium]`)) ??
    ids.find((id) => id.startsWith(`${base}[`)) ??
    null
  )
}

export function buildControls(input: {
  configOptions?: SessionConfigOption[] | null
  models?: SessionModelState | null
  modes?: SessionModeState | null
}): ACPControl[] {
  const controls: ACPControl[] = []
  for (const o of input.configOptions ?? []) {
    const options: ACPControlOption[] = []
    for (const item of o.options) {
      if ('group' in item) {
        for (const g of item.options) {
          options.push({ value: g.value, label: g.name, description: g.description ?? undefined })
        }
      } else {
        options.push({
          value: item.value,
          label: item.name,
          description: item.description ?? undefined
        })
      }
    }
    controls.push({
      kind: 'config',
      id: o.id,
      name: o.name,
      category: categoryOf(o),
      current: o.currentValue,
      options
    })
  }
  if (!controls.some((c) => c.category === 'model') && input.models?.availableModels.length) {
    const split = splitModels(input.models)
    if (split) controls.push(...split)
    else
      controls.push({
        kind: 'model',
        id: 'model',
        name: 'Model',
        category: 'model',
        current: input.models.currentModelId,
        options: input.models.availableModels.map((m) => ({
          value: m.modelId,
          label: m.name,
          description: m.description ?? undefined
        }))
      })
  }
  if (!controls.some((c) => c.category === 'mode') && input.modes?.availableModes.length) {
    controls.push({
      kind: 'mode',
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      current: input.modes.currentModeId,
      options: input.modes.availableModes.map((m) => ({
        value: m.id,
        label: m.name,
        description: m.description ?? undefined
      }))
    })
  }
  return controls
}
