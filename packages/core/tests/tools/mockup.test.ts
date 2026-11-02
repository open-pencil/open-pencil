import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@lawha/core/figma-api'
import { ALL_TOOLS, isToolExposed } from '@lawha/core/tools'
import { SceneGraph } from '@lawha/scene-graph'

import { fitScale } from '#core/tools/mockup/fit'
import { DEVICE_IDS, DEVICES, SOCIAL_FORMAT_IDS, SOCIAL_FORMATS } from '#core/tools/mockup/presets'

function tool(name: string) {
  const found = ALL_TOOLS.find((item) => item.name === name)
  if (!found) throw new Error(`No tool ${name}`)
  return (figma: FigmaAPI, args: Record<string, unknown>) => found.execute(figma, args)
}
const listPresets = tool('list_mockup_presets')
const createPost = tool('create_social_post')
const resize = tool('resize_for_platforms')
const mockup = tool('create_device_mockup')

/** A 400×300 card: a red background rect and a 100×50 badge at (20, 30). */
function card() {
  const figma = new FigmaAPI(new SceneGraph())
  const frame = figma.createFrame()
  frame.name = 'Card'
  frame.resize(400, 300)
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 1, visible: true }]
  const badge = figma.createRectangle()
  frame.appendChild(badge)
  badge.name = 'Badge'
  badge.x = 20
  badge.y = 30
  badge.resize(100, 50)
  badge.cornerRadius = 10
  return { figma, frame, badge }
}

interface MockupPresetList {
  formats: { id: string }[]
  devices: { id: string }[]
}

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6)

describe('fitScale', () => {
  test('contain uses the smaller ratio, cover the larger', () => {
    expect(fitScale({ width: 400, height: 300 }, { width: 1080, height: 1920 }, 'contain')).toBe(
      2.7
    )
    close(fitScale({ width: 400, height: 300 }, { width: 1080, height: 1920 }, 'cover'), 6.4)
    expect(fitScale({ width: 100, height: 100 }, { width: 100, height: 100 }, 'cover')).toBe(1)
  })
})

describe('presets', () => {
  test('every format has positive integer pixel sizes and a unique id', () => {
    expect(new Set(SOCIAL_FORMAT_IDS).size).toBe(SOCIAL_FORMAT_IDS.length)
    for (const id of SOCIAL_FORMAT_IDS) {
      const { width, height } = SOCIAL_FORMATS[id]
      expect(Number.isInteger(width) && width > 0).toBe(true)
      expect(Number.isInteger(height) && height > 0).toBe(true)
    }
  })

  test('platform sizes match the published specs', () => {
    expect(SOCIAL_FORMATS['instagram-post']).toMatchObject({ width: 1080, height: 1080 })
    expect(SOCIAL_FORMATS['instagram-portrait']).toMatchObject({ width: 1080, height: 1350 })
    expect(SOCIAL_FORMATS['instagram-story']).toMatchObject({ width: 1080, height: 1920 })
    expect(SOCIAL_FORMATS['youtube-thumbnail']).toMatchObject({ width: 1280, height: 720 })
    expect(SOCIAL_FORMATS['linkedin-post']).toMatchObject({ width: 1200, height: 627 })
  })

  test('every device screen sits fully inside its body', () => {
    for (const id of DEVICE_IDS) {
      const d = DEVICES[id]
      expect(d.screen.x).toBeGreaterThanOrEqual(0)
      expect(d.screen.y).toBeGreaterThanOrEqual(0)
      expect(d.screen.x + d.screen.width).toBeLessThanOrEqual(d.width)
      expect(d.screen.y + d.screen.height).toBeLessThanOrEqual(d.height)
    }
  })

  test('list_mockup_presets returns every format and device', () => {
    const { figma } = card()
    const out = listPresets(figma, {}) as MockupPresetList
    expect(out.formats).toHaveLength(SOCIAL_FORMAT_IDS.length)
    expect(out.devices).toHaveLength(DEVICE_IDS.length)
  })
})

describe('create_social_post', () => {
  test('creates a clipped frame at the exact platform size', () => {
    const { figma } = card()
    const out = createPost(figma, { format: 'instagram-story', x: 10, y: 20 }) as { id: string }
    const frame = figma.getNodeById(out.id)
    expect(frame).toMatchObject({
      type: 'FRAME',
      x: 10,
      y: 20,
      width: 1080,
      height: 1920,
      clipsContent: true
    })
    expect(frame?.name).toBe('Instagram Story / Reel · 1080×1920')
  })

  test('defaults to a free spot right of existing content', () => {
    const { figma } = card()
    const out = createPost(figma, { format: 'x-post' }) as { id: string }
    expect(figma.getNodeById(out.id)?.x).toBe(500) // card ends at 400, gap 100
  })

  test('rejects unknown formats', () => {
    const { figma } = card()
    expect(() => createPost(figma, { format: 'myspace' })).toThrow()
  })
})

describe('resize_for_platforms', () => {
  test('makes one copy per format at the exact size, original untouched', () => {
    const { figma, frame, badge } = card()
    const formats = ['instagram-post', 'instagram-story', 'youtube-thumbnail']
    const out = resize(figma, { id: frame.id, formats }) as {
      created: { id: string; content: string }[]
    }
    expect(out.created).toHaveLength(3)
    formats.forEach((id, i) => {
      const node = figma.getNodeById(out.created[i].id)
      const f = SOCIAL_FORMATS[id as keyof typeof SOCIAL_FORMATS]
      expect(node).toMatchObject({ width: f.width, height: f.height, clipsContent: true })
      expect(node?.fills).toEqual(frame.fills)
    })
    expect(frame).toMatchObject({ width: 400, height: 300, x: 0, y: 0 })
    expect(badge).toMatchObject({ x: 20, y: 30, width: 100, height: 50 })
  })

  test('contain scales uniformly and centres the copy', () => {
    const { figma, frame } = card()
    const out = resize(figma, { id: frame.id, formats: ['instagram-story'] }) as {
      created: { content: string }[]
    }
    const copy = figma.getNodeById(out.created[0].content)
    // 400×300 into 1080×1920 → ×2.7 → 1080×810, centred vertically.
    close(copy?.width ?? 0, 1080)
    close(copy?.height ?? 0, 810)
    close(copy?.x ?? -1, 0)
    close(copy?.y ?? -1, (1920 - 810) / 2)
    const badge = copy?.children.find((child) => child.name === 'Badge')
    close(badge?.x ?? 0, 54)
    close(badge?.y ?? 0, 81)
    close(badge?.width ?? 0, 270)
    close((badge as { cornerRadius?: number } | undefined)?.cornerRadius ?? 0, 27)
  })

  test('cover fills the frame and crops symmetrically', () => {
    const { figma, frame } = card()
    const out = resize(figma, { id: frame.id, formats: ['instagram-story'], fit: 'cover' }) as {
      created: { content: string }[]
    }
    const copy = figma.getNodeById(out.created[0].content)
    close(copy?.height ?? 0, 1920)
    close(copy?.width ?? 0, 2560)
    close(copy?.x ?? 0, -(2560 - 1080) / 2)
  })

  test('copies sit in a row without overlapping', () => {
    const { figma, frame } = card()
    const out = resize(figma, {
      id: frame.id,
      formats: ['instagram-post', 'x-post', 'pinterest-pin'],
      gap: 40
    }) as { created: { id: string }[] }
    const nodes = out.created.map((c) => figma.getNodeById(c.id))
    expect(nodes[0]?.x).toBe(440)
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1]
      expect(nodes[i]?.x).toBe((prev?.x ?? 0) + (prev?.width ?? 0) + 40)
    }
  })

  test('an unknown node fails cleanly', () => {
    const { figma } = card()
    expect(() => resize(figma, { id: '99:99', formats: ['x-post'] })).toThrow()
  })
})

describe('create_device_mockup', () => {
  test.each(DEVICE_IDS)('%s: body, clipped screen and a cover-fitted copy', (device) => {
    const { figma, frame } = card()
    const d = DEVICES[device]
    const out = mockup(figma, { id: frame.id, device }) as {
      id: string
      screen: string
      content: string
    }
    const root = figma.getNodeById(out.id)
    const screen = figma.getNodeById(out.screen)
    const content = figma.getNodeById(out.content)
    expect(root).toMatchObject({ width: d.width, height: d.height })
    expect(screen).toMatchObject({
      x: d.screen.x,
      y: d.screen.y,
      width: d.screen.width,
      height: d.screen.height,
      clipsContent: true
    })
    expect(screen?.parent?.id).toBe(root?.id)
    expect(content?.parent?.id).toBe(screen?.id)
    // Cover: the copy covers the whole screen and is centred.
    expect(content?.width ?? 0).toBeGreaterThanOrEqual(d.screen.width - 1e-6)
    expect(content?.height ?? 0).toBeGreaterThanOrEqual(d.screen.height - 1e-6)
    close((content?.x ?? 0) * 2 + (content?.width ?? 0), d.screen.width)
    close((content?.y ?? 0) * 2 + (content?.height ?? 0), d.screen.height)
    expect(frame).toMatchObject({ width: 400, height: 300 })
  })

  test('browser mockup has toolbar, three window controls and an address bar', () => {
    const { figma, frame } = card()
    const out = mockup(figma, { id: frame.id, device: 'browser' }) as { id: string }
    const names = figma.getNodeById(out.id)?.children.map((c) => c.name)
    expect(names?.filter((n) => n === 'Window control')).toHaveLength(3)
    expect(names).toContain('Toolbar')
    expect(names).toContain('Address bar')
  })

  test('contain keeps the whole design visible', () => {
    const { figma, frame } = card()
    const out = mockup(figma, { id: frame.id, device: 'phone-modern', fit: 'contain' }) as {
      content: string
    }
    const content = figma.getNodeById(out.content)
    expect(content?.width ?? 0).toBeLessThanOrEqual(393 + 1e-6)
    expect(content?.height ?? 0).toBeLessThanOrEqual(852 + 1e-6)
  })
})

describe('exposure', () => {
  test('mockup tools are exposed to AI chat and MCP', () => {
    for (const name of [
      'list_mockup_presets',
      'create_social_post',
      'resize_for_platforms',
      'create_device_mockup'
    ]) {
      const def = ALL_TOOLS.find((t) => t.name === name)
      expect(def).toBeDefined()
      if (!def) continue
      expect(isToolExposed(def, 'mcp')).toBe(true)
      expect(isToolExposed(def, 'ai')).toBe(true)
    }
  })
})

describe('resize_for_platforms placement', () => {
  test('copies of a top-level design stay on its row', () => {
    const { figma, frame } = card()
    frame.y = 250
    const out = resize(figma, { id: frame.id, formats: ['x-post'] }) as {
      created: { id: string }[]
    }
    expect(figma.getNodeById(out.created[0].id)?.y).toBe(250)
  })

  test('copies of a nested design start at the page top', () => {
    const { figma, frame, badge } = card()
    frame.y = 250
    const out = resize(figma, { id: badge.id, formats: ['x-post'] }) as {
      created: { id: string }[]
    }
    expect(figma.getNodeById(out.created[0].id)?.y).toBe(0)
  })
})
