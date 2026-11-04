import { expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { corePackagePath } from '#core-tests/helpers/paths'
import type { CanvasKit, FontCollection, Paragraph, TypefaceFontProvider } from 'canvaskit-wasm'

import { getCanvasKit } from '#core/canvaskit'
import { makeParagraphBuilder } from '#core/text/font/collection'
import { FontManager } from '#core/text/font/manager'

function offlineManager() {
  const manager = new FontManager()
  manager.setOnlineFontProviders({})
  return manager
}

/** A font the package ships, so the test reads real font files without Git LFS. */
function asset(file: string): Promise<ArrayBuffer> {
  return Bun.file(corePackagePath('assets', file)).arrayBuffer()
}

function style(ck: CanvasKit, family: string) {
  return new ck.ParagraphStyle({
    textStyle: {
      color: ck.BLACK,
      fontFamilies: [family],
      fontSize: 16,
      fontVariations: [{ axis: 'wght', value: 500 }]
    }
  })
}

function paragraph(ck: CanvasKit, provider: TypefaceFontProvider, family: string, text: string) {
  const builder = makeParagraphBuilder(ck, style(ck, family), provider)
  try {
    builder.addText(text)
    return builder.build()
  } finally {
    builder.delete()
  }
}

function width(p: Paragraph): number {
  try {
    p.layout(10_000)
    return p.getMaxIntrinsicWidth()
  } finally {
    p.delete()
  }
}

/** Counts the collections CanvasKit makes, and the per-paragraph ones it is asked for. */
function countCollections(ck: CanvasKit) {
  const made: Array<{ deleted: boolean }> = []
  let perParagraph = 0
  const make = ck.FontCollection.Make
  const fromProvider = ck.ParagraphBuilder.MakeFromFontProvider
  ck.FontCollection.Make = () => {
    const collection = make.call(ck.FontCollection)
    const entry = { deleted: false }
    made.push(entry)
    const remove = collection.delete.bind(collection)
    collection.delete = () => {
      entry.deleted = true
      remove()
    }
    return collection as FontCollection
  }
  ck.ParagraphBuilder.MakeFromFontProvider = (...args) => {
    perParagraph++
    return fromProvider.apply(ck.ParagraphBuilder, args)
  }
  return {
    made,
    perParagraph: () => perParagraph,
    restore() {
      ck.FontCollection.Make = make
      ck.ParagraphBuilder.MakeFromFontProvider = fromProvider
    }
  }
}

// A collection made for every paragraph instantiates a variable font's axes on a new clone each
// time, and CanvasKit keeps part of each: about 64 KB a paragraph for Noto Sans SC, whose 65,535
// glyphs filled the 2 GB heap after some 30,000 texts and aborted opening the file.
test('paragraphs of one provider share one font collection', async () => {
  const ck = await getCanvasKit()
  const manager = offlineManager()
  const provider = manager.acquireProvider(ck)
  const latin = await asset('InterVariable.ttf')
  manager.setHostFontLoader(async (family) => (family === 'Collection Sans' ? latin : null))
  await manager.loadLocalFont('Collection Sans')
  const counts = countCollections(ck)
  try {
    for (let index = 0; index < 50; index++)
      expect(width(paragraph(ck, provider, 'Collection Sans', `Text ${index}`))).toBeGreaterThan(0)
    expect(counts.made.length).toBe(1)
    expect(counts.perParagraph()).toBe(0)
  } finally {
    counts.restore()
    manager.releaseProvider(provider)
  }
})

test('a font registered after a paragraph is drawn in, not the lookup the collection kept', async () => {
  const ck = await getCanvasKit()
  const manager = offlineManager()
  const provider = manager.acquireProvider(ck)
  const fonts: Record<string, ArrayBuffer> = {
    'Stand-in Sans': await asset('NotoNaskhArabic-Regular.ttf'),
    'Late Sans': await asset('InterVariable.ttf')
  }
  manager.setHostFontLoader(async (family) => fonts[family] ?? null)
  try {
    await manager.loadLocalFont('Stand-in Sans')
    // The collection looks 'Late Sans' up before it is registered and keeps the stand-in.
    const before = width(paragraph(ck, provider, 'Late Sans', 'Hamburgefonstiv'))
    await manager.loadLocalFont('Late Sans')
    const after = width(paragraph(ck, provider, 'Late Sans', 'Hamburgefonstiv'))

    const fresh = ck.ParagraphBuilder.MakeFromFontProvider(style(ck, 'Late Sans'), provider)
    fresh.addText('Hamburgefonstiv')
    const expected = width(fresh.build())
    fresh.delete()

    expect(after).toBeCloseTo(expected, 3)
    expect(after).not.toBeCloseTo(before, 1)
  } finally {
    manager.releaseProvider(provider)
  }
})

test('a paragraph built before its collection is replaced still lays out and draws', async () => {
  const ck = await getCanvasKit()
  const manager = offlineManager()
  const provider = manager.acquireProvider(ck)
  const fonts: Record<string, ArrayBuffer> = {
    'Kept Sans': await asset('InterVariable.ttf'),
    'Later Sans': await asset('NotoNaskhArabic-Regular.ttf')
  }
  manager.setHostFontLoader(async (family) => fonts[family] ?? null)
  const surface = ck.MakeSurface(64, 64)
  try {
    await manager.loadLocalFont('Kept Sans')
    const kept = paragraph(ck, provider, 'Kept Sans', 'Kept')
    await manager.loadLocalFont('Later Sans')
    kept.layout(200)
    expect(kept.getHeight()).toBeGreaterThan(0)
    surface?.getCanvas().drawParagraph(kept, 0, 0)
    kept.delete()
  } finally {
    surface?.delete()
    manager.releaseProvider(provider)
  }
})

test('releasing the last user of a provider deletes its collection', async () => {
  const ck = await getCanvasKit()
  const manager = offlineManager()
  const provider = manager.acquireProvider(ck)
  const counts = countCollections(ck)
  try {
    width(paragraph(ck, provider, 'Any Sans', 'Text'))
    expect(counts.made.map((entry) => entry.deleted)).toEqual([false])
    manager.releaseProvider(provider)
    expect(counts.made.map((entry) => entry.deleted)).toEqual([true])
  } finally {
    counts.restore()
  }
})

test('no source builds a paragraph with a collection of its own', () => {
  const root = corePackagePath('src')
  const offenders: string[] = []
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) visit(path)
      else if (path.endsWith('.ts') && readFileSync(path, 'utf8').includes('MakeFromFontProvider('))
        offenders.push(path.slice(root.length + 1))
    }
  }
  visit(root)
  expect(offenders).toEqual([])
})
