const DRAW_METHODS = [
  'drawArrays',
  'drawElements',
  'drawArraysInstanced',
  'drawElementsInstanced'
] as const

type DrawMethod = (typeof DRAW_METHODS)[number]

export class DrawCallCounter {
  count = 0

  private originals = new Map<DrawMethod, (...args: unknown[]) => void>()
  private gl: WebGL2RenderingContext | null

  constructor(gl: WebGL2RenderingContext | null) {
    this.gl = gl
    if (!gl) return

    for (const method of DRAW_METHODS) {
      const original = gl[method].bind(gl) as (...args: unknown[]) => void
      this.originals.set(method, original)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- monkey-patching overloaded WebGL draw methods
      ;(gl[method] as Function) = (...args: unknown[]) => { this.count++; original(...args) }
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
      ;(gl[method] as Function) = fn
    }
    this.originals.clear()
  }
}
