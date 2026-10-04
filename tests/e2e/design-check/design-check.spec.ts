import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/core'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-rulers')

const CARD = { x: 80, y: 120, width: 320, height: 200 }
/** Where the Close button's marker sits at zoom 1: just outside its top-right corner. */
const CLOSE_BUTTON = { x: 340, y: 140, width: 24, height: 20 }
const CLOSE_MARKER = {
  x: CARD.x + CLOSE_BUTTON.x + CLOSE_BUTTON.width + 12,
  y: CARD.y + CLOSE_BUTTON.y - 12
}

interface Scene {
  cardId: string
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
      return {
        cardId: frame.id,
        captionId: caption.id,
        closeId: closeButton.id,
        swatchId: swatch.id
      }
    },
    { card: CARD, close: CLOSE_BUTTON }
  )
}

function lintPanel(page: Page) {
  return page.getByRole('region', { name: 'Lint' })
}

async function openLint(page: Page) {
  await page.getByRole('tab', { name: /^Lint/ }).click()
  await expect(lintPanel(page).getByText('Low text contrast')).toBeVisible()
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

test('Lint lists issues by rule and connects rows to the canvas', async () => {
  const scene = await buildScene(editor.page)
  await openLint(editor.page)
  const panel = lintPanel(editor.page)

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
  await openLint(editor.page)
  const panel = lintPanel(editor.page)
  // Suggestions start collapsed; binding tokens is one of them.
  await panel.getByText('Unbound color').click()
  const swatchRow = panel.locator(`[data-node-id="${scene.swatchId}"]`)
  await expect(swatchRow).toContainText('Brand/500')

  // The fix is a sibling of the row button, in the same list item.
  const swatchItem = panel
    .getByRole('listitem')
    .filter({ has: editor.page.locator(`[data-node-id="${scene.swatchId}"]`) })
  await swatchItem.hover()
  await swatchItem.getByRole('button', { name: 'Bind to Colors/Brand/500' }).click()

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

test('A suggestion applies to its row only', async () => {
  const scene = await buildScene(editor.page)
  const noteId = await editor.page.evaluate((cardId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.createNode('TEXT', cardId, {
      name: 'Footnote',
      x: 24,
      y: 160,
      width: 200,
      height: 14,
      text: 'Small print',
      fontSize: 10,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    }).id
  }, scene.cardId)
  await openLint(editor.page)
  const panel = lintPanel(editor.page)
  const noteItem = panel
    .getByRole('listitem')
    .filter({ has: editor.page.locator(`[data-node-id="${noteId}"]`) })

  await noteItem.hover()
  await noteItem.getByRole('button', { name: 'Change to 12 px' }).click()

  await expect(panel.getByText('Small text')).toHaveCount(0)
  await expect
    .poll(() =>
      editor.page.evaluate(
        (id) => window.openPencil?.getStore?.().graph.getNode(id)?.fontSize,
        noteId
      )
    )
    .toBe(12)
})

test('A rule can be turned off from its group and turned back on from the rules menu', async () => {
  await buildScene(editor.page)
  await openLint(editor.page)
  const panel = lintPanel(editor.page)
  const group = panel.locator('[data-rule-id="touch-target-size"]')

  await group.getByText('Small touch target').hover()
  await group.getByRole('button', { name: 'Rule actions' }).click()
  await editor.page.getByRole('menuitem', { name: 'Turn off rule' }).click()
  await expect(panel.getByText('Small touch target')).toHaveCount(0)

  await panel.getByRole('button', { name: 'Rules' }).first().click()
  await editor.page.getByRole('menuitem', { name: 'Turn on 1 turned-off rules' }).click()
  await expect(panel.getByText('Small touch target')).toBeVisible()
})

test('Canvas markers explain themselves on hover and open Lint on click', async () => {
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
  await expect(editor.page.getByRole('tab', { name: /^Lint/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(lintPanel(editor.page).locator(`[data-node-id="${scene.closeId}"]`)).toBeVisible()
})

/** Edge pins sit this far inside the canvas, leaving room for the chevron they point with. */
const EDGE_PIN_INSET = 12

/**
 * Where the edge pin for a layer off screen sits, following the canvas: the ray from the
 * viewport center toward the layer, where it leaves the inset viewport.
 */
function edgePinCenter(width: number, height: number, target: Vector): Vector {
  const center = { x: width / 2, y: height / 2 }
  const dx = target.x - center.x
  const dy = target.y - center.y
  const length = Math.hypot(dx, dy)
  const halfWidth = width / 2 - EDGE_PIN_INSET
  const halfHeight = height / 2 - EDGE_PIN_INSET
  const t = Math.min(
    dx === 0 ? Infinity : (halfWidth * length) / Math.abs(dx),
    dy === 0 ? Infinity : (halfHeight * length) / Math.abs(dy)
  )
  const point = { x: center.x + (dx / length) * t, y: center.y + (dy / length) * t }
  // The pill is 16px wide and stays inside the inset viewport.
  return {
    x: Math.min(Math.max(point.x, EDGE_PIN_INSET + 8), width - EDGE_PIN_INSET - 8),
    y: Math.min(Math.max(point.y, EDGE_PIN_INSET + 8), height - EDGE_PIN_INSET - 8)
  }
}

test('Issues off screen are pinned to the canvas edge and lead to the nearest most severe one', async () => {
  const scene = await buildScene(editor.page)
  await openLint(editor.page)
  const canvas = await editor.canvas.canvas.boundingBox()
  if (!canvas) throw new Error('Canvas has no bounding box')
  // Pan the card off the left edge; the caption's contrast error is the most severe issue.
  const panX = -1000
  await editor.page.evaluate((x) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.panX = x
    store.requestRender()
  }, panX)
  await waitForMarkers(editor.page)
  const caption = { x: CARD.x + 24 + 100 + panX, y: CARD.y + 24 + 12 }
  const pin = edgePinCenter(canvas.width, canvas.height, caption)

  await hoverMarker(pin)
  const tooltip = editor.page.getByTestId('issue-marker-tooltip')
  await expect(tooltip).toContainText('Off screen to the left')
  await expect(tooltip).toContainText('Low text contrast')
  await editor.canvas.waitForRender()
  expect(
    await editor.page.screenshot({
      clip: { x: canvas.x, y: canvas.y + pin.y - 20, width: 33, height: 40 }
    })
  ).toMatchSnapshot('design-check-edge-pin-hover.png')

  await editor.canvas.click(pin.x, pin.y)
  await expect.poll(() => selectedIds(editor.page)).toEqual([scene.captionId])
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.panX ?? 0))
    .toBeGreaterThan(panX)
  await expect(lintPanel(editor.page).locator(`[data-node-id="${scene.captionId}"]`)).toBeVisible()
})

test('Other pages are checked for the page list and the Document scope', async () => {
  await buildScene(editor.page)
  const cartCaptionId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const checkout = store.graph.addPage('Checkout')
    const cart = store.graph.createNode('FRAME', checkout.id, {
      name: 'Cart',
      width: 300,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    return store.graph.createNode('TEXT', cart.id, {
      name: 'Cart caption',
      x: 20,
      y: 20,
      width: 200,
      height: 24,
      text: 'Pale',
      fontSize: 16,
      fills: [
        { type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85, a: 1 }, visible: true, opacity: 1 }
      ]
    }).id
  })

  const checkoutBadge = editor.page
    .getByTestId('pages-item')
    .filter({ hasText: 'Checkout' })
    .locator('[data-issue-severity="error"]')
  await expect(checkoutBadge).toHaveText('1')
  await expect(checkoutBadge).toHaveAccessibleName('Errors: 1')

  await openLint(editor.page)
  const panel = lintPanel(editor.page)
  await panel.getByRole('button', { name: 'Document' }).click()
  const cartRow = panel.locator(`[data-node-id="${cartCaptionId}"]`)
  await expect(cartRow).toContainText('On Checkout')

  await cartRow.click()
  await expect
    .poll(() =>
      editor.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        return store ? store.graph.getNode(store.state.currentPageId)?.name : null
      })
    )
    .toBe('Checkout')
  await expect.poll(() => selectedIds(editor.page)).toEqual([cartCaptionId])
})

test('Canvas markers and Layers panel marks can be turned off from the View menu', async () => {
  await buildScene(editor.page)
  await waitForMarkers(editor.page)
  // The card is collapsed in the Layers panel, so it shows the error inside it as a dot.
  const cardMark = editor.page
    .getByTestId('layers-item')
    .filter({ hasText: 'Card' })
    .locator('[data-issue-severity="error"]')
  await expect(cardMark).toBeVisible()
  await expect(cardMark).toHaveAccessibleName('Contains errors or warnings')
  const markerCount = () =>
    editor.page.evaluate(
      () => window.openPencil?.getStore?.().state.designIssues?.markers.length ?? 0
    )

  await editor.page.getByRole('menuitem', { name: 'View' }).click()
  const toggle = editor.page.getByRole('menuitemcheckbox', { name: 'Design issues' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect.poll(markerCount).toBe(0)
  await expect(cardMark).toHaveCount(0)

  await editor.canvas.hover(CLOSE_MARKER.x + 1, CLOSE_MARKER.y)
  await expect(editor.page.getByTestId('issue-marker-tooltip')).toHaveCount(0)

  await editor.page.getByRole('menuitem', { name: 'View' }).click()
  await editor.page.getByRole('menuitemcheckbox', { name: 'Design issues' }).click()
  await expect.poll(markerCount).toBeGreaterThan(0)
})
