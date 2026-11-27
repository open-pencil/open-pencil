import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid, UNSET_GUID } from '@open-pencil/kiwi/fig/guid'
import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'

import {
  exportedStyleReference,
  withColorVariable,
  type SceneNodeToKiwiContext
} from '../export/context'
import { textRunVariableEntries } from '../variable/bindings'
import { textStyleOverrides } from './data-export'

/** The identities a document's records are written with. */
export type TextRunReferenceContext = Pick<
  SceneNodeToKiwiContext,
  'graph' | 'nodeIdToGuid' | 'varIdToGuid' | 'styleNodeIds' | 'styleReferences'
>

function applyRunReferences(
  context: TextRunReferenceContext,
  override: NodeChange,
  style: CharacterStyleOverride
): void {
  const guid = (id: string) => context.nodeIdToGuid?.get(id) ?? stringToGuid(id)
  const link = style.hyperlink
  if (link)
    override.hyperlink = link.type === 'URL' ? { url: link.value } : { guid: guid(link.value) }
  // The unset GUID writes a range that leaves the text's style.
  if (style.textStyleId !== undefined) {
    override.styleIdForText = style.textStyleId
      ? exportedStyleReference(context, style.textStyleId)
      : { guid: { ...UNSET_GUID } }
  }
  if (style.fillStyleId !== undefined) {
    override.styleIdForFill = style.fillStyleId
      ? exportedStyleReference(context, style.fillStyleId)
      : { guid: { ...UNSET_GUID } }
  }
  const entries = textRunVariableEntries(
    style.boundVariables ?? {},
    context.graph,
    context.varIdToGuid
  )
  // Figma writes a range's text bindings as parameters, and its paints' on the paints.
  if (entries.length > 0) override.parameterConsumptionMap = { entries }
  if (override.fillPaints) {
    override.fillPaints = override.fillPaints.map((paint, index) =>
      withColorVariable(context, paint, style.boundVariables?.[`fills/${index}/color`])
    )
  }
}

/**
 * Writes what each range of a text refers to into its style override: its link, the styles it
 * uses in place of the text's, and its bindings, all of which name other records.
 */
export function applyTextRunReferences(
  context: TextRunReferenceContext,
  node: SceneNode,
  textData: NonNullable<NodeChange['textData']>
): void {
  const table = textData.styleOverrideTable
  if (!table) return
  const styles = new Map(textStyleOverrides(node).map(({ id, style }) => [id, style]))
  for (const override of table) {
    const style = styles.get(override.styleID as number)
    if (style) applyRunReferences(context, override, style)
  }
}
