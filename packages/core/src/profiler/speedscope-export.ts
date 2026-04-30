import { toSpeedscopeJSON } from './frame/capture'

import type { FrameCapture } from './frame/capture'

export function exportSpeedscopeCapture(capture: FrameCapture | null): string | null {
  return capture ? toSpeedscopeJSON(capture) : null
}
