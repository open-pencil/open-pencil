import type { CanvasKit, Canvas, Font } from '@open-pencil/canvaskit'

import type { FrameStats } from './frame/stats'
import { HudRenderer } from './hud-renderer'
import type { PhaseTimer } from './phase-timer'

export class HudController {
  private hud: HudRenderer | null = null
  private font: Font | null = null

  constructor(private ck: CanvasKit) {}

  /** Borrows `font` for the HUD's text; its owner deletes it. */
  setFont(font: Font): void {
    this.font = font
    this.hud?.setFont(font)
  }

  draw(canvas: Canvas, stats: FrameStats, phases: PhaseTimer, showRulers: boolean): void {
    if (!this.hud) {
      this.hud = new HudRenderer(this.ck)
      if (this.font) this.hud.setFont(this.font)
    }
    this.hud.draw(canvas, stats, phases.averages, showRulers)
  }

  destroy(): void {
    this.hud?.destroy()
    this.hud = null
    this.font = null
  }
}
