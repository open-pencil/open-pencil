const DRAW_METHODS = [
  'drawArrays',
  'drawElements',
  'drawArraysInstanced',
  'drawElementsInstanced'
] as const

type DrawMethod = (typeof DRAW_METHODS)[number]
type DrawFunction = (...args: unknown[]) => void

export class DrawCallCounter {
  count = 0

  private originals = new Map<DrawMethod, DrawFunction>()
  private gl: WebGL2RenderingContext | null

  constructor(gl: WebGL2RenderingContext | null) {
    this.gl = gl
  }

  enable(): void {
    const gl = this.gl
    if (!gl || this.originals.size > 0) return

    for (const method of DRAW_METHODS) {
      const original = gl[method] as DrawFunction
      this.originals.set(method, original)
      ;(gl[method] as DrawFunction) = (...args: unknown[]) => {
        this.count++
        original.apply(gl, args)
      }
    }
  }

  disable(): void {
    const gl = this.gl
    if (!gl || this.originals.size === 0) return

    for (const [method, fn] of this.originals) {
      ;(gl[method] as DrawFunction) = fn
    }
    this.originals.clear()
  }

  reset(): number {
    const prev = this.count
    this.count = 0
    return prev
  }

  destroy(): void {
    this.disable()
    this.gl = null
  }
}
