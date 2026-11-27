import type { StyleRun } from '../types'

/** What a text's runs refer to outside the text: the variables they bind and the styles they use. */
export interface StyleRunReferences {
  variables: string[]
  styles: string[]
}

/** The variables and styles a text's runs refer to, which copies and transfers carry with it. */
export function styleRunReferences(runs: readonly StyleRun[]): StyleRunReferences {
  const variables = new Set<string>()
  const styles = new Set<string>()
  for (const { style } of runs) {
    for (const id of Object.values(style.boundVariables ?? {})) if (id) variables.add(id)
    if (style.textStyleId) styles.add(style.textStyleId)
    if (style.fillStyleId) styles.add(style.fillStyleId)
  }
  return { variables: [...variables], styles: [...styles] }
}

/**
 * Runs whose variables, styles, and linked layers are renamed, as a copy into another document
 * renames them. Layers are renamed only when given, since a link may name a layer left behind.
 */
export function remapStyleRunReferences(
  runs: readonly StyleRun[],
  rename: {
    variable: (id: string) => string
    style: (id: string) => string
    node?: (id: string) => string
  }
): StyleRun[] {
  return runs.map((run) => {
    const { boundVariables, textStyleId, fillStyleId, hyperlink } = run.style
    const linksLayer = hyperlink?.type === 'NODE' && rename.node !== undefined
    if (!boundVariables && !textStyleId && !fillStyleId && !linksLayer) return run
    const style = { ...run.style }
    if (hyperlink?.type === 'NODE' && rename.node) {
      style.hyperlink = { type: 'NODE', value: rename.node(hyperlink.value) }
    }
    if (boundVariables) {
      style.boundVariables = Object.fromEntries(
        Object.entries(boundVariables).map(([field, id]) => [field, rename.variable(id)])
      )
    }
    if (textStyleId) style.textStyleId = rename.style(textStyleId)
    if (fillStyleId) style.fillStyleId = rename.style(fillStyleId)
    return { ...run, style }
  })
}
