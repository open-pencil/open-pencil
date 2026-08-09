import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import type { RenderedPixels } from '@open-pencil/core/io'

import { getSlideThumbnail, isBlankThumbnail } from '@/app/editor/thumbnails/cache'
import {
  pruneStoredThumbnails,
  pruneThumbnailsForMissingDocuments,
  readStoredThumbnail,
  writeStoredThumbnail
} from '@/app/editor/thumbnails/store'

const WIDTH = 288
const HEIGHT = 162

/** What the renderer hands back when the document has not been drawn yet. */
function blankRender(): RenderedPixels {
  return { pixels: new Uint8Array(WIDTH * HEIGHT * 4), width: WIDTH, height: HEIGHT }
}

/** A render with content in it: every pixel differs from its neighbours. */
function drawnRender(): RenderedPixels {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
    pixels[pixel * 4] = pixel % 251
    pixels[pixel * 4 + 1] = (pixel * 7) % 251
    pixels[pixel * 4 + 2] = (pixel * 13) % 251
    pixels[pixel * 4 + 3] = 255
  }
  return { pixels, width: WIDTH, height: HEIGHT }
}

/** Persistence is deliberately fire-and-forget, so give the write a chance to land. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1)
    })
  }
}

describe('slide thumbnail cache', () => {
  test('detects a frame of one colour whatever its uniform column layout', () => {
    expect(isBlankThumbnail(blankRender())).toBe(true)
    expect(isBlankThumbnail(drawnRender())).toBe(false)

    // A width of 97 makes a 97-pixel stride sample column 0 and nothing else, so an image
    // whose first column happens to be uniform would read as blank. The stride has to step
    // off that column instead.
    const width = 97
    const height = 8
    const pixels = new Uint8Array(width * height * 4).fill(200)
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      if (pixel % width !== 0) pixels[pixel * 4] = 30
    }
    expect(isBlankThumbnail({ pixels, width, height })).toBe(false)
  })

  test('never caches or persists a blank render, and re-renders on the next request', async () => {
    let renders = 0
    let result: RenderedPixels = blankRender()
    const render = async () => {
      renders += 1
      return result
    }

    const first = await getSlideThumbnail('deck-blank', 'page-1', render)
    expect(renders).toBe(1)
    expect(first.image).toBeNull()
    await settle()
    expect(await readStoredThumbnail('deck-blank:page-1')).toBeNull()

    // Neither cache holds the blank, so the same request renders again rather than
    // handing back the empty frame it just produced.
    const second = await getSlideThumbnail('deck-blank', 'page-1', render)
    expect(renders).toBe(2)
    expect(second.image).toBeNull()

    // Once the document is drawable the retry succeeds and is kept.
    result = drawnRender()
    const third = await getSlideThumbnail('deck-blank', 'page-1', render)
    expect(renders).toBe(3)
    expect(third.image).toEqual(result)
    await settle()
    expect(await readStoredThumbnail('deck-blank:page-1')).toEqual(result)

    // And the good render is served from memory without rendering again.
    const fourth = await getSlideThumbnail('deck-blank', 'page-1', render)
    expect(renders).toBe(3)
    expect(fourth.image).toEqual(result)
  })

  test('while a document loads, stored thumbnails still show but nothing is rendered', async () => {
    const stored = drawnRender()
    await writeStoredThumbnail('deck-defer:page-stored', stored)

    let renders = 0
    const render = async () => {
      renders += 1
      return drawnRender()
    }

    // A slide that already has a thumbnail shows it at once rather than waiting out the
    // load behind a placeholder, and no render is queued to correct it yet.
    const known = await getSlideThumbnail('deck-defer', 'page-stored', render, { defer: true })
    expect(known.image).toEqual(stored)
    expect(known.refresh).toBeNull()
    expect(renders).toBe(0)

    // A slide with nothing stored draws nothing: rendering now is what produced the blank.
    const unknown = await getSlideThumbnail('deck-defer', 'page-new', render, { defer: true })
    expect(unknown.image).toBeNull()
    expect(renders).toBe(0)

    // Once loading clears, the same request renders it.
    const loaded = await getSlideThumbnail('deck-defer', 'page-new', render)
    expect(renders).toBe(1)
    expect(loaded.image).not.toBeNull()
  })

  test('pruning drops a document’s dead pages and leaves every other document alone', async () => {
    const image = drawnRender()
    await writeStoredThumbnail('doc-a:live-1', image)
    await writeStoredThumbnail('doc-a:live-2', image)
    await writeStoredThumbnail('doc-a:dead-1', image)
    await writeStoredThumbnail('doc-a:dead-2', image)
    await writeStoredThumbnail('doc-b:live-1', image)

    expect(await pruneStoredThumbnails('doc-a', ['live-1', 'live-2'])).toBe(2)
    expect(await readStoredThumbnail('doc-a:live-1')).not.toBeNull()
    expect(await readStoredThumbnail('doc-a:live-2')).not.toBeNull()
    expect(await readStoredThumbnail('doc-a:dead-1')).toBeNull()
    expect(await readStoredThumbnail('doc-a:dead-2')).toBeNull()

    // A prefix match must not reach past the document it names.
    expect(await readStoredThumbnail('doc-b:live-1')).not.toBeNull()
  })

  test('an empty page list prunes nothing, so an unloaded document keeps its thumbnails', async () => {
    const image = drawnRender()
    await writeStoredThumbnail('doc-unloaded:page-1', image)

    // The dangerous reading of "no pages" is "delete them all". A document whose pages have
    // not arrived yet must come out of this untouched.
    expect(await pruneStoredThumbnails('doc-unloaded', [])).toBe(0)
    expect(await readStoredThumbnail('doc-unloaded:page-1')).not.toBeNull()
  })

  test('a deleted workspace document loses its thumbnails, a kept one does not', async () => {
    const image = drawnRender()
    const kept = '69bfb0ac-369d-468f-97e5-6bdfb8e05425'
    const deleted = 'e6e7d62a-9f83-4edc-bf32-0f3bb78363bc'
    await writeStoredThumbnail(`${kept}:0:5`, image)
    await writeStoredThumbnail(`${deleted}:0:5`, image)
    await writeStoredThumbnail(`${deleted}:0:12`, image)

    expect(await pruneThumbnailsForMissingDocuments([kept])).toBe(2)
    expect(await readStoredThumbnail(`${kept}:0:5`)).not.toBeNull()
    expect(await readStoredThumbnail(`${deleted}:0:5`)).toBeNull()
    expect(await readStoredThumbnail(`${deleted}:0:12`)).toBeNull()
  })

  test('documents the workspace does not track survive the sweep', async () => {
    const image = drawnRender()
    const listed = '69bfb0ac-369d-468f-97e5-6bdfb8e05425'
    await writeStoredThumbnail(`${listed}:0:5`, image)
    await writeStoredThumbnail('/Users/someone/Decks/talk.deck:0:5', image)
    await writeStoredThumbnail('C:\\Decks\\talk.deck:0:5', image)
    await writeStoredThumbnail('My Untitled Deck:0:5', image)

    // These are keyed by path or display name because they have no workspace row at all.
    // Absent from the list is their normal state, not evidence that they were deleted.
    expect(await pruneThumbnailsForMissingDocuments([listed])).toBe(0)
    expect(await readStoredThumbnail('/Users/someone/Decks/talk.deck:0:5')).not.toBeNull()
    expect(await readStoredThumbnail('C:\\Decks\\talk.deck:0:5')).not.toBeNull()
    expect(await readStoredThumbnail('My Untitled Deck:0:5')).not.toBeNull()
  })

  test('a document list that failed to load prunes nothing', async () => {
    const image = drawnRender()
    const id = '69bfb0ac-369d-468f-97e5-6bdfb8e05425'
    await writeStoredThumbnail(`${id}:0:5`, image)

    // An empty list reads the same as a workspace with nothing in it, and only one of those
    // readings can be undone. It must be the cautious one.
    expect(await pruneThumbnailsForMissingDocuments([])).toBe(0)
    expect(await readStoredThumbnail(`${id}:0:5`)).not.toBeNull()
  })

  test('re-renders over a blank thumbnail left on disk by an earlier session', async () => {
    await writeStoredThumbnail('deck-legacy:page-1', blankRender())

    const drawn = drawnRender()
    let renders = 0
    const { image, refresh } = await getSlideThumbnail('deck-legacy', 'page-1', async () => {
      renders += 1
      return drawn
    })

    // The stored blank is not shown even for a frame: it falls through to a render.
    expect(renders).toBe(1)
    expect(refresh).toBeNull()
    expect(image).toEqual(drawn)
    await settle()
    expect(await readStoredThumbnail('deck-legacy:page-1')).toEqual(drawn)
  })
})
