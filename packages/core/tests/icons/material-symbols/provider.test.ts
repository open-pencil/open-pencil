import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { createMaterialSymbolsProvider } from '#core/icons/material-symbols/provider'

const FONT_URL = 'https://fonts.gstatic.com/s/test/material.ttf'

/** The names each set's font draws, as Google lists them beside the fonts. */
const CODEPOINTS: Record<string, string> = {
  MaterialSymbolsOutlined: 'home e88a\ndark_mode e51c\n',
  MaterialSymbolsRounded: 'home e88a\ndark_mode e51c\n',
  MaterialSymbolsSharp: 'dark_mode e51c\n'
}

/**
 * A provider over a fake Google that serves the fixture font, recording each request; it fails
 * the requests for fonts holding any of `failing`.
 */
async function setup(failing: readonly string[] = []) {
  const font = await Bun.file(
    join(FIXTURES, 'fonts', 'MaterialSymbolsRounded-home-dark_mode.ttf')
  ).arrayBuffer()
  const requests: URL[] = []
  const google = async (input: string | URL | Request) => {
    const url = new URL(String(input))
    requests.push(url)
    const names = url.searchParams.get('icon_names')?.split(',') ?? []
    if (url.pathname === '/css2' && names.some((name) => failing.includes(name)))
      return new Response(null, { status: 503 })
    if (url.pathname === '/css2')
      return new Response(`@font-face { src: url(${FONT_URL}) format('woff2'); }`)
    if (url.href === FONT_URL) return new Response(font)
    const list = /\/(\w+)\[FILL,GRAD,opsz,wght\]\.codepoints$/.exec(
      decodeURIComponent(url.pathname)
    )
    if (url.hostname === 'cdn.jsdelivr.net' && list?.[1]) return new Response(CODEPOINTS[list[1]])
    return new Response(null, { status: 404 })
  }
  const provider = createMaterialSymbolsProvider(
    Object.assign(google, { preconnect: fetch.preconnect })
  )
  return { provider, requests }
}

function bounds(xs: number[]) {
  return [Math.min(...xs), Math.max(...xs)]
}

describe('Material Symbols', () => {
  test('draws each icon from one font Google cuts to the names asked for', async () => {
    const { provider, requests } = await setup()
    const icons = await provider.icons(
      [
        'material-symbols-rounded:home',
        'material-symbols-rounded:dark_mode',
        'material-symbols-rounded:nothing'
      ],
      40
    )
    expect([...icons.keys()]).toEqual([
      'material-symbols-rounded:home',
      'material-symbols-rounded:dark_mode'
    ])
    const css = requests.filter((url) => url.pathname === '/css2')
    expect(css).toHaveLength(1)
    expect(css[0]?.searchParams.get('family')).toBe(
      'Material Symbols Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
    )
    expect(css[0]?.searchParams.get('icon_names')).toBe('dark_mode,home,nothing')
  })

  test('draws an icon in its em square at the axes its options set, defaults filling the rest', async () => {
    const { provider } = await setup()
    const name = 'material-symbols-rounded:home'
    const thin = (await provider.icons([name], 40, { wght: 100 })).get(name)
    const bold = (await provider.icons([name], 40, { wght: 900 })).get(name)
    expect(thin?.options).toEqual({ opsz: 24, wght: 100, FILL: 0, GRAD: 0 })
    // Past the axis, the weight is the axis' end.
    expect(bold?.options).toMatchObject({ wght: 700 })
    const box = (icon: typeof thin) => {
      const vertices = icon?.paths[0]?.vectorNetwork.vertices ?? []
      return [bounds(vertices.map((v) => v.x)), bounds(vertices.map((v) => v.y))]
    }
    const [[thinLeft, thinRight], [thinTop, thinBottom]] = box(thin)
    const [[boldLeft, boldRight]] = box(bold)
    expect(thinLeft).toBeGreaterThan(0)
    expect(thinRight).toBeLessThan(40)
    expect(thinTop).toBeGreaterThan(0)
    expect(thinBottom).toBeLessThan(40)
    expect(boldRight - boldLeft).toBeGreaterThan(thinRight - thinLeft)
    expect(thin?.paths[0]?.fill).toBe('currentColor')
    // One region of closed contours, so the inner ones cut the house's holes.
    expect(thin?.paths[0]?.vectorNetwork.regions[0]?.loops.length).toBeGreaterThan(1)
  })

  test('keeps the icons of the fonts that loaded when another font of the set fails', async () => {
    // Past 150 names a set loads in several fonts; the second one fails here.
    const { provider } = await setup(['dark_mode'])
    const extra = Array.from({ length: 149 }, (_, index) => `material-symbols-rounded:extra_${index}`)
    const icons = await provider.icons(
      ['material-symbols-rounded:home', ...extra, 'material-symbols-rounded:dark_mode'],
      40
    )
    expect([...icons.keys()]).toEqual(['material-symbols-rounded:home'])
    await expect(provider.icons(['material-symbols-rounded:dark_mode'], 40)).rejects.toThrow()
  })

  test('fills an icon at the axes its fill sets, as fontTools draws the font', async () => {
    const { provider } = await setup()
    const name = 'material-symbols-rounded:home'
    // At the font's own 960-unit em, so the outline reads in font units, y from the top.
    const outlined = (await provider.icons([name], 960)).get(name)
    const filled = (await provider.icons([name], 960, { FILL: 1 })).get(name)
    const vertices = (icon: typeof filled) => icon?.paths[0]?.vectorNetwork.vertices ?? []
    const box = (icon: typeof filled) => [
      bounds(vertices(icon).map((v) => v.x)),
      bounds(vertices(icon).map((v) => v.y))
    ]
    expect(box(filled)).toEqual(box(outlined))
    // The door's corners on the floor, where every tuple's deltas land on their own points.
    expect(vertices(filled)).toContainEqual({ x: 400, y: 800 })
    expect(vertices(filled)).toContainEqual({ x: 560, y: 800 })
  })

  test('lists, browses, and searches the sets by the names Google lists for each font', async () => {
    const { provider } = await setup()
    const sets = await provider.collections()
    expect(sets.map((set) => [set.prefix, set.total])).toEqual([
      ['material-symbols-outlined', 2],
      ['material-symbols-rounded', 2],
      ['material-symbols-sharp', 1]
    ])
    expect(sets[0]?.options?.map((option) => option.key)).toEqual(['opsz', 'wght', 'FILL', 'GRAD'])
    expect(await provider.browse('material-symbols-sharp')).toEqual([
      'material-symbols-sharp:dark_mode'
    ])
    expect((await provider.search('dark', { prefix: 'material-symbols-rounded' })).icons).toEqual([
      'material-symbols-rounded:dark_mode'
    ])
    expect((await provider.search('mode')).icons).toEqual([
      'material-symbols-outlined:dark_mode',
      'material-symbols-rounded:dark_mode',
      'material-symbols-sharp:dark_mode'
    ])
    expect((await provider.search('home')).icons).toEqual([
      'material-symbols-outlined:home',
      'material-symbols-rounded:home'
    ])
  })

  test('previews an icon as SVG painted in the current color', async () => {
    const { provider } = await setup()
    const preview = (await provider.previews(['material-symbols-rounded:home'])).get(
      'material-symbols-rounded:home'
    )
    expect(preview).toStartWith('<svg')
    expect(preview).toContain('fill="currentColor"')
  })
})
