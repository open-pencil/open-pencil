import { compareReference, digestOf, type DriftState } from './compare'
import { withReference, type DriftFile, type DriftReference } from './schema'

/** What a capture answers: the picture's bytes and the size it was taken at. */
export type CapturedPage = {
  bytes: Uint8Array
  width: number
  height: number
}

/** Takes the picture of one page. Injected, so the comparison runs without a renderer. */
export type PageCapture = (target: BaselineTarget) => Promise<CapturedPage | null>

/** The frame a baseline belongs to, the page its picture shows, and the size it shows it at. */
export type BaselineTarget = {
  nodeId: string
  url: string
  /** The frame's size, since a page is drawn at the size the canvas shows it. */
  width?: number
  height?: number
}

/** How one frame stands to its baseline after a comparison. */
export type CompareOutcome = {
  nodeId: string
  state: DriftState
}

/**
 * Keep the picture of one page as its baseline. A page that could not be captured leaves the set
 * as it was, so a failed render never erases a baseline that still describes the page.
 */
export async function setBaseline(
  file: DriftFile,
  target: BaselineTarget,
  capture: PageCapture
): Promise<DriftFile> {
  const captured = await captureOrNull(capture, target)
  if (captured === null) return file
  const reference: DriftReference = {
    nodeId: target.nodeId,
    url: target.url,
    capturedAt: new Date().toISOString(),
    width: captured.width,
    height: captured.height,
    digest: await digestOf(captured.bytes)
  }
  return withReference(file, reference)
}

/**
 * The picture a target answers, or null when it could not be drawn at all. A capture that throws
 * is one page that did not arrive, not a comparison that never ran.
 */
async function captureOrNull(
  capture: PageCapture,
  target: BaselineTarget
): Promise<CapturedPage | null> {
  try {
    return await capture(target)
  } catch (error) {
    console.warn('[Drift] A page could not be drawn:', target.url, error)
    return null
  }
}

/**
 * Compare every frame that shows a page with the baseline kept for it. A page that could not be
 * captured answers `none`, which reads as "nothing to compare" rather than as a drift.
 */
export async function comparePages(
  file: DriftFile,
  targets: readonly BaselineTarget[],
  capture: PageCapture
): Promise<CompareOutcome[]> {
  const outcomes: CompareOutcome[] = []
  for (const target of targets) {
    const captured = await captureOrNull(capture, target)
    const digest = captured === null ? null : await digestOf(captured.bytes)
    outcomes.push({
      nodeId: target.nodeId,
      state: digest === null ? 'none' : compareReference(file.references[target.nodeId], digest)
    })
  }
  return outcomes
}
