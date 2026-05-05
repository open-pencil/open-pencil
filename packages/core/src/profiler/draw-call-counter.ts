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
    if (!gl) return

    for (const method of DRAW_METHODS) {
      const original = gl[method].bind(gl) as DrawFunction
      this.originals.set(method, original)
      ;(gl[method] as DrawFunction) = (...args: unknown[]) => {
        this.count++
        original(...args)
      }
    }
  }

  reset(): number {
    const prev = this.count
    this.count = 0
    return prev
  }

  destroy(): void {
    const gl = this.gl
    if (!gl) return

    for (const [method, fn] of this.originals) {
      ;(gl[method] as DrawFunction) = fn
    }
    this.originals.clear()
  }
}
