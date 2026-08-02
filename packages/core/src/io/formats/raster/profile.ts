/**
 * Opt-in timing for the raster path.
 *
 * Rendering a slide for presentation goes through several distinct phases and the costly
 * one is not obvious from reading the code — extracting a render graph, drawing the scene,
 * downsampling, and encoding are each plausible. Rather than keep guessing, this reports
 * them separately.
 *
 * Off unless switched on at runtime, so it costs nothing in normal use:
 *
 *     window.__openPencilProfileRaster = true
 *
 * Each phase is emitted as a `performance.measure`, so it also shows up on the Timings
 * track of a Chrome performance profile alongside everything else on the main thread.
 */

const FLAG = '__openPencilProfileRaster'
const MEASURE_PREFIX = 'raster'

type ProfileHost = { [FLAG]?: boolean }

export function rasterProfilingEnabled(): boolean {
  if (typeof globalThis === 'undefined') return false
  return (globalThis as ProfileHost)[FLAG] === true
}

export interface RasterProfile {
  /** Close the previous phase and open a new one. */
  phase: (name: string) => void
  /** Close the last phase and report the run. */
  end: (detail?: Record<string, number | string>) => void
}

const noop: RasterProfile = { phase: () => {}, end: () => {} }

export function startRasterProfile(label: string): RasterProfile {
  if (!rasterProfilingEnabled() || typeof performance === 'undefined') return noop

  const started = performance.now()
  const phases: Array<{ name: string; ms: number }> = []
  let currentName: string | null = null
  let currentStart = started

  function close() {
    if (currentName === null) return
    const ms = performance.now() - currentStart
    phases.push({ name: currentName, ms })
    try {
      performance.measure(`${MEASURE_PREFIX}:${currentName}`, {
        start: currentStart,
        duration: ms
      })
    } catch {
      // Measures are a convenience for profiling; never let one break a render.
    }
    currentName = null
  }

  return {
    phase(name: string) {
      close()
      currentName = name
      currentStart = performance.now()
    },
    end(detail?: Record<string, number | string>) {
      close()
      const total = performance.now() - started
      const breakdown = phases.map(({ name, ms }) => `${name} ${ms.toFixed(1)}ms`).join('  ·  ')
      console.info(`[raster] ${label} — total ${total.toFixed(1)}ms  ·  ${breakdown}`, detail ?? '')
    }
  }
}
