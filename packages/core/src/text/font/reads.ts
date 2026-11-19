import { loadHarfBuzz } from '#core/text/font/harfbuzz'

/**
 * Shares the in-flight and successful reads of a key, and forgets a null answer so it can be
 * retried. A host or browser read copies the whole face again each time, tens of megabytes for a
 * system CJK face, only for registration to find the same bytes and drop it.
 */
export class SharedReads {
  private readonly reads = new Map<string, Promise<ArrayBuffer | null>>()

  read(key: string, load: () => Promise<ArrayBuffer | null>): Promise<ArrayBuffer | null> {
    const existing = this.reads.get(key)
    if (existing) return existing
    const pending = load()
    this.reads.set(key, pending)
    void pending.then((data) => {
      if (!data && this.reads.get(key) === pending) this.reads.delete(key)
      return undefined
    })
    return pending
  }

  clear(): void {
    this.reads.clear()
  }
}

/** Whether two font files hold the same bytes, as one downloaded or read again does. */
export function sameFontFile(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a === b) return true
  if (a.byteLength !== b.byteLength) return false
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false
  return true
}

/** `load`'s answer once HarfBuzz has loaded too, the two loading side by side. */
export async function withHarfBuzz<T>(load: Promise<T>): Promise<T> {
  const [answer] = await Promise.all([load, loadHarfBuzz()])
  return answer
}
