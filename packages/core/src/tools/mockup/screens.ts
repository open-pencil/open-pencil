import * as v from 'valibot'

import { nextFreeX } from '#core/tools/mockup/fit'
import { defineTool, nodeSummary, requireNode, toolNumber } from '#core/tools/schema'

/** Common viewport sizes, in CSS pixels. */
export const SCREEN_SIZES = {
  'mobile-small': { label: 'Mobile S', width: 360, height: 800 },
  mobile: { label: 'Mobile', width: 393, height: 852 },
  'mobile-large': { label: 'Mobile L', width: 430, height: 932 },
  'tablet-portrait': { label: 'Tablet', width: 834, height: 1194 },
  'tablet-landscape': { label: 'Tablet landscape', width: 1194, height: 834 },
  laptop: { label: 'Laptop', width: 1280, height: 832 },
  desktop: { label: 'Desktop', width: 1440, height: 1024 },
  'desktop-hd': { label: 'Desktop HD', width: 1920, height: 1080 }
} as const

export type ScreenSizeId = keyof typeof SCREEN_SIZES
export const SCREEN_SIZE_IDS = Object.keys(SCREEN_SIZES) as [ScreenSizeId, ...ScreenSizeId[]]
export const DEFAULT_SCREENS: readonly ScreenSizeId[] = ['mobile', 'tablet-portrait', 'desktop']

export const resizeForScreens = defineTool({
  name: 'resize_for_screens',
  description:
    'Adapt a frame to several screen sizes at once (responsive). Each copy is resized to the screen width, so auto layout and constraints reflow the content rather than scaling it; text keeps its size. By default the height follows the content (hug) when the frame uses vertical auto layout, else it takes the screen height. Copies are laid out in a row to the right.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Frame to adapt')),
    screens: v.optional(
      v.pipe(
        v.array(v.picklist(SCREEN_SIZE_IDS)),
        v.minLength(1),
        v.description('Screen ids; default mobile, tablet-portrait, desktop')
      )
    ),
    gap: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Space between copies'))),
      100
    )
  }),
  execute: (figma, args) => {
    const source = requireNode(figma, args.id)
    if (!source) return { error: `Node ${args.id} not found` }
    if (source.type !== 'FRAME' && source.type !== 'COMPONENT' && source.type !== 'INSTANCE')
      return { error: 'Select a frame to adapt; only frames reflow to a new width' }
    const screens = args.screens ?? DEFAULT_SCREENS
    let x = nextFreeX(figma, args.gap)
    const y = source.parent?.id === figma.currentPage.id ? source.y : 0
    const created = screens.map((id) => {
      const screen = SCREEN_SIZES[id]
      const copy = source.clone()
      figma.currentPage.appendChild(copy)
      copy.name = `${source.name} — ${screen.label} ${screen.width}`
      const hugs = 'layoutMode' in source && source.layoutMode === 'VERTICAL'
      // resize() applies children's constraints and auto layout, as dragging the frame edge does.
      copy.resize(screen.width, hugs ? copy.height : screen.height)
      copy.x = x
      copy.y = y
      x += screen.width + args.gap
      return { ...nodeSummary(copy), screen: id, width: copy.width, height: copy.height }
    })
    return { created }
  }
})
