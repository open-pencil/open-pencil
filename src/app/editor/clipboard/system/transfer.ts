const noop = () => undefined

class MemoryDataTransfer implements DataTransfer {
  private data = new Map<string, string>()

  dropEffect: 'none' | 'copy' | 'link' | 'move' = 'none'
  effectAllowed:
    | 'none'
    | 'copy'
    | 'copyLink'
    | 'copyMove'
    | 'link'
    | 'linkMove'
    | 'move'
    | 'all'
    | 'uninitialized' = 'none'
  files = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {
      yield* []
    }
  } as FileList
  items = {
    length: 0,
    add: () => null,
    clear: noop,
    remove: noop,
    [Symbol.iterator]: function* () {
      yield* []
    }
  } as DataTransferItemList

  setData(format: string, data: string): void {
    this.data.set(format, data)
  }

  getData(format: string): string {
    return this.data.get(format) ?? ''
  }

  clearData(format?: string): void {
    if (format) this.data.delete(format)
    else this.data.clear()
  }

  setDragImage(image: Element, x: number, y: number): void {
    void image
    void x
    void y
  }

  get types(): readonly string[] {
    return [...this.data.keys()]
  }
}

export function createClipboardTransfer(): DataTransfer {
  if (typeof DataTransfer !== 'undefined') {
    try {
      return new DataTransfer()
    } catch (error) {
      console.warn('DataTransfer instantiation failed', error)
    }
  }
  return new MemoryDataTransfer()
}
