import * as v from 'valibot'

/** A prop of an effect, as the `shaders` library's controls describe it. */
export type ShaderPropControl = { key: string; label: string; group: string; default: unknown } & (
  | { kind: 'range'; min: number; max: number; step: number }
  | { kind: 'color' }
  | { kind: 'select'; options: { label: string; value: string | number }[] }
  | { kind: 'checkbox' }
  | { kind: 'position' }
  | { kind: 'text' }
  /** Gradient stops, shapes, uploads, and the like, edited in the preset's JSON. */
  | { kind: 'other' }
)

/** An effect the `shaders` library draws, with the controls of its props. */
export interface ShaderEffect {
  name: string
  category: string
  description: string
  props: ShaderPropControl[]
}

const label = v.optional(v.string())
const uiTypes = (...types: string[]) =>
  v.union([
    v.picklist(types),
    v.pipe(
      v.array(v.string()),
      v.check((list) => types.includes(list[0] ?? ''))
    )
  ])

const rangeUI = v.object({
  type: uiTypes('range'),
  min: v.number(),
  max: v.number(),
  step: v.optional(v.number()),
  label,
  group: v.optional(v.string())
})
const selectUI = v.object({
  type: uiTypes('select'),
  options: v.array(v.object({ label: v.string(), value: v.union([v.string(), v.number()]) })),
  label,
  group: v.optional(v.string())
})
const plainUI = v.object({
  type: uiTypes('color', 'checkbox', 'position', 'origin', 'text'),
  label,
  group: v.optional(v.string())
})
const propMetadata = v.object({ ui: v.optional(v.unknown()), default: v.optional(v.unknown()) })

/** Words a camel-cased prop name is made of, for a prop without a label. */
const words = (key: string) =>
  key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

function control(key: string, metadata: unknown): ShaderPropControl | null {
  const parsed = v.safeParse(propMetadata, metadata)
  if (!parsed.success) return null
  const { ui } = parsed.output
  const base = { key, default: parsed.output.default }
  const range = v.safeParse(rangeUI, ui)
  if (range.success) {
    const { min, max, step = (max - min) / 100 } = range.output
    return {
      ...base,
      label: range.output.label ?? words(key),
      group: range.output.group ?? '',
      kind: 'range',
      min,
      max,
      step
    }
  }
  const select = v.safeParse(selectUI, ui)
  if (select.success) {
    const { options } = select.output
    return {
      ...base,
      label: select.output.label ?? words(key),
      group: select.output.group ?? '',
      kind: 'select',
      options
    }
  }
  const plain = v.safeParse(plainUI, ui)
  if (plain.success) {
    const [type] = [plain.output.type].flat()
    const kind =
      type === 'origin' ? 'position' : (type as 'color' | 'checkbox' | 'position' | 'text')
    return {
      ...base,
      label: plain.output.label ?? words(key),
      group: plain.output.group ?? '',
      kind
    }
  }
  return { ...base, label: words(key), group: '', kind: 'other' }
}

const registryEntry = v.object({
  name: v.string(),
  category: v.string(),
  description: v.optional(v.string()),
  propsMetadata: v.optional(v.record(v.string(), v.unknown()))
})

let catalog: Promise<ShaderEffect[]> | null = null

/**
 * Every effect the `shaders` library draws, by name. The registry is large, so it is loaded
 * the first time a picker asks for it and kept for the session.
 */
export function loadShaderCatalog(): Promise<ShaderEffect[]> {
  catalog ??= import('shaders/registry').then(({ getAllShaders }) =>
    getAllShaders().flatMap((entry) => {
      const parsed = v.safeParse(registryEntry, entry)
      if (!parsed.success) return []
      const { name, category, description = '', propsMetadata = {} } = parsed.output
      const props = Object.entries(propsMetadata).flatMap(([key, metadata]) => {
        const item = control(key, metadata)
        return item ? [item] : []
      })
      return [{ name, category, description, props }]
    })
  )
  return catalog
}
