import { HudRenderer } from './hud-renderer'

import type { FrameStats } from './frame/stats'
import type { PhaseTimer } from './phase-timer'
import type { CanvasKit, Canvas, Typeface } from 'canvaskit-wasm'

export class HudController {
  private hud: HudRenderer | null = null
  private typeface: Typeface | null = null

  constructor(private ck: CanvasKit) {}

  setTypeface(typeface: Typeface): void {
    this.typeface = typeface
    this.hud?.setTypeface(typeface)
  }

  draw(canvas: Canvas, stats: FrameStats, phases: PhaseTimer, showRulers: boolean): void {
    if (!this.hud) {
      this.hud = new HudRenderer(this.ck)
      if (this.typeface) this.hud.setTypeface(this.typeface)
    }
    this.hud.draw(canvas, stats, phases.averages, showRulers)
  }

  destroy(): void {
    this.hud?.destroy()
    this.hud = null
  }
}
