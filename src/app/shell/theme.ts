import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import { computed, watch } from 'vue'

import type { RulerTheme } from '@open-pencil/core/canvas'
import { IS_BROWSER } from '@open-pencil/core/constants'
import { parseColor } from '@open-pencil/scene-graph/color'

import { getActiveEditorStoreOrNull, useActiveEditorStoreRef } from '@/app/editor/active-store'
import { useAccentPalette } from '@/app/shell/accent'
import { ACCENT_TOKENS, type AccentPalette } from '@/app/shell/accent/palette'

export const APP_THEMES = ['dark', 'light', 'auto'] as const
export type AppTheme = (typeof APP_THEMES)[number]

const THEME_STORAGE_KEY = 'open-pencil:theme'
const DEFAULT_THEME: AppTheme = 'dark'

const theme = useLocalStorage<AppTheme>(THEME_STORAGE_KEY, DEFAULT_THEME)
const prefersDark = usePreferredDark()
/** The theme in effect; a stored value that is not a theme reads as the default dark. */
export const resolvedAppTheme = computed<'dark' | 'light'>(() => {
  if (theme.value === 'auto') return prefersDark.value ? 'dark' : 'light'
  return theme.value === 'light' ? 'light' : 'dark'
})
const accentPalette = useAccentPalette(() => resolvedAppTheme.value)

function readRulerTheme(): RulerTheme | null {
  if (!IS_BROWSER || !('document' in globalThis)) return null
  const style = getComputedStyle(document.documentElement)
  return {
    background: parseColor(style.getPropertyValue('--color-ruler-bg')),
    tick: parseColor(style.getPropertyValue('--color-ruler-tick')),
    text: parseColor(style.getPropertyValue('--color-ruler-text'))
  }
}

function updateCanvasTheme(): void {
  if (!IS_BROWSER) return
  const store = getActiveEditorStoreOrNull()
  if (!store) return
  store.state.rulerTheme = readRulerTheme() ?? undefined
  store.state.theme = resolvedAppTheme.value
  store.state.selectionTheme = accentPalette.value.selection
  store.requestRepaint()
}

export function getAppTheme(): AppTheme {
  return theme.value
}

export function setAppTheme(value: AppTheme): void {
  theme.value = value
}

function applyAccent(palette: AccentPalette): void {
  const style = document.documentElement.style
  for (const token of ACCENT_TOKENS) style.setProperty(token, palette.tokens[token])
}

function applyTheme(value: 'dark' | 'light', setting: AppTheme): void {
  if (!IS_BROWSER || !('document' in globalThis)) return
  document.documentElement.dataset.theme = value
  document.documentElement.dataset.themeSetting = setting
  document.documentElement.style.colorScheme = value
  applyAccent(accentPalette.value)
  updateCanvasTheme()
}

export function useAppTheme() {
  watch(
    [resolvedAppTheme, theme, accentPalette],
    ([value, setting]) => applyTheme(value, setting),
    { immediate: true }
  )

  // Editors may mount after the theme was applied; push the canvas (ruler)
  // theme whenever the active editor changes so rulers always match.
  const activeStoreRef = useActiveEditorStoreRef()
  watch([activeStoreRef, resolvedAppTheme, accentPalette], () => updateCanvasTheme(), {
    flush: 'post'
  })

  const isLight = computed(() => resolvedAppTheme.value === 'light')

  function toggleTheme(): void {
    theme.value = isLight.value ? 'dark' : 'light'
  }

  return { theme, resolvedTheme: resolvedAppTheme, isLight, setTheme: setAppTheme, toggleTheme }
}

applyTheme(resolvedAppTheme.value, theme.value)
