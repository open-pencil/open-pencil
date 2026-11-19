const INITIAL_SLOTS = 1 << 12
const EMPTY_SLOT = -1
const FIBONACCI_HASH = 0x9e3779b1

export class ColorPalette {
  colors = new Uint32Array(INITIAL_SLOTS / 2)
  count = 0
  private keys = new Uint32Array(INITIAL_SLOTS)
  private indices = new Int32Array(INITIAL_SLOTS).fill(EMPTY_SLOT)
  private shift = 32 - Math.log2(INITIAL_SLOTS)

  add(color: number): void {
    const slot = this.slotOf(color)
    if (this.indices[slot] !== EMPTY_SLOT) {
      return
    }
    if (this.count === this.colors.length) {
      this.grow()
      this.add(color)
      return
    }
    this.keys[slot] = color
    this.indices[slot] = this.count
    this.colors[this.count] = color
    this.count++
  }

  indexOf(color: number): number {
    return this.indices[this.slotOf(color)]
  }

  private slotOf(color: number): number {
    const mask = this.keys.length - 1
    let slot = Math.imul(color, FIBONACCI_HASH) >>> this.shift
    while (this.indices[slot] !== EMPTY_SLOT && this.keys[slot] !== color) {
      slot = (slot + 1) & mask
    }
    return slot
  }

  private grow(): void {
    const slots = this.keys.length * 2
    const colors = this.colors
    this.colors = new Uint32Array(slots / 2)
    this.keys = new Uint32Array(slots)
    this.indices = new Int32Array(slots).fill(EMPTY_SLOT)
    this.shift--
    const count = this.count
    this.count = 0
    for (let index = 0; index < count; index++) {
      this.add(colors[index])
    }
  }
}
