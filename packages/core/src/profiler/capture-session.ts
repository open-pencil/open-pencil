import { CaptureStack } from './frame/capture'

import type { FrameCapture } from './frame/capture'
import type { FrameStats } from './frame/stats'
import type { GPUTimer } from './gpu-timer'

export type CaptureSession = {
  stack: CaptureStack
  frameStart: number
}

export function createCaptureSession(frameStart: number): CaptureSession {
  const stack = new CaptureStack()
  stack.reset(frameStart)
  return { stack, frameStart }
}

export function createFrameCapture(
  session: CaptureSession,
  stats: FrameStats,
  gpuTimer: GPUTimer,
  now: () => number
): FrameCapture {
  return {
    timestamp: session.frameStart,
    totalTimeMs: now() - session.frameStart,
    cpuTimeMs: stats.cpuTime,
    gpuTimeMs: gpuTimer.lastGpuTimeMs,
    totalNodes: stats.totalNodes,
    culledNodes: stats.culledNodes,
    drawCalls: stats.drawCalls,
    scenePictureCacheHit: stats.scenePictureCacheHit,
    rootProfiles: session.stack.getRootProfiles()
  }
}
