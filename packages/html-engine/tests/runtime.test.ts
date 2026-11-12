import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { htmlToDesignDocument, type DesignDocument, type DesignElement } from '@open-pencil/dom-css'
import { createHTMLEngineRuntime, loadHTMLEngine } from '@open-pencil/html-engine'
import { FIXTURES } from '@open-pencil/test-support/paths'

function elementById(document: DesignDocument, id: string): DesignElement {
  const walk = (nodes: DesignDocument['children']): DesignElement | undefined => {
    for (const node of nodes) {
      if (node.type !== 'element') continue
      if (node.attrs.id === id) return node
      const found = walk(node.children)
      if (found) return found
    }
    return undefined
  }
  const element = walk(document.children)
  if (!element) throw new Error(`No #${id}`)
  return element
}

/** The engine with the repository's Latin subset of Inter as its sans-serif font, so text has lines. */
async function engineWithInter() {
  const engine = await loadHTMLEngine()
  engine.addFont(await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes())
  engine.setGenericFamily('sans-serif', ['Inter Variable', 'Inter'])
  return engine
}

async function styled(html: string) {
  return htmlToDesignDocument(html, {
    runtime: createHTMLEngineRuntime({ engine: engineWithInter }),
    compute: { layout: true, viewport: { width: 800, height: 600 } }
  })
}

describe('the HTML engine runtime', () => {
  test('gives each element its computed style and its box', async () => {
    const document = await styled(
      `<style>.row { display: flex; gap: 10px; overflow: hidden }</style>
      <div id="row" class="row"><div id="a" style="width:100px;height:50px"></div></div>`
    )
    const row = elementById(document, 'row')
    const a = elementById(document, 'a')

    expect(row.computedStyle).toMatchObject({ display: 'flex', overflow: 'hidden' })
    // The body's default 8px margin, as a browser lays it out.
    expect(row.layout?.box).toEqual({ x: 8, y: 8, width: 784, height: 50 })
    expect(a.layout?.box).toEqual({ x: 8, y: 8, width: 100, height: 50 })
  })

  test('applies media queries for the viewport it lays out in', async () => {
    const document = await styled(
      `<style>@media (max-width: 700px) { #nav { display: none } }</style><nav id="nav">Menu</nav>`
    )

    expect(elementById(document, 'nav').computedStyle?.display).toBe('block')
  })

  test('records an inline element by its boxes on each line', async () => {
    const document = await styled(
      '<p id="p" style="width:60px;font:16px sans-serif"><span id="s">one two three four</span></p>'
    )
    const span = elementById(document, 's')

    expect(span.layout?.fragments?.length).toBeGreaterThan(1)
    expect(span.layout?.lines).toBeUndefined()
  })

  test('lays text out in a font registered under an alias by either name', async () => {
    const engine = await loadHTMLEngine()
    engine.resetFonts()
    engine.addFont(
      await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes(),
      'Brand'
    )
    const runtime = createHTMLEngineRuntime({ engine: async () => engine })
    const lines = async (family: string) => {
      const document = await htmlToDesignDocument(
        `<p id="p" style="font: 16px ${family}">Words</p>`,
        { runtime, compute: { layout: true, viewport: { width: 800, height: 600 } } }
      )
      return elementById(document, 'p').layout?.lines?.length ?? 0
    }

    expect(await lines('Brand')).toBe(1)
    expect(await lines("'Inter Variable'")).toBe(1)
    engine.resetFonts()
  })

  test('reports an inherited property a child resets to its initial value', async () => {
    const document = await styled(
      '<p style="text-transform:uppercase"><span id="s" style="text-transform:none">a</span></p>'
    )

    expect(elementById(document, 's').computedStyle?.['text-transform']).toBe('none')
  })

  test('pairs table rows through the tbody the parser inserts', async () => {
    const cell = (id: string): DesignElement => ({
      type: 'element',
      tagName: 'td',
      attrs: { id, style: 'width:40px;height:20px;padding:0' },
      children: []
    })
    const table: DesignDocument = {
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'table',
          attrs: { id: 't', style: 'border-spacing:0' },
          children: [
            { type: 'element', tagName: 'tr', attrs: { id: 'r' }, children: [cell('a'), cell('b')] }
          ]
        }
      ]
    }
    const runtime = createHTMLEngineRuntime({ engine: engineWithInter })
    const document = await runtime.computeStyles(table, '', {
      layout: true,
      viewport: { width: 800, height: 600 }
    })

    expect(elementById(document, 'r').computedStyle?.display).toBe('table-row')
    expect(elementById(document, 'b').layout?.box.x).toBe(
      (elementById(document, 'a').layout?.box.x ?? 0) + 40
    )
  })

  test("pairs a shader layer's children past the still frame the serializer writes", async () => {
    const card: DesignDocument = {
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { id: 'card', style: 'position:relative;width:200px' },
          shader: {
            preset: { components: [{ type: 'Swirl' }] },
            frame: 'data:image/png;base64,AAAA'
          },
          children: [
            {
              type: 'element',
              tagName: 'p',
              attrs: { id: 'title', style: 'margin:0;height:30px' },
              children: []
            }
          ]
        }
      ]
    }
    const runtime = createHTMLEngineRuntime({ engine: engineWithInter })
    const document = await runtime.computeStyles(card, '', {
      layout: true,
      viewport: { width: 800, height: 600 }
    })

    expect(elementById(document, 'title').layout?.box.height).toBe(30)
  })

  test('reports a value a stylesheet sets back to its initial one over an inline style', async () => {
    const document = await styled(
      '<style>#box { opacity: 1 !important }</style><div id="box" style="opacity:0.5"></div>'
    )

    expect(elementById(document, 'box').computedStyle?.opacity).toBe('1')
  })

  test('pairs past SVG elements whose names the parser keeps mixed-case', async () => {
    const document = await styled(
      `<svg width="40" height="20"><defs><linearGradient id="g"></linearGradient></defs>
        <rect id="r" width="30" height="10" style="display:inline"></rect></svg>`
    )

    expect(elementById(document, 'g').computedStyle).toBeDefined()
    expect(elementById(document, 'r').computedStyle).toBeDefined()
  })

  test('counts a line of spaces where white space is kept', async () => {
    const document = await styled(
      '<pre id="p" style="font:16px sans-serif;margin:0">one\n   \ntwo</pre>'
    )

    expect(elementById(document, 'p').layout?.lines).toHaveLength(3)
  })

  test('passes each @font-face font the page loads to the host, decoded', async () => {
    const woff2 = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Faces.woff2')).bytes()
    const faces: { family: string; weight: number; italic: boolean; signature: string }[] = []
    const runtime = createHTMLEngineRuntime({
      engine: engineWithInter,
      baseURL: 'https://example.com/',
      fetch: async (url) => {
        if (url.endsWith('site.css')) {
          return {
            url,
            contentType: 'text/css; charset=utf-8',
            bytes: new TextEncoder().encode(
              '@font-face { font-family: Brand; src: url(fonts/brand.woff2); font-weight: 700 }'
            )
          }
        }
        return url.endsWith('brand.woff2') ? { url, bytes: woff2 } : null
      },
      onFontFace: (face) => {
        const signature = [...face.bytes.subarray(0, 4)].map((byte) => byte.toString(16)).join('')
        faces.push({ family: face.family, weight: face.weight, italic: face.italic, signature })
      }
    })
    await htmlToDesignDocument('<p style="font-family: Brand">Words</p>', {
      runtime,
      cssText: '@import url("site.css");'
    })

    // Decompressed from WOFF2 to TrueType, which starts with version 1.0.
    expect(faces).toEqual([{ family: 'Brand', weight: 700, italic: false, signature: '0100' }])
  })

  test('passes a font to every rule that loads it, from stylesheets of any name', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    const families: string[] = []
    const runtime = createHTMLEngineRuntime({
      engine: engineWithInter,
      baseURL: 'https://example.com/',
      // Served without a content type, under a name without `.css`: known as CSS because CSS imports it.
      fetch: async (url) => {
        if (url.endsWith('/styles')) {
          return {
            url,
            bytes: new TextEncoder().encode(
              `@font-face { font-family: Brand; src: url(brand.ttf) }
              @font-face { font-family: 'Brand Alias'; src: url(brand.ttf) }`
            )
          }
        }
        return url.endsWith('brand.ttf') ? { url, bytes: font } : null
      },
      onFontFace: (face) => {
        families.push(face.family)
      }
    })
    await htmlToDesignDocument('<p style="font-family: Brand">Words</p>', {
      runtime,
      cssText: '@import url("styles");'
    })

    expect(families.toSorted()).toEqual(['Brand', 'Brand Alias'])
  })

  test('leaves layout out unless asked', async () => {
    const document = await htmlToDesignDocument('<div id="box"></div>', {
      runtime: createHTMLEngineRuntime()
    })

    expect(elementById(document, 'box').layout).toBeUndefined()
  })
})
