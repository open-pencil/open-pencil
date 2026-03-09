interface EXTDisjointTimerQuery {
  TIME_ELAPSED_EXT: 0x88bf
  GPU_DISJOINT_EXT: 0x8fbb
}

const MAX_PENDING_QUERIES = 4

export class GPUTimer {
  private gl: WebGL2RenderingContext | null
  private ext: EXTDisjointTimerQuery | null = null
  private pending: WebGLQuery[] = []
  private activeQuery: WebGLQuery | null = null
  private _lastGpuTimeMs = NaN

  get available(): boolean {
    return this.ext !== null
  }

  get lastGpuTimeMs(): number {
    return this._lastGpuTimeMs
  }

  constructor(gl: WebGL2RenderingContext | null) {
    this.gl = gl
    if (gl) {
      this.ext =
        (gl.getExtension('EXT_disjoint_timer_query_webgl2') as EXTDisjointTimerQuery | null) ??
        null
    }
  }

  beginFrame(): void {
    if (!this.gl || !this.ext) return
    if (this.pending.length >= MAX_PENDING_QUERIES) return

    const query = this.gl.createQuery()

    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query)
    this.activeQuery = query
  }

  endFrame(): void {
    if (!this.gl || !this.ext || !this.activeQuery) return

    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
    this.pending.push(this.activeQuery)
    this.activeQuery = null
  }

  pollResults(): number | null {
    if (!this.gl || !this.ext) return null

    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean

    let result: number | null = null
    const remaining: WebGLQuery[] = []

    for (const query of this.pending) {
      const ready = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE) as boolean

      if (ready) {
        if (!disjoint) {
          const ns = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number
          this._lastGpuTimeMs = ns / 1_000_000
          result = this._lastGpuTimeMs
        }
        this.gl.deleteQuery(query)
      } else {
        remaining.push(query)
      }
    }

    this.pending = remaining
    return result
  }

  destroy(): void {
    if (!this.gl) return

    if (this.activeQuery) {
      if (this.ext) {
        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
      }
      this.gl.deleteQuery(this.activeQuery)
      this.activeQuery = null
    }

    for (const query of this.pending) {
      this.gl.deleteQuery(query)
    }
    this.pending = []
  }
}
