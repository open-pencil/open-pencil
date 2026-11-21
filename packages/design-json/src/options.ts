import type { DesignJSONOptions } from '#design-json/types'

/** The options with every default filled in, and the field lists as sets. */
export interface ResolvedOptions extends Required<
  Pick<
    DesignJSONOptions,
    | 'depth'
    | 'bytes'
    | 'images'
    | 'worldBounds'
    | 'references'
    | 'computed'
    | 'comments'
    | 'figSchema'
    | 'tokens'
  >
> {
  pick: ReadonlySet<string> | null
  omit: ReadonlySet<string>
  transform: DesignJSONOptions['transform']
}

export function resolveOptions(options: DesignJSONOptions): ResolvedOptions {
  return {
    pick: options.pick ? new Set(options.pick) : null,
    omit: new Set(options.omit),
    depth: options.depth ?? Number.POSITIVE_INFINITY,
    bytes: options.bytes ?? 'base64',
    images: options.images ?? 'data-url',
    worldBounds: options.worldBounds ?? true,
    references: options.references ?? true,
    computed: options.computed ?? true,
    comments: options.comments ?? true,
    figSchema: options.figSchema ?? false,
    tokens: options.tokens ?? true,
    transform: options.transform
  }
}

/** Whether `pick` and `omit` let a layer keep the field. */
export function keepsField(field: string, options: ResolvedOptions): boolean {
  if (options.pick && !options.pick.has(field)) return false
  return !options.omit.has(field)
}
