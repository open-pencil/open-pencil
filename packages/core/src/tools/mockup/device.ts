import * as v from 'valibot'

import type { FigmaAPI, FigmaNodeProxy } from '#core/figma-api'
import { nextFreeX, placeCopy } from '#core/tools/mockup/fit'
import { DEVICE_IDS, DEVICES, type DevicePreset } from '#core/tools/mockup/presets'
import { defineTool, nodeSummary, requireNode, toolNumber } from '#core/tools/schema'

type RGB = { r: number; g: number; b: number }

const BODY: Record<'dark' | 'light', RGB> = {
  dark: { r: 0.11, g: 0.11, b: 0.12 },
  light: { r: 0.89, g: 0.9, b: 0.92 }
}
const CHROME = { r: 0.93, g: 0.93, b: 0.94 }
const TRAFFIC: RGB[] = [
  { r: 1, g: 0.37, b: 0.34 },
  { r: 1, g: 0.74, b: 0.18 },
  { r: 0.16, g: 0.79, b: 0.25 }
]

function solid(color: RGB) {
  return [{ type: 'SOLID' as const, color, opacity: 1, visible: true }]
}

function rect(
  figma: FigmaAPI,
  parent: FigmaNodeProxy,
  name: string,
  box: { x: number; y: number; width: number; height: number; radius?: number },
  color: RGB
): FigmaNodeProxy {
  const node = figma.createRectangle()
  parent.appendChild(node)
  node.name = name
  node.x = box.x
  node.y = box.y
  node.resize(box.width, box.height)
  if (box.radius) node.cornerRadius = box.radius
  node.fills = solid(color)
  return node
}

/** The decorative parts each device kind adds around its screen. */
function drawDetails(figma: FigmaAPI, root: FigmaNodeProxy, d: DevicePreset, body: RGB): void {
  const s = d.screen
  if (d.kind === 'phone' && s.y === s.x) {
    // Edge-to-edge phone: a pill-shaped camera island over the screen.
    rect(figma, root, 'Camera island', { x: s.x + s.width / 2 - 62, y: s.y + 11, width: 124, height: 36, radius: 18 }, { r: 0, g: 0, b: 0 })
  } else if (d.kind === 'phone') {
    rect(figma, root, 'Speaker', { x: d.width / 2 - 30, y: 34, width: 60, height: 6, radius: 3 }, { r: 0.3, g: 0.3, b: 0.32 })
    const button = figma.createEllipse()
    root.appendChild(button)
    button.name = 'Home button'
    button.resize(54, 54)
    button.x = d.width / 2 - 27
    button.y = s.y + s.height + 12
    button.fills = []
    button.strokes = solid({ r: 0.3, g: 0.3, b: 0.32 })
    button.strokeWeight = 2
  } else if (d.kind === 'laptop') {
    rect(figma, root, 'Base', { x: -80, y: d.height - 4, width: d.width + 160, height: 26, radius: 12 }, body)
    rect(figma, root, 'Notch', { x: d.width / 2 - 90, y: d.height - 4, width: 180, height: 10, radius: 5 }, { r: 0.6, g: 0.6, b: 0.62 })
  } else if (d.kind === 'desktop') {
    rect(figma, root, 'Neck', { x: d.width / 2 - 110, y: d.height, width: 220, height: 180 }, body)
    rect(figma, root, 'Stand', { x: d.width / 2 - 300, y: d.height + 180, width: 600, height: 28, radius: 14 }, body)
  } else if (d.kind === 'browser') {
    rect(figma, root, 'Toolbar', { x: 0, y: 0, width: d.width, height: s.y }, CHROME)
    TRAFFIC.forEach((color, i) => {
      const dot = figma.createEllipse()
      root.appendChild(dot)
      dot.name = 'Window control'
      dot.resize(13, 13)
      dot.x = 20 + i * 22
      dot.y = s.y / 2 - 6.5
      dot.fills = solid(color)
    })
    rect(figma, root, 'Address bar', { x: d.width / 2 - 320, y: 12, width: 640, height: 28, radius: 8 }, { r: 1, g: 1, b: 1 })
  }
}

export const createDeviceMockup = defineTool({
  name: 'create_device_mockup',
  description:
    'Present a design inside a device mockup (phone, tablet, laptop, desktop, browser window, watch). Draws the device as editable layers and places a scaled copy of the design in its screen; the original is untouched.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Frame showing the screen design')),
    device: v.pipe(v.picklist(DEVICE_IDS), v.description('Device id from list_mockup_presets')),
    fit: v.optional(
      v.pipe(v.picklist(['contain', 'cover']), v.description('Default cover: fill the screen, cropping overflow')),
      'cover'
    ),
    color: v.optional(v.pipe(v.picklist(['dark', 'light']), v.description('Device body colour')), 'dark'),
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X on the page; default: right of existing content')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y on the page; default 0'))))
  }),
  execute: (figma, args) => {
    const source = requireNode(figma, args.id)
    if (!source) return { error: `Node ${args.id} not found` }
    const d: DevicePreset = DEVICES[args.device]
    const body = d.kind === 'browser' ? CHROME : BODY[args.color]

    const root = figma.createFrame()
    root.name = `${source.name} — ${d.label} mockup`
    root.x = args.x ?? nextFreeX(figma)
    root.y = args.y ?? 0
    root.resize(d.width, d.height)
    root.cornerRadius = d.bodyRadius
    root.clipsContent = false
    root.fills = solid(body)

    const screen = figma.createFrame()
    root.appendChild(screen)
    screen.name = 'Screen'
    screen.x = d.screen.x
    screen.y = d.screen.y
    screen.resize(d.screen.width, d.screen.height)
    screen.cornerRadius = d.screen.radius
    screen.clipsContent = true
    screen.fills = solid({ r: 0, g: 0, b: 0 })
    const content = placeCopy(source, screen, { width: d.screen.width, height: d.screen.height }, args.fit)

    drawDetails(figma, root, d, body)
    return { ...nodeSummary(root), screen: screen.id, content: content.id }
  }
})

