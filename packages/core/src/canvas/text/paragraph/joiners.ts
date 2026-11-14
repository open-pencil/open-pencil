import { utf8Length } from '#core/text/utf8'

// U+2060 would join too, but Inter lacks it and Skia then seeks a fallback on every layout.
export const JOINER = '\uFEFF'
const JOINER_UTF8_LENGTH = utf8Length(JOINER)

const HARD_BREAKS = new Set([0x0a, 0x0b, 0x0c, 0x0d, 0x85, 0x2028, 0x2029])
// ICU's u_isWhitespace, which Skia leaves off a line's end: the no-break spaces are not in it.
const SKIA_WHITESPACE = new Set([
  0x09, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
  0x2006, 0x2008, 0x2009, 0x200a, 0x205f, 0x3000
])

export interface Joiner {
  at: number
  spacing: number
  tailEnd: number
}

export type JoinerUnits = 'utf16' | 'utf8'

export function lineEndJoiners(text: string, spacingAfter: (index: number) => number): Joiner[] {
  const joiners: Joiner[] = []
  let lastInk = -1
  const close = (tailEnd: number) => {
    const spacing = lastInk < 0 ? 0 : spacingAfter(lastInk)
    if (spacing !== 0) {
      joiners.push({ at: lastInk + 1, spacing, tailEnd })
    }
    lastInk = -1
  }
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (HARD_BREAKS.has(code)) {
      close(index + 1)
    } else if (!SKIA_WHITESPACE.has(code)) {
      lastInk = index
    }
  }
  close(text.length)
  return joiners
}

function countBelow(values: Int32Array, bound: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (values[middle] < bound) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

class JoinerPlaces {
  readonly inParagraph: Int32Array

  constructor(
    readonly inText: Int32Array,
    readonly width: number
  ) {
    this.inParagraph = inText.map((at, count) => at + width * count)
  }

  paragraphOffset(offset: number): number {
    return offset + this.width * countBelow(this.inText, offset)
  }

  textOffset(offset: number): number {
    const before = countBelow(this.inParagraph, offset)
    if (before === 0) {
      return offset
    }
    const lastStart = this.inParagraph[before - 1]
    return offset - this.width * (before - 1) - Math.min(this.width, offset - lastStart)
  }

  joinerAt(offset: number): number {
    const started = countBelow(this.inParagraph, offset + 1)
    return started > 0 && offset < this.inParagraph[started - 1] + this.width ? started - 1 : -1
  }

  characterOffset(offset: number): number {
    const position = this.paragraphOffset(offset)
    return this.joinerAt(position) >= 0 ? position + this.width : position
  }
}

export class JoinerIndex {
  static readonly EMPTY = new JoinerIndex([], new Int32Array(0), new Int32Array(0))

  private readonly utf16: JoinerPlaces
  private readonly utf8: JoinerPlaces
  private readonly tailEnds: Int32Array

  private constructor(
    readonly tails: readonly Joiner[],
    utf16At: Int32Array,
    utf8At: Int32Array
  ) {
    this.utf16 = new JoinerPlaces(utf16At, 1)
    this.utf8 = new JoinerPlaces(utf8At, JOINER_UTF8_LENGTH)
    this.tailEnds = Int32Array.from(tails, (tail) => tail.tailEnd)
  }

  static of(text: string, joiners: readonly Joiner[]): JoinerIndex {
    if (joiners.length === 0) {
      return JoinerIndex.EMPTY
    }
    const utf8At = new Int32Array(joiners.length)
    let bytes = 0
    let from = 0
    for (const [count, joiner] of joiners.entries()) {
      bytes += utf8Length(text.slice(from, joiner.at))
      utf8At[count] = bytes
      from = joiner.at
    }
    return new JoinerIndex(
      joiners,
      Int32Array.from(joiners, (joiner) => joiner.at),
      utf8At
    )
  }

  get count(): number {
    return this.tails.length
  }

  private places(units: JoinerUnits): JoinerPlaces {
    return units === 'utf8' ? this.utf8 : this.utf16
  }

  paragraphOffset(offset: number, units: JoinerUnits = 'utf16'): number {
    return this.count === 0 ? offset : this.places(units).paragraphOffset(offset)
  }

  textOffset(offset: number, units: JoinerUnits = 'utf16'): number {
    return this.count === 0 ? offset : this.places(units).textOffset(offset)
  }

  joinerAt(offset: number, units: JoinerUnits = 'utf16'): Joiner | undefined {
    const index = this.count === 0 ? -1 : this.places(units).joinerAt(offset)
    return index >= 0 ? this.tails[index] : undefined
  }

  characterOffset(offset: number, units: JoinerUnits = 'utf16'): number {
    return this.count === 0 ? offset : this.places(units).characterOffset(offset)
  }

  tailAt(offset: number): Joiner | undefined {
    const started = countBelow(this.utf16.inText, offset + 1)
    const tail = started > 0 ? this.tails[started - 1] : undefined
    return tail && offset < tail.tailEnd ? tail : undefined
  }

  joinerBetween(start: number, end: number): Joiner | undefined {
    const index = countBelow(this.utf16.inParagraph, start)
    return index < this.count && this.utf16.inParagraph[index] < end ? this.tails[index] : undefined
  }

  tailsBetween(start: number, end: number): Joiner[] {
    const found: Joiner[] = []
    for (let index = countBelow(this.tailEnds, start + 1); index < this.count; index++) {
      const tail = this.tails[index]
      if (tail.at >= end) {
        break
      }
      found.push(tail)
    }
    return found
  }
}

export function sliceJoiners(joiners: readonly Joiner[], from: number, to: number): Joiner[] {
  return joiners
    .filter((joiner) => joiner.at > from && joiner.at <= to)
    .map((joiner) => ({
      ...joiner,
      at: joiner.at - from,
      tailEnd: Math.min(joiner.tailEnd, to) - from
    }))
}
