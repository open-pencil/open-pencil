import { computedAsync } from '@vueuse/core'
import { watch, type Ref } from 'vue'

import { tokenStylesheet } from '@open-pencil/dom-css/export'

import { useEditor } from '#vue/editor/context'

/**
 * The document's variables as custom properties, which islands' `var()` references read in the
 * modes their layers set. Built once for every island while `live` holds; an island is a shadow
 * root, so the stylesheet's `:root` is its host.
 */
export function useIslandTokens(live: Readonly<Ref<boolean>>): CSSStyleSheet {
  const editor = useEditor()
  const tokens = new CSSStyleSheet()
  const css = computedAsync(async () => {
    void editor.state.sceneVersion
    if (!live.value) return ''
    const { css: text } = await tokenStylesheet(editor.graph, { format: 'css' })
    return text.replaceAll(':root', ':host')
  }, '')
  watch(css, (text) => tokens.replaceSync(text), { immediate: true })
  return tokens
}
