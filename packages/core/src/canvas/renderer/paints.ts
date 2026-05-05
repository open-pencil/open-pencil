import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  DEFAULT_FONT_SIZE,
  PARENT_OUTLINE_ALPHA,
  PARENT_OUTLINE_DASH,
  PEN_PATH_STROKE_WIDTH,
  RULER_BG_COLOR,
  RULER_TEXT_COLOR,
  RULER_TICK_COLOR,
  SNAP_COLOR
} from '#core/constants'

export function initializeRendererPaints(r: SkiaRenderer): void {
  const ck = r.ck

  r.fillPaint = new ck.Paint()
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setAntiAlias(true)

  r.strokePaint = new ck.Paint()
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setAntiAlias(true)

  r.selectionPaint = new ck.Paint()
  r.selectionPaint.setStyle(ck.PaintStyle.Stroke)
  r.selectionPaint.setStrokeWidth(1)
  r.selectionPaint.setColor(r.selColor())
  r.selectionPaint.setAntiAlias(true)

  r.parentOutlinePaint = new ck.Paint()
  r.parentOutlinePaint.setStyle(ck.PaintStyle.Stroke)
  r.parentOutlinePaint.setStrokeWidth(1)
  r.parentOutlinePaint.setColor(r.selColor(PARENT_OUTLINE_ALPHA))
  r.parentOutlinePaint.setAntiAlias(true)
  r.parentOutlinePaint.setPathEffect(
    ck.PathEffect.MakeDash([PARENT_OUTLINE_DASH, PARENT_OUTLINE_DASH], 0)
  )

  r.snapPaint = new ck.Paint()
  r.snapPaint.setStyle(ck.PaintStyle.Stroke)
  r.snapPaint.setStrokeWidth(1)
  r.snapPaint.setColor(ck.Color4f(SNAP_COLOR.r, SNAP_COLOR.g, SNAP_COLOR.b, 1))
  r.snapPaint.setAntiAlias(true)

  r.auxFill = new ck.Paint()
  r.auxFill.setStyle(ck.PaintStyle.Fill)
  r.auxFill.setAntiAlias(true)

  r.auxStroke = new ck.Paint()
  r.auxStroke.setStyle(ck.PaintStyle.Stroke)
  r.auxStroke.setAntiAlias(true)

  r.opacityPaint = new ck.Paint()
  r.effectLayerPaint = new ck.Paint()
  r.textFont = new ck.Font(null, DEFAULT_FONT_SIZE)

  const bg = RULER_BG_COLOR
  r.rulerBgPaint = new ck.Paint()
  r.rulerBgPaint.setColor(ck.Color4f(bg.r, bg.g, bg.b, 1))

  r.rulerTickPaint = new ck.Paint()
  r.rulerTickPaint.setColor(
    ck.Color4f(RULER_TICK_COLOR.r, RULER_TICK_COLOR.g, RULER_TICK_COLOR.b, 1)
  )
  r.rulerTickPaint.setStrokeWidth(1)
  r.rulerTickPaint.setAntiAlias(true)

  const tc = RULER_TEXT_COLOR
  r.rulerTextPaint = new ck.Paint()
  r.rulerTextPaint.setColor(ck.Color4f(tc.r, tc.g, tc.b, 1))
  r.rulerTextPaint.setAntiAlias(true)

  r.rulerHlPaint = new ck.Paint()
  r.rulerHlPaint.setAntiAlias(true)

  r.rulerBadgePaint = new ck.Paint()
  r.rulerBadgePaint.setAntiAlias(true)

  r.rulerLabelPaint = new ck.Paint()
  r.rulerLabelPaint.setColor(ck.Color4f(1, 1, 1, 1))
  r.rulerLabelPaint.setAntiAlias(true)

  r.penPathPaint = new ck.Paint()
  r.penPathPaint.setStyle(ck.PaintStyle.Stroke)
  r.penPathPaint.setStrokeWidth(1)
  r.penPathPaint.setColor(ck.Color4f(0.698, 0.698, 0.698, 1))
  r.penPathPaint.setAntiAlias(true)

  r.penLiveStrokePaint = new ck.Paint()
  r.penLiveStrokePaint.setStyle(ck.PaintStyle.Stroke)
  r.penLiveStrokePaint.setStrokeWidth(PEN_PATH_STROKE_WIDTH)
  r.penLiveStrokePaint.setColor(ck.Color4f(0, 0, 0, 1))
  r.penLiveStrokePaint.setAntiAlias(true)

  r.penHandlePaint = new ck.Paint()
  r.penHandlePaint.setStyle(ck.PaintStyle.Stroke)
  r.penHandlePaint.setStrokeWidth(1)
  r.penHandlePaint.setColor(r.selColor(PARENT_OUTLINE_ALPHA))
  r.penHandlePaint.setAntiAlias(true)

  r.penVertexFill = new ck.Paint()
  r.penVertexFill.setStyle(ck.PaintStyle.Fill)
  r.penVertexFill.setColor(ck.WHITE)
  r.penVertexFill.setAntiAlias(true)

  r.penVertexStroke = new ck.Paint()
  r.penVertexStroke.setStyle(ck.PaintStyle.Stroke)
  r.penVertexStroke.setStrokeWidth(1)
  r.penVertexStroke.setColor(r.selColor())
  r.penVertexStroke.setAntiAlias(true)
}
