import * as v from 'valibot'

import type { FigmaNodeProxy } from '#core/figma-api'
import { fitInputSchema, nextFreeX, placeCopy } from '#core/tools/mockup/fit'
import {
  DEVICES,
  SOCIAL_FORMAT_IDS,
  SOCIAL_FORMATS,
  type SocialFormatId
} from '#core/tools/mockup/presets'
import { defineTool, nodeSummary, requireNode, toolNumber } from '#core/tools/schema'

const formatSchema = v.pipe(
  v.picklist(SOCIAL_FORMAT_IDS),
  v.description('Format id from list_mockup_presets, e.g. instagram-post, instagram-story, x-post')
)

function formatName(id: SocialFormatId): string {
  const f = SOCIAL_FORMATS[id]
  return `${f.platform} ${f.label} · ${f.width}×${f.height}`
}

export const listMockupPresets = defineTool({
  name: 'list_mockup_presets',
  description:
    'List social media / print post formats (with pixel sizes) and device mockup frames that create_social_post, resize_for_platforms and create_device_mockup accept.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({}),
  execute: () => ({
    formats: SOCIAL_FORMAT_IDS.map((id) => ({ id, ...SOCIAL_FORMATS[id] })),
    devices: Object.entries(DEVICES).map(([id, d]) => ({
      id,
      label: d.label,
      screen: { width: d.screen.width, height: d.screen.height }
    }))
  })
})

export const createSocialPost = defineTool({
  name: 'create_social_post',
  description:
    'Create an empty post frame at a platform’s recommended size (Instagram, Story, TikTok, X, LinkedIn, YouTube thumbnail, print…). Design inside it with other tools.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    format: formatSchema,
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X on the page; default: right of existing content')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y on the page; default 0')))),
    name: v.optional(v.pipe(v.string(), v.description('Frame name')))
  }),
  execute: (figma, args) => {
    const f = SOCIAL_FORMATS[args.format]
    const frame = figma.createFrame()
    frame.x = args.x ?? nextFreeX(figma)
    frame.y = args.y ?? 0
    frame.resize(f.width, f.height)
    frame.name = args.name ?? formatName(args.format)
    frame.clipsContent = true
    return { ...nodeSummary(frame), width: f.width, height: f.height }
  }
})

export const resizeForPlatforms = defineTool({
  name: 'resize_for_platforms',
  description:
    'Turn one design into post-ready copies for several platforms at once. Each copy is a new frame at the platform size with the design scaled uniformly (text included) and centred; the original is untouched. Copies are laid out in a row to the right of the page content.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Frame (or any node) to adapt')),
    formats: v.pipe(v.array(formatSchema), v.minLength(1), v.maxLength(20), v.description('Target formats')),
    fit: fitInputSchema,
    gap: v.optional(toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Space between copies'))), 100)
  }),
  execute: (figma, args) => {
    const source = requireNode(figma, args.id)
    if (!source) return { error: `Node ${args.id} not found` }
    const background = 'fills' in source ? (source.fills as FigmaNodeProxy['fills']) : []
    let x = nextFreeX(figma, args.gap)
    const y = source.parent?.type === 'PAGE' ? source.y : 0
    const results = args.formats.map((id) => {
      const f = SOCIAL_FORMATS[id]
      const frame = figma.createFrame()
      frame.name = `${source.name} — ${formatName(id)}`
      frame.resize(f.width, f.height)
      frame.x = x
      frame.y = y
      frame.clipsContent = true
      frame.fills = background
      const copy = placeCopy(source, frame, f, args.fit)
      x += f.width + args.gap
      return { ...nodeSummary(frame), format: id, width: f.width, height: f.height, content: copy.id }
    })
    return { created: results }
  }
})
