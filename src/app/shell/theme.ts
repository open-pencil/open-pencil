import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import { computed, watch } from 'vue'

import { getActiveEditorStore } from '@/app/editor/active-store'
import { IS_BROWSER } from '@open-pencil/core/constants'

import type { RulerTheme } from '@open-pencil/core/canvas'

export type AppTheme = 'dark' | 'light' | 'auto'

const THEME_STORAGE_KEY = 'open-pencil:theme'
const DEFAULT_THEME: AppTheme = 'dark'

const theme = useLocalStorage<AppTheme>(THEME_STORAGE_KEY, DEFAULT_THEME)
const prefersDark = usePreferredDark()
const resolvedTheme = computed<'dark' | 'light'>(() => {
  if (theme.value === 'auto') return prefersDark.value ? 'dark' : 'light'
  return theme.value
})

function cssColorToRgba(value: string) {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!match) return { r: 0, g: 0, b: 0, a: 1 }
  return {
    r: Number(match[1]) / 255,
    g: Number(match[2]) / 255,
    b: Number(match[3]) / 255,
    a: match[4] ? Number(match[4]) : 1
  }
}

function readRulerTheme(): RulerTheme | null {
  if (!IS_BROWSER) return null
  const style = getComputedStyle(document.documentElement)
  return {
    background: cssColorToRgba(style.getPropertyValue('--color-ruler-bg')),
    tick: cssColorToRgba(style.getPropertyValue('--color-ruler-tick')),
    text: cssColorToRgba(style.getPropertyValue('--color-ruler-text')),
    label: cssColorToRgba(style.getPropertyValue('--color-ruler-label'))
  }
}

function updateCanvasTheme(): void {
  if (!IS_BROWSER) return
  try {
    const store = getActiveEditorStore()
    store.state.rulerTheme = readRulerTheme() ?? undefined
    store.requestRepaint()
  } catch (error) {
    if (import.meta.env.DEV)
      console.debug('Canvas theme update skipped before editor initialization', error)
  }
}

function applyTheme(value: 'dark' | 'light', setting: AppTheme): void {
  if (!IS_BROWSER) return
  document.documentElement.dataset.theme = value
  document.documentElement.dataset.themeSetting = setting
  document.documentElement.style.colorScheme = value
  updateCanvasTheme()
}

export function useAppTheme() {
  watch([resolvedTheme, theme], ([value, setting]) => applyTheme(value, setting), {
    immediate: true
  })

  const isLight = computed(() => resolvedTheme.value === 'light')

  function setTheme(value: AppTheme): void {
    theme.value = value
  }

  function toggleTheme(): void {
    theme.value = isLight.value ? 'dark' : 'light'
  }

  return { theme, resolvedTheme, isLight, setTheme, toggleTheme }
}

applyTheme(resolvedTheme.value, theme.value)
