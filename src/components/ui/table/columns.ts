/**
 * What a column says about its own look, in its TanStack `meta`: classes for its header and cells,
 * such as a width, an alignment, or hiding below a table width.
 */
export type TableColumnMeta = {
  class?: string
  /** A column of row actions: its header is read out but not shown, and it has no placeholder. */
  actions?: boolean
}

/** A column's meta as `TableColumnMeta`, whatever features its table was made with. */
export function tableColumnMeta(meta: unknown): TableColumnMeta {
  if (typeof meta !== 'object' || meta === null) return {}
  return {
    class: 'class' in meta && typeof meta.class === 'string' ? meta.class : undefined,
    actions: 'actions' in meta && meta.actions === true
  }
}
