import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { placeIcon, recolorIcon } from '#core/icons/render'
import { createSFSymbolsProvider, type SFSymbolsHost } from '#core/icons/sf-symbols/provider'

const CATALOGUE = JSON.stringify({
  names: ['house', 'house.fill', 'cloud.sun.rain.fill'],
  keywords: { 'house.fill': ['home', 'building'], 'cloud.sun.rain.fill': ['weather'] }
})

const requestSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.looseObject({ names: v.array(v.string()) })
)

/** Two layers, as a hierarchical symbol draws them: one opaque, one half seen. */
const DRAWN = {
  paths: [
    { d: 'M0 0L30 0L30 30Z', opacity: 1 },
    { d: 'M0 0L0 30L30 30Z', opacity: 0.498 }
  ]
}

/** A Mac that draws every symbol it lists, recording each request; or none, as elsewhere. */
function setup(mac = true, drawn: { paths: Record<string, unknown>[] } = DRAWN) {
  const requests: Record<string, unknown>[] = []
  const host: SFSymbolsHost = {
    catalogue: async () => (mac ? CATALOGUE : null),
    async render(request) {
      if (!mac) return null
      const parsed = v.parse(requestSchema, request)
      requests.push(parsed)
      return JSON.stringify(Object.fromEntries(parsed.names.map((name) => [name, drawn])))
    }
  }
  return { provider: createSFSymbolsProvider(host), requests }
}

describe('SF Symbols', () => {
  test('lists, browses, and searches the symbols the Mac draws, by name and keyword', async () => {
    const { provider } = setup()
    const [set] = await provider.collections()
    expect(set).toMatchObject({ prefix: 'sf-symbols', name: 'SF Symbols', total: 3 })
    expect(set?.options?.map((option) => option.key)).toEqual([
      'weight',
      'scale',
      'rendering',
      'variable',
      'secondary',
      'tertiary'
    ])
    expect(await provider.browse('sf-symbols')).toHaveLength(3)
    expect((await provider.search('home')).icons).toEqual(['sf-symbols:house.fill'])
    expect((await provider.search('house fill')).icons).toEqual(['sf-symbols:house.fill'])
    expect((await provider.search('house', { prefix: 'lucide' })).icons).toEqual([])
    expect(await provider.search('house', { limit: 1 })).toMatchObject({
      icons: ['sf-symbols:house'],
      total: 2,
      collections: { 'sf-symbols': { total: 2 } }
    })
  })

  test('draws only its own set’s names, though another set has one alike', async () => {
    const { provider } = setup()
    const icons = await provider.icons(['sf-symbols:house', 'lucide:house'], 24)
    expect([...icons.keys()]).toEqual(['sf-symbols:house'])
    const previews = await provider.previews(['sf-symbols:house', 'lucide:house'])
    expect(previews.get('lucide:house') ?? null).toBeNull()
    expect(previews.get('sf-symbols:house')).toContain('<path')
  })

  test('lists the set as unavailable, with no icons, where the host cannot draw them', async () => {
    const { provider } = setup(false)
    expect(await provider.collections()).toMatchObject([
      { prefix: 'sf-symbols', total: 0, unavailable: 'system' }
    ])
    expect(await createSFSymbolsProvider(null).collections()).toMatchObject([
      { prefix: 'sf-symbols', total: 0, unavailable: 'host' }
    ])
    expect((await createSFSymbolsProvider(null).icons(['sf-symbols:house'], 24)).size).toBe(0)
    expect((await provider.search('house')).icons).toEqual([])
    expect((await provider.icons(['sf-symbols:house'], 24)).size).toBe(0)
  })

  test('draws icons in one request at the options set, defaults filling the rest', async () => {
    const { provider, requests } = setup()
    const icons = await provider.icons(['sf-symbols:house', 'sf-symbols:house.fill'], 24, {
      weight: 'bold',
      rendering: 'sideways'
    })
    expect(requests).toEqual([
      {
        names: ['house', 'house.fill'],
        size: 24,
        weight: 'bold',
        scale: 'medium',
        rendering: 'monochrome',
        variable: 1
      }
    ])
    const house = icons.get('sf-symbols:house')
    expect(house?.options).toEqual({
      weight: 'bold',
      scale: 'medium',
      rendering: 'monochrome',
      variable: 1
    })
    expect(house?.width).toBe(24)
    expect(house?.paths.map((path) => path.fills[0]?.opacity)).toEqual([1, 0.498])
  })

  test('places each layer at its opacity, which recoloring keeps', async () => {
    const { provider } = setup()
    const icon = (await provider.icons(['sf-symbols:cloud.sun.rain.fill'], 24)).get(
      'sf-symbols:cloud.sun.rain.fill'
    )
    if (!icon) throw new Error('no icon')
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = placeIcon(graph, page.id, icon, { size: 24, color: parseColor('#000000') })
    recolorIcon(graph, frame.id, parseColor('#ff0000'))
    expect(
      graph.getChildren(frame.id).map((path) => [path.fills[0]?.opacity, path.fills[0]?.color.r])
    ).toEqual([
      [1, 1],
      [0.498, 1]
    ])
  })

  test('keeps palette colors only while the rendering is palette, and bounds the variable value', async () => {
    const { provider } = setup()
    const draw = async (options: Record<string, string | number>) =>
      (await provider.icons(['sf-symbols:house'], 24, options)).get('sf-symbols:house')?.options
    expect(await draw({ rendering: 'palette', secondary: 'red', tertiary: 'not a color' })).toEqual(
      {
        weight: 'regular',
        scale: 'medium',
        rendering: 'palette',
        variable: 1,
        secondary: '#FF0000',
        tertiary: '#8E8E93'
      }
    )
    expect(await draw({ rendering: 'hierarchical', secondary: '#ff0000', variable: 4 })).toEqual({
      weight: 'regular',
      scale: 'medium',
      rendering: 'hierarchical',
      variable: 1
    })
  })

  test('paints palette layers past the primary in their own colors, which recoloring keeps', async () => {
    const { provider } = setup(true, {
      paths: [
        { d: 'M0 0L30 0L30 30Z', opacity: 1, layer: 0 },
        { d: 'M0 0L0 30L30 30Z', opacity: 1, layer: 1 },
        { d: 'M0 0L10 0L10 10Z', opacity: 1, layer: 2 }
      ]
    })
    const icon = (
      await provider.icons(['sf-symbols:house'], 24, {
        rendering: 'palette',
        secondary: '#00ff00',
        tertiary: '#0000ff'
      })
    ).get('sf-symbols:house')
    if (!icon) throw new Error('no icon')
    const graph = new SceneGraph()
    const frame = placeIcon(graph, graph.getPages()[0].id, icon, {
      size: 24,
      color: parseColor('#000000')
    })
    recolorIcon(graph, frame.id, parseColor('#ff0000'))
    const colors = graph.getChildren(frame.id).map((path) => path.fills[0]?.color)
    expect(colors).toEqual([parseColor('#ff0000'), parseColor('#00ff00'), parseColor('#0000ff')])
  })

  test('keeps a multicolor symbol’s own colors and tints only its foreground', async () => {
    const { provider } = setup(true, {
      paths: [
        { d: 'M0 0L30 0L30 30Z', opacity: 1, color: '#ffcc00' },
        { d: 'M0 0L0 30L30 30Z', opacity: 0.5 }
      ]
    })
    const icon = (await provider.icons(['sf-symbols:house'], 24, { rendering: 'multicolor' })).get(
      'sf-symbols:house'
    )
    expect(
      icon?.paths.map((path) => [path.tint, path.fills[0]?.color, path.fills[0]?.opacity])
    ).toEqual([
      [[], parseColor('#ffcc00'), 1],
      [['fill'], parseColor('#000000'), 0.5]
    ])
  })

  test('draws previews once', async () => {
    const { provider, requests } = setup()
    await provider.previews(['sf-symbols:house'])
    const [preview] = (await provider.previews(['sf-symbols:house'])).values()
    expect(requests).toHaveLength(1)
    expect(preview).toContain('fill-opacity="0.498"')
  })
})
