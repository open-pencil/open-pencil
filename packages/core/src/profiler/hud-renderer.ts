import type { FrameStats } from './frame/stats'
import type { CanvasKit, Canvas, Paint, Font, Typeface } from 'canvaskit-wasm'

const BUFFER_SIZE = 120
const LINE_HEIGHT = 13
const PADDING = 6
const BAR_WIDTH = 2
const BAR_GAP = 0.5
const GRAPH_HEIGHT = 40
const MAX_SCALE_MS = 50
const BUDGET_MS = 16.67
const FAST_MS = 16.7
const SLOW_MS = 33.3
const CORNER_RADIUS = 4
const RULER_SIZE = 20
const SWATCH_SIZE = 6
const SWATCH_GAP = 3
const LEGEND_ITEM_GAP = 10
const GRAPH_WIDTH = BUFFER_SIZE * (BAR_WIDTH + BAR_GAP)
const COL_WIDTH = 130
const PANEL_WIDTH = Math.max(COL_WIDTH * 2, GRAPH_WIDTH) + PADDING * 2

export class HudRenderer {
  private bgPaint: Paint
  private textPaint: Paint
  private dimTextPaint: Paint
  private greenPaint: Paint
  private yellowPaint: Paint
  private redPaint: Paint
  private gpuPaint: Paint
  private budgetLinePaint: Paint
  private graphBgPaint: Paint
  private hudFont: Font

  constructor(private ck: CanvasKit) {
    this.bgPaint = new ck.Paint()
    this.bgPaint.setStyle(ck.PaintStyle.Fill)
    this.bgPaint.setColor(ck.Color4f(0.1, 0.1, 0.1, 0.85))
    this.bgPaint.setAntiAlias(true)

    this.textPaint = new ck.Paint()
    this.textPaint.setStyle(ck.PaintStyle.Fill)
    this.textPaint.setColor(ck.Color4f(0.9, 0.9, 0.9, 1))
    this.textPaint.setAntiAlias(true)

    this.dimTextPaint = new ck.Paint()
    this.dimTextPaint.setStyle(ck.PaintStyle.Fill)
    this.dimTextPaint.setColor(ck.Color4f(0.55, 0.55, 0.55, 1))
    this.dimTextPaint.setAntiAlias(true)

    this.greenPaint = new ck.Paint()
    this.greenPaint.setStyle(ck.PaintStyle.Fill)
    this.greenPaint.setColor(ck.Color4f(0.3, 0.85, 0.4, 1))
    this.greenPaint.setAntiAlias(true)

    this.yellowPaint = new ck.Paint()
    this.yellowPaint.setStyle(ck.PaintStyle.Fill)
    this.yellowPaint.setColor(ck.Color4f(1.0, 0.85, 0.2, 1))
    this.yellowPaint.setAntiAlias(true)

    this.redPaint = new ck.Paint()
    this.redPaint.setStyle(ck.PaintStyle.Fill)
    this.redPaint.setColor(ck.Color4f(1.0, 0.3, 0.3, 1))
    this.redPaint.setAntiAlias(true)

    this.gpuPaint = new ck.Paint()
    this.gpuPaint.setStyle(ck.PaintStyle.Fill)
    this.gpuPaint.setColor(ck.Color4f(0.4, 0.6, 1.0, 1))
    this.gpuPaint.setAntiAlias(true)

    this.budgetLinePaint = new ck.Paint()
    this.budgetLinePaint.setStyle(ck.PaintStyle.Stroke)
    this.budgetLinePaint.setStrokeWidth(1)
    this.budgetLinePaint.setColor(ck.Color4f(1, 1, 1, 0.3))
    this.budgetLinePaint.setAntiAlias(true)
    this.budgetLinePaint.setPathEffect(ck.PathEffect.MakeDash([3, 3], 0))

    this.graphBgPaint = new ck.Paint()
    this.graphBgPaint.setStyle(ck.PaintStyle.Fill)
    this.graphBgPaint.setColor(ck.Color4f(0.05, 0.05, 0.05, 0.5))
    this.graphBgPaint.setAntiAlias(true)

    this.hudFont = new ck.Font(null, 10)
  }

  setTypeface(typeface: Typeface): void {
    this.hudFont.delete()
    this.hudFont = new this.ck.Font(typeface, 10)
  }

  draw(canvas: Canvas, stats: FrameStats, phases: Map<string, number>, showRulers: boolean): void {
    const rulerOffset = showRulers ? RULER_SIZE : 0
    const hasGraph = stats.getBufferCount() > 0

    const phaseNames = [
      'render:scene',
      'render:drawPicture',
      'render:recordPicture',
      'render:volatile',
      'render:sectionTitles',
      'render:componentLabels',
      'render:selection',
      'render:rulers',
      'render:flush'
    ]
    const visiblePhases = phaseNames.filter((n) => (phases.get(n) ?? 0) > 0.01)

    const statsRows = 3
    const phaseRows = visiblePhases.length > 0 ? 1 + visiblePhases.length : 0
    const statsHeight = (statsRows + phaseRows) * LINE_HEIGHT
    const graphSection = hasGraph ? GRAPH_HEIGHT + PADDING + LINE_HEIGHT : 0
    const contentHeight = statsHeight + PADDING * 2 + graphSection

    const bgX = rulerOffset + PADDING
    const bgY = rulerOffset + PADDING

    const bgRect = this.ck.LTRBRect(bgX, bgY, bgX + PANEL_WIDTH, bgY + contentHeight)
    canvas.drawRRect(this.ck.RRectXY(bgRect, CORNER_RADIUS, CORNER_RADIUS), this.bgPaint)

    const col1 = bgX + PADDING
    const col2 = col1 + COL_WIDTH
    let y = bgY + PADDING + LINE_HEIGHT

    const fps = Math.round(stats.smoothedFps)
    const avgFrame = stats.avgFrameTime.toFixed(1)
    const avgCpu = stats.avgCpuTime.toFixed(1)
    const gpuAvailable = !Number.isNaN(stats.avgGpuTime) && stats.avgGpuTime > 0
    const avgGpu = gpuAvailable ? stats.avgGpuTime.toFixed(1) : 'n/a'
    const cacheStatus = stats.scenePictureCacheHit ? 'HIT' : 'MISS'

    canvas.drawText(`FPS: ${fps} (${avgFrame}ms)`, col1, y, this.textPaint, this.hudFont)
    canvas.drawText(
      `Nodes: ${stats.totalNodes} (${stats.culledNodes} culled)`,
      col2,
      y,
      this.textPaint,
      this.hudFont
    )
    y += LINE_HEIGHT

    canvas.drawText(`CPU: ${avgCpu}ms`, col1, y, this.textPaint, this.hudFont)
    canvas.drawText(`Draws: ${stats.drawCalls}`, col2, y, this.textPaint, this.hudFont)
    y += LINE_HEIGHT

    canvas.drawText(
      `GPU: ${avgGpu}${gpuAvailable ? 'ms' : ''}`,
      col1,
      y,
      this.textPaint,
      this.hudFont
    )
    canvas.drawText(`Cache: ${cacheStatus}`, col2, y, this.textPaint, this.hudFont)

    if (visiblePhases.length > 0) {
      y += LINE_HEIGHT
      canvas.drawText('Phases:', col1, y, this.dimTextPaint, this.hudFont)
      for (const name of visiblePhases) {
        y += LINE_HEIGHT
        const ms = (phases.get(name) ?? 0).toFixed(2)
        const label = name.replace('render:', '')
        canvas.drawText(`  ${label}: ${ms}ms`, col1, y, this.dimTextPaint, this.hudFont)
      }
    }

    if (hasGraph) {
      const graphX = bgX + PADDING
      const graphY = y + PADDING
      this.drawBarGraph(canvas, stats, graphX, graphY)
      this.drawLegendRow(canvas, graphX, graphY + GRAPH_HEIGHT + LINE_HEIGHT - 2)
    }
  }

  private drawLegendRow(canvas: Canvas, x: number, y: number): void {
    const items: [Paint, string][] = [
      [this.greenPaint, '60fps'],
      [this.yellowPaint, '30fps'],
      [this.redPaint, 'slow'],
      [this.gpuPaint, 'GPU']
    ]
    let cx = x
    for (const [paint, label] of items) {
      const swatchY = y - SWATCH_SIZE + 1
      canvas.drawRect(this.ck.LTRBRect(cx, swatchY, cx + SWATCH_SIZE, swatchY + SWATCH_SIZE), paint)
      cx += SWATCH_SIZE + SWATCH_GAP
      canvas.drawText(label, cx, y, this.dimTextPaint, this.hudFont)
      cx += label.length * 5.5 + LEGEND_ITEM_GAP
    }
  }

  private drawBarGraph(canvas: Canvas, stats: FrameStats, graphX: number, graphY: number): void {
    const graphRect = this.ck.LTRBRect(graphX, graphY, graphX + GRAPH_WIDTH, graphY + GRAPH_HEIGHT)
    canvas.drawRRect(this.ck.RRectXY(graphRect, 2, 2), this.graphBgPaint)

    const cpuHistory = stats.getCpuTimeHistory()
    const gpuHistory = stats.getGpuTimeHistory()
    const bufferCount = stats.getBufferCount()
    const bufferIndex = stats.getBufferIndex()

    const barOffset = BUFFER_SIZE - bufferCount

    for (let i = 0; i < bufferCount; i++) {
      const histIndex = (bufferIndex + i) % BUFFER_SIZE

      const cpuTime = cpuHistory[histIndex]
      if (cpuTime <= 0) continue

      const barHeight = Math.min((cpuTime / MAX_SCALE_MS) * GRAPH_HEIGHT, GRAPH_HEIGHT)
      const barX = graphX + (i + barOffset) * (BAR_WIDTH + BAR_GAP)
      const barY = graphY + GRAPH_HEIGHT - barHeight

      let paint: Paint
      if (cpuTime < FAST_MS) {
        paint = this.greenPaint
      } else if (cpuTime < SLOW_MS) {
        paint = this.yellowPaint
      } else {
        paint = this.redPaint
      }

      canvas.drawRect(this.ck.LTRBRect(barX, barY, barX + BAR_WIDTH, graphY + GRAPH_HEIGHT), paint)

      const gpuTime = gpuHistory[histIndex]
      if (!Number.isNaN(gpuTime) && gpuTime > 0) {
        const gpuBarHeight = Math.min((gpuTime / MAX_SCALE_MS) * GRAPH_HEIGHT, GRAPH_HEIGHT)
        canvas.drawRect(
          this.ck.LTRBRect(
            barX,
            graphY + GRAPH_HEIGHT - gpuBarHeight,
            barX + BAR_WIDTH,
            graphY + GRAPH_HEIGHT
          ),
          this.gpuPaint
        )
      }
    }

    const budgetY = graphY + GRAPH_HEIGHT - (BUDGET_MS / MAX_SCALE_MS) * GRAPH_HEIGHT
    canvas.drawLine(graphX, budgetY, graphX + GRAPH_WIDTH, budgetY, this.budgetLinePaint)
  }

  destroy(): void {
    this.bgPaint.delete()
    this.textPaint.delete()
    this.dimTextPaint.delete()
    this.greenPaint.delete()
    this.yellowPaint.delete()
    this.redPaint.delete()
    this.gpuPaint.delete()
    this.budgetLinePaint.delete()
    this.graphBgPaint.delete()
    this.hudFont.delete()
  }
}
