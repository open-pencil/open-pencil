import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/core'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-rulers')

const CARD = { x: 80, y: 120, width: 320, height: 200 }
/** Where the Close button's marker sits at zoom 1: just outside its top-right corner. */
const CLOSE_BUTTON = { x: 340, y: 140, width: 24, height: 24 }
const CLOSE_MARKER = { x: CARD.x + 364 + 12, y: CARD.y + 140 - 12 }

interface Scene {
  captionId: string
  closeId: string
  swatchId: string
}

function buildScene(page: Page): Promise<Scene> {
  return page.evaluate(
    ({ card, close }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.state.zoom = 1
      store.state.panX = 0
      store.state.panY = 0
      const pageId = store.state.currentPageId
      const white = { r: 1, g: 1, b: 1, a: 1 }
      const brand = { r: 0.23, g: 0.51, b: 0.96, a: 1 }
      store.graph.addCollection({
        id: 'check-colors',
        name: 'Colors',
        modes: [{ modeId: 'light', name: 'Light' }],
        defaultModeId: 'light',
        variableIds: []
      })
      store.graph.addVariable({
        id: 'check-brand',
        name: 'Colors/Brand/500',
        type: 'COLOR',
        collectionId: 'check-colors',
        valuesByMode: { light: brand },
        description: '',
        hiddenFromPublishing: false
      })
      const frame = store.graph.createNode('FRAME', pageId, {
        name: 'Card',
        ...card,
        fills: [{ type: 'SOLID', color: white, visible: true, opacity: 1 }]
      })
      const caption = store.graph.createNode('TEXT', frame.id, {
        name: 'Caption',
        x: 24,
        y: 24,
        width: 200,
        height: 24,
        text: 'Pale caption',
        fontSize: 16,
        fills: [
          { type: 'SOLID', color: { r: 0.82, g: 0.82, b: 0.82, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      const swatch = store.graph.createNode('RECTANGLE', frame.id, {
        name: 'Swatch',
        x: 24,
        y: 80,
        width: 96,
        height: 64,
        fills: [{ type: 'SOLID', color: brand, visible: true, opacity: 1 }]
      })
      const closeButton = store.graph.createNode('FRAME', frame.id, {
        name: 'Close button',
        ...close,
        fills: [{ type: 'SOLID', color: white, visible: true, opacity: 1 }]
      })
      store.clearSelection()
      store.requestRender()
      return { captionId: caption.id, closeId: closeButton.id, swatchId: swatch.id }
    },
    { card: CARD, close: CLOSE_BUTTON }
  )
}

function checkPanel(page: Page) {
  return page.getByRole('region', { name: 'Check' })
}

async function openCheck(page: Page) {
  await page.getByRole('tab', { name: /^Check/ }).click()
  await expect(checkPanel(page).getByText('Low text contrast')).toBeVisible()
}

function highlightedNode(page: Page) {
  return page.evaluate(
    () => window.openPencil?.getStore?.().state.designIssues?.highlight?.nodeId ?? null
  )
}

/** Checks settle shortly after edits; markers exist once the check has published them. */
async function waitForMarkers(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => window.openPencil?.getStore?.().state.designIssues?.markers.length ?? 0)
    )
    .toBeGreaterThan(0)
  await page.evaluate(() => new Promise(requestAnimationFrame))
}

/**
 * Markers are drawn a frame after the check publishes them, so the pointer keeps moving over the
 * marker, as a person's would, until the canvas reports it under the pointer.
 */
async function hoverMarker(point: Vector) {
  let nudge = 0
  await expect
    .poll(async () => {
      nudge = nudge === 0 ? 1 : 0
      await editor.canvas.hover(point.x + nudge, point.y)
      return editor.page.evaluate(
        () => window.openPencil?.getStore?.().state.designIssues?.hoveredMarkerKey ?? null
      )
    })
    .not.toBeNull()
}

function selectedIds(page: Page) {
  return page.evaluate(() => [...(window.openPencil?.getStore?.().state.selectedIds ?? [])])
}

test.afterEach(async () => {
  await editor.page.getByRole('tab', { name: 'Design' }).click()
})

test('Check lists issues by rule and connects rows to the canvas', async () => {
  const scene = await buildScene(editor.page)
  await openCheck(editor.page)
  const panel = checkPanel(editor.page)

  await expect(panel.getByText('Small touch target')).toBeVisible()
  await expect(panel.getByText('Unbound color')).toBeVisible()
  const captionRow = panel.locator(`[data-node-id="${scene.captionId}"]`)
  await expect(captionRow).toContainText('Caption')
  await expect(captionRow).toContainText(':1')

  await captionRow.hover()
  await expect.poll(() => highlightedNode(editor.page)).toBe(scene.captionId)

  await captionRow.click()
  await expect.poll(() => selectedIds(editor.page)).toEqual([scene.captionId])
  await expect(captionRow).toHaveAttribute('aria-current', 'true')

  await panel.getByRole('button', { name: 'Rules' }).first().hover()
  await expect.poll(() => highlightedNode(editor.page)).toBeNull()
})

test('Binding a suggested variable resolves the issue and undoes in one step', async () => {
  const scene = await buildScene(editor.page)
  await openCheck(editor.page)
  const panel = checkPanel(editor.page)
  // Suggestions start collapsed; binding tokens is one of them.
  await panel.getByText('Unbound color').click()
  const swatchRow = panel.locator(`[data-node-id="${scene.swatchId}"]`)
  await expect(swatchRow).toContainText('Brand/500')

  await swatchRow.hover()
  await swatchRow.getByRole('button', { name: 'Bind to Colors/Brand/500' }).click()

  await expect(panel.getByText('Unbound color')).toHaveCount(0)
  await expect
    .poll(() =>
      editor.page.evaluate(
        (id) => window.openPencil?.getStore?.().graph.getNode(id)?.boundVariables['fills/0/color'],
        scene.swatchId
      )
    )
    .toBe('check-brand')

  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect(panel.getByText('Unbound color')).toBeVisible()
})

test('A rule can be turned off from its group and turned back on from the rules menu', async () => {
  await buildScene(editor.page)
  await openCheck(editor.page)
  const panel = checkPanel(editor.page)
  const group = panel.locator('[data-rule-id="touch-target-size"]')

  await group.getByText('Small touch target').hover()
  await group.getByRole('button', { name: 'Rules' }).click()
  await editor.page.getByRole('menuitem', { name: 'Turn off rule' }).click()
  await expect(panel.getByText('Small touch target')).toHaveCount(0)

  await panel.getByRole('button', { name: 'Rules' }).first().click()
  await editor.page.getByRole('menuitem', { name: 'Turn on 1 turned-off rules' }).click()
  await expect(panel.getByText('Small touch target')).toBeVisible()
})

test('Canvas markers explain themselves on hover and open Check on click', async () => {
  const scene = await buildScene(editor.page)
  await waitForMarkers(editor.page)

  await hoverMarker(CLOSE_MARKER)
  const tooltip = editor.page.getByTestId('issue-marker-tooltip')
  await expect(tooltip).toContainText('Close button')
  await expect(tooltip).toContainText('Small touch target')
  await expect.poll(() => highlightedNode(editor.page)).toBe(scene.closeId)
  await editor.canvas.waitForRender()
  const canvas = await editor.canvas.canvas.boundingBox()
  if (!canvas) throw new Error('Canvas has no bounding box')
  expect(
    await editor.page.screenshot({
      clip: { x: canvas.x + 60, y: canvas.y + 100, width: 640, height: 260 }
    })
  ).toMatchSnapshot('design-check-marker-hover.png')

  await editor.canvas.click(CLOSE_MARKER.x, CLOSE_MARKER.y)
  await expect(tooltip).toHaveCount(0)
  await expect.poll(() => selectedIds(editor.page)).toEqual([scene.closeId])
  await expect(editor.page.getByRole('tab', { name: /^Check/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(checkPanel(editor.page).locator(`[data-node-id="${scene.closeId}"]`)).toBeVisible()
})

test('Canvas markers can be turned off from the View menu', async () => {
  await buildScene(editor.page)
  await waitForMarkers(editor.page)
  const markerCount = () =>
    editor.page.evaluate(
      () => window.openPencil?.getStore?.().state.designIssues?.markers.length ?? 0
    )

  await editor.page.getByRole('menuitem', { name: 'View' }).click()
  const toggle = editor.page.getByRole('menuitemcheckbox', { name: 'Design issues' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect.poll(markerCount).toBe(0)

  await editor.canvas.hover(CLOSE_MARKER.x + 1, CLOSE_MARKER.y)
  await expect(editor.page.getByTestId('issue-marker-tooltip')).toHaveCount(0)

  await editor.page.getByRole('menuitem', { name: 'View' }).click()
  await editor.page.getByRole('menuitemcheckbox', { name: 'Design issues' }).click()
  await expect.poll(markerCount).toBeGreaterThan(0)
})
