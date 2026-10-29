import { uniq } from 'es-toolkit'
import { computed, onScopeDispose, ref, watch, type ComputedRef } from 'vue'

import { faceStyleName, fontManager, textStyleName } from '@open-pencil/core/text'
import type { SceneNode } from '@open-pencil/scene-graph'

import { TYPOGRAPHY_WEIGHTS } from '#vue/controls/typography/weights'

/**
 * The faces of the selected text layers' families, read as they arrive. A family whose faces are
 * not known yet, or cannot be, offers every weight, as Figma shows a generic style list for a
 * family it cannot read.
 */
export function useFamilyFaces(nodes: ComputedRef<SceneNode[]>) {
  // Bumped when a family's faces arrive, so the lists that read them follow.
  const arrived = ref(0)
  const families = computed(() => uniq(nodes.value.map((node) => node.fontFamily)))
  function request(current: readonly string[]) {
    for (const family of current) {
      if (fontManager.loadedFamilyFaces(family) !== undefined) continue
      void fontManager.familyFaces(family).then(() => arrived.value++)
    }
  }
  watch(families, request, { immediate: true })
  // The host's font catalog can arrive after a first lookup; ask again with it.
  onScopeDispose(
    fontManager.onFamilyFacesReset(() => {
      arrived.value++
      request(families.value)
    })
  )

  /** Whether a layer's family has this face, or nothing says it has not. */
  function supports(node: SceneNode, weight: number, italic: boolean): boolean {
    void arrived.value
    return fontManager.offersFace(node.fontFamily, weight, italic)
  }

  /**
   * The weights every selected layer's family has at that layer's slant, and the weights the
   * layers already use, so the field still names one their family lacks. Each is named as the
   * first layer's font names that face, as Figma's style menu lists a family's own names.
   */
  const weights = computed(() => {
    void arrived.value
    const first = nodes.value.at(0)
    return TYPOGRAPHY_WEIGHTS.filter(
      ({ value }) =>
        nodes.value.some((node) => node.fontWeight === value) ||
        nodes.value.every((node) => supports(node, value, node.italic))
    ).map(({ value, label }) => ({
      value,
      label: first ? weightName(first, value) : label
    }))
  })

  /** A weight's name in a layer's family; its own weight keeps the name the layer has for it. */
  function weightName(node: SceneNode, weight: number): string {
    if (weight === node.fontWeight) return textStyleName(node)
    return faceStyleName(node.fontFamily, weight, node.italic)
  }

  /** The name of the face a layer is set in, as its font names it once its faces arrive. */
  function styleName(node: SceneNode): string {
    void arrived.value
    return textStyleName(node)
  }

  return { weights, supports, styleName }
}
