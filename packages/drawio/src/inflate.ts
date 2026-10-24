import { Inflate } from 'fflate'

/**
 * The most a file's compressed parts may unpack to, all together, so a small crafted file with
 * many diagrams or image chunks cannot exhaust memory.
 */
export const MAX_INFLATED_BYTES = 32 * 1024 * 1024
/** Input fed per step; deflate expands at most about 1032 times, so each step stays small. */
const STEP_BYTES = 4096

/** What is left of a file's unpacking allowance, shared by every part it unpacks. */
export interface InflateBudget {
  remaining: number
}

export function inflateBudget(bytes = MAX_INFLATED_BYTES): InflateBudget {
  return { remaining: bytes }
}

/** Raw deflate, charged to `budget`; throws once the file would unpack to more than it allows. */
export function boundedInflate(data: Uint8Array, budget: InflateBudget): Uint8Array {
  const chunks: Uint8Array[] = []
  let size = 0
  const inflater = new Inflate((chunk) => {
    size += chunk.length
    budget.remaining -= chunk.length
    if (budget.remaining < 0) throw new RangeError('The draw.io file unpacks to too much data')
    chunks.push(chunk)
  })
  for (let start = 0; start < data.length; start += STEP_BYTES) {
    const end = start + STEP_BYTES
    inflater.push(data.subarray(start, end), end >= data.length)
  }
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

/** A `%` that does not start an escape, as in "50% done". */
const STRAY_PERCENT = /%(?![0-9A-Fa-f]{2})/g
/** A run of escapes, decoded together so a character spread over several bytes stays whole. */
const ESCAPE_RUN = /(?:%[0-9A-Fa-f]{2})+/g

/**
 * The text with its percent escapes decoded. A stray `%` is kept as it is, and an escape run that
 * is not valid UTF-8 stays encoded, so neither stops the rest of the text from decoding.
 */
export function percentDecoded(text: string): string {
  const escaped = text.replace(STRAY_PERCENT, '%25')
  try {
    return decodeURIComponent(escaped)
  } catch {
    return escaped.replace(ESCAPE_RUN, (run) => {
      try {
        return decodeURIComponent(run)
      } catch {
        return run
      }
    })
  }
}
