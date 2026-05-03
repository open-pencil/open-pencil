import { createCaptureSession, createFrameCapture } from './capture-session'
import { DrawCallCounter } from './draw-call-counter'
import { FrameStats } from './frame/stats'
import { GPUTimer } from './gpu-timer'
import { HudController } from './hud-controller'
import { PhaseTimer } from './phase-timer'
import { exportSpeedscopeCapture } from './speedscope-export'

import type { CaptureSession } from './capture-session'
import type { FrameCapture } from './frame/capture'
import type { CanvasKit, Canvas, Typeface } from 'canvaskit-wasm'

const now = typeof performance !== 'undefined' ? () => performance.now() : () => 0

export class RenderProfiler {
  enabled = false
  hudVisible = false
  capturing = false

  readonly stats = new FrameStats()
  readonly phases = new PhaseTimer()
  readonly gpuTimer: GPUTimer
  readonly drawCallCounter: DrawCallCounter

  private readonly hud: HudController
  private captureSession: CaptureSession | null = null
  private lastCapture: FrameCapture | null = null
  private renderStartTime = 0

  constructor(ck: CanvasKit, gl: WebGL2RenderingContext | null) {
    this.gpuTimer = new GPUTimer(gl)
    this.drawCallCounter = new DrawCallCounter(gl)
    this.hud = new HudController(ck)
  }

  toggle(): void {
    this.hudVisible = !this.hudVisible
    this.enabled = this.hudVisible
    this.phases.enabled = this.enabled
  }

  beginFrame(): void {
    if (!this.enabled) return
    this.renderStartTime = now()
    this.phases.beginPhase('frame')
    this.gpuTimer.beginFrame()
    this.drawCallCounter.reset()
  }

  endFrame(): void {
    if (!this.enabled) return

    this.gpuTimer.endFrame()
    this.gpuTimer.pollResults()

    const cpuTime = now() - this.renderStartTime
    this.stats.gpuTime = this.gpuTimer.lastGpuTimeMs
    this.stats.drawCalls = this.drawCallCounter.count
    this.stats.recordFrame(cpuTime)

    this.phases.endPhase('frame')
  }

  beginPhase(name: string): void {
    if (!this.enabled) return
    this.phases.beginPhase(name)
  }

  endPhase(name: string): void {
    if (!this.enabled) return
    this.phases.endPhase(name)
  }

  setNodeCounts(total: number, culled: number): void {
    this.stats.totalNodes = total
    this.stats.culledNodes = culled
  }

  setCacheHit(hit: boolean): void {
    this.stats.scenePictureCacheHit = hit
  }

  beginCapture(): void {
    this.capturing = true
    this.captureSession = createCaptureSession(now())
  }

  endCapture(): FrameCapture | null {
    if (!this.capturing || !this.captureSession) return null
    this.capturing = false

    const capture = createFrameCapture(this.captureSession, this.stats, this.gpuTimer, now)
    this.lastCapture = capture
    this.captureSession = null
    return capture
  }

  beginNode(nodeId: string, name: string, type: string, culled: boolean): void {
    this.captureSession?.stack.begin(nodeId, name, type, culled)
  }

  endNode(drawCallsBefore: number): void {
    this.captureSession?.stack.end(this.drawCallCounter.count - drawCallsBefore)
  }

  getLastCapture(): FrameCapture | null {
    return this.lastCapture
  }

  exportSpeedscope(): string | null {
    return exportSpeedscopeCapture(this.lastCapture)
  }

  downloadSpeedscope(): void {
    const json = this.exportSpeedscope()
    if (!json || typeof document === 'undefined') return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `openpencil-frame-${Date.now()}.speedscope.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  setTypeface(typeface: Typeface): void {
    this.hud.setTypeface(typeface)
  }

  drawHUD(canvas: Canvas, showRulers: boolean): void {
    if (!this.hudVisible) return
    this.hud.draw(canvas, this.stats, this.phases, showRulers)
  }

  destroy(): void {
    this.gpuTimer.destroy()
    this.drawCallCounter.destroy()
    this.hud.destroy()
    this.phases.clearPhases()
  }
}
