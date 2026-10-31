import { uniq, uniqBy } from 'es-toolkit'
import { computed, onScopeDispose, ref, watch, type ComputedRef } from 'vue'

import { fontManager, standardFace, textStyleName } from '@open-pencil/core/text'
import type { SceneNode } from '@open-pencil/scene-graph'
import { styleSpelling } from '@open-pencil/scene-graph/font-style'

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
   * Whether a layer's family has a face of this name in the layer's slant, which choosing it
   * keeps, or nothing says it has not.
   */
  function offersStyle(node: SceneNode, style: string): boolean {
    const faces = fontManager.loadedFamilyFaces(node.fontFamily)
    return (
      !faces ||
      faces.some(
        (face) => face.italic === node.italic && styleSpelling(face.style) === styleSpelling(style)
      )
    )
  }

  /**
   * The faces of the first layer's family in its slant, lightest first, by the names its fonts
   * give them, as Figma's style menu lists a family's faces ("Book" and "Roman" apart), and only
   * those every selected layer's family has. A family whose faces are unknown offers every
   * standard weight. The faces the layers are set in stay listed, by the layers' own names, so
   * the field still names one their family lacks or a file spells its own way.
   */
  // Each option's value is the face's name, which is also what choosing it sets.
  const faces = computed(() => {
    void arrived.value
    const first = nodes.value.at(0)
    if (!first) return []
    const known =
      fontManager.loadedFamilyFaces(first.fontFamily) ??
      TYPOGRAPHY_WEIGHTS.map(({ value }) => standardFace(value, first.italic))
    const listed = known
      .filter((face) => face.italic === first.italic)
      .toSorted((a, b) => a.weight - b.weight)
      .map((face) => face.style)
      .filter((style) => nodes.value.every((node) => offersStyle(node, style)))
    const own = nodes.value.map((node) => textStyleName(node))
    const names = uniqBy(
      [...listed, ...own].map(
        (style) => own.find((name) => styleSpelling(name) === styleSpelling(style)) ?? style
      ),
      styleSpelling
    )
    return names.map((style) => ({ value: style, label: style }))
  })

  /** The name of the face a layer is set in, as its font names it once its faces arrive. */
  function styleName(node: SceneNode): string {
    void arrived.value
    return textStyleName(node)
  }

  return { faces, supports, styleName }
}
