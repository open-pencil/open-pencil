import valueParser, { type FunctionNode, type Node } from 'postcss-value-parser'

import { appendAll } from '@open-pencil/std/arrays'

import { MAX_GRID_TRACKS } from '../layout/limits'
import type { GridTrack } from '../types'
import { parseCSSNumber } from './values'

/** Bounds a `repeat()` count, which a typo could make huge. */
const MAX_REPEATED_TRACKS = 100

/** `auto`, and sizes a grid track cannot express, size to their content rather than to 0. */
function autoTrack(): GridTrack {
  return { sizing: 'AUTO', value: 0 }
}

/** A function's arguments, split at its commas. */
function argumentsOf(node: FunctionNode): Node[][] {
  const args: Node[][] = []
  let current: Node[] = []
  for (const child of node.nodes) {
    if (child.type === 'div' && child.value === ',') {
      args.push(current)
      current = []
    } else {
      current.push(child)
    }
  }
  args.push(current)
  return args
}

function wordTrack(word: string): GridTrack {
  const dimension = valueParser.unit(word)
  if (dimension && dimension.unit.toLowerCase() === 'fr') {
    return { sizing: 'FR', value: Number(dimension.number) || 1 }
  }
  const pixels = parseCSSNumber(word)
  return pixels === null ? autoTrack() : { sizing: 'FIXED', value: pixels }
}

function functionTracks(node: FunctionNode): GridTrack[] {
  const [first = [], second = [], ...rest] = argumentsOf(node)
  switch (node.value.toLowerCase()) {
    case 'repeat': {
      const count = Number(first.find((child) => child.type === 'word')?.value)
      // `auto-fill` and `auto-fit` depend on the container, which a track list cannot know.
      if (!Number.isInteger(count) || count < 1) return [autoTrack()]
      const tracks = tracksOf([second, ...rest].flat())
      if (tracks.length === 0) return []
      // Nested repeats multiply, so the count is bounded by the tracks a template may hold too.
      const repeats = Math.min(
        count,
        MAX_REPEATED_TRACKS,
        Math.floor(MAX_GRID_TRACKS / tracks.length)
      )
      return Array.from({ length: Math.max(1, repeats) }, () =>
        tracks.map((track) => ({ ...track }))
      ).flat()
    }
    case 'minmax':
      // The maximum decides how a track grows, as `minmax(0, 1fr)` is a 1fr column.
      return tracksOf(second)
    default:
      return [autoTrack()]
  }
}

/**
 * A word's track sizes past the line names in it, such as `[start]200px[end]`, which the value
 * parser keeps as one word; names may run across words, as in `[a b]`, so whether the word
 * starts inside them comes in and whether it ends inside them goes out.
 */
function sizesOutsideNames(word: string, inNames: boolean): { sizes: string[]; inNames: boolean } {
  const sizes: string[] = []
  let size = ''
  let names = inNames
  for (const char of word) {
    if (char === '[' || char === ']') {
      if (size) sizes.push(size)
      size = ''
      names = char === '['
    } else if (!names) {
      size += char
    }
  }
  if (size) sizes.push(size)
  return { sizes, inNames: names }
}

function tracksOf(nodes: Node[]): GridTrack[] {
  const tracks: GridTrack[] = []
  // Line names, such as `[start]` or `[a b]`, name the lines between tracks and size none.
  let inNames = false
  for (const node of nodes) {
    if (tracks.length >= MAX_GRID_TRACKS) break
    if (node.type === 'word') {
      const word = sizesOutsideNames(node.value, inNames)
      inNames = word.inNames
      appendAll(tracks, word.sizes.map(wordTrack))
    } else if (node.type === 'function') appendAll(tracks, functionTracks(node))
  }
  return tracks.slice(0, MAX_GRID_TRACKS)
}

/**
 * The tracks of a CSS track list, such as `repeat(3, minmax(0, 1fr)) 120px auto`, at most
 * `MAX_GRID_TRACKS` of them however the list nests `repeat()`.
 */
export function parseCSSGridTracks(value: string): GridTrack[] {
  return tracksOf(valueParser(value).nodes)
}
