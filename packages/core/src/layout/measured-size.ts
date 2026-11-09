import { clampLayoutLength } from '@open-pencil/scene-graph/layout'

let measurementFailureReported = false

/** A size no larger than layout can place, and never a non-finite one. */
function bounded(size: { width: number; height: number }): { width: number; height: number } {
  return { width: clampLayoutLength(size.width), height: clampLayoutLength(size.height) }
}

function reportMeasurementFailure(error: unknown): void {
  if (measurementFailureReported) return
  measurementFailureReported = true
  console.warn('Text measurement failed; the text keeps the size it has', error)
}

/**
 * A text measurement for Yoga's measure callback. Yoga calls that callback from WASM, and an
 * exception unwinds its frames without restoring the WASM stack pointer, which leaves every
 * later call reading or writing out of bounds (a `Node.create` then fails). So a measurement
 * that throws, or that is not a finite size, reports the size the text already has. Either size
 * leaves here bounded, since a stored size can be one a file got wrong.
 */
export function measuredSize(
  fallback: () => { width: number; height: number },
  measure: () => { width: number; height: number }
): { width: number; height: number } {
  let size: { width: number; height: number }
  try {
    size = measure()
  } catch (error) {
    reportMeasurementFailure(error)
    return bounded(fallback())
  }
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
    reportMeasurementFailure(new Error(`Measured size ${size.width}×${size.height} is not finite`))
    return bounded(fallback())
  }
  return bounded(size)
}
