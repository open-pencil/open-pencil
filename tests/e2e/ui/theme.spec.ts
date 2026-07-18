import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test('rulers follow the active theme', async () => {
  const { page } = editor

  const readState = () =>
    page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      const style = getComputedStyle(document.documentElement)
      return {
        cssTheme: document.documentElement.dataset.theme ?? 'dark',
        cssRulerBg: style.getPropertyValue('--color-ruler-bg').trim(),
        storeRulerBg: store?.state.rulerTheme?.background ?? null
      }
    })

  // Baseline: dark theme
  const dark = await readState()
  expect(dark.cssTheme).toBe('dark')

  // Switch to light via the app's theme API (module state, not raw localStorage,
  // so the watcher applies it and pushes the ruler theme to the active editor).
  await page.evaluate(async () => {
    const themeModule = await import('/src/app/shell/theme.ts')
    themeModule.useAppTheme().setTheme('light')
  })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')

  const light = await readState()
  expect(light.cssTheme).toBe('light')
  // Canvas ruler theme must track the light tokens, not stay on the dark fallback.
  expect(light.cssRulerBg).not.toBe(dark.cssRulerBg)
  expect(light.storeRulerBg).not.toBeNull()

  // Restore dark so later specs are unaffected.
  await page.evaluate(async () => {
    const themeModule = await import('/src/app/shell/theme.ts')
    themeModule.useAppTheme().setTheme('dark')
  })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
})
