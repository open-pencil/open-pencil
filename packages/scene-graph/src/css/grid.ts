import valueParser, { type FunctionNode, type Node } from 'postcss-value-parser'

import type { GridTrack } from '../types'

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
  if (!dimension) return autoTrack()
  const value = Number(dimension.number)
  if (dimension.unit === 'fr') return { sizing: 'FR', value: value || 1 }
  if (dimension.unit === '' || dimension.unit === 'px') return { sizing: 'FIXED', value }
  return autoTrack()
}

function functionTracks(node: FunctionNode): GridTrack[] {
  const [first = [], second = [], ...rest] = argumentsOf(node)
  switch (node.value.toLowerCase()) {
    case 'repeat': {
      const count = Number(first.find((child) => child.type === 'word')?.value)
      // `auto-fill` and `auto-fit` depend on the container, which a track list cannot know.
      if (!Number.isInteger(count) || count < 1) return [autoTrack()]
      const tracks = tracksOf([second, ...rest].flat())
      return Array.from({ length: Math.min(count, MAX_REPEATED_TRACKS) }, () =>
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

function tracksOf(nodes: Node[]): GridTrack[] {
  return nodes.flatMap((node) => {
    if (node.type === 'word') return [wordTrack(node.value)]
    if (node.type === 'function') return functionTracks(node)
    return []
  })
}

/** The tracks of a CSS track list, such as `repeat(3, minmax(0, 1fr)) 120px auto`. */
export function parseCSSGridTracks(value: string): GridTrack[] {
  return tracksOf(valueParser(value).nodes)
}
