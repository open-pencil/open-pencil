---
pageClass: guide
title: Pen Tool
description: Draw paths of straight lines and curves with the pen, or draw freehand with the pencil.
---

# Pen Tool

The pen draws a path point by point: straight lines, curves, or both. The pencil draws freehand, as you would on paper.

## Draw a Path

1. Press <Keys mac="P" other="P" />.
2. Click to place a point. Each click adds a straight line from the last point.
3. Drag instead of clicking to make a curve. The direction and length of the drag set its shape. Hold <Keys mac="Space" other="Space" /> while dragging to move the point itself.
4. Finish the path:
   - Click the first point to close it into a shape, which can have a fill.
   - Press <Keys mac="Esc" other="Esc" /> or <Keys mac="Enter" other="Enter" /> to leave it open, as a line.

<GuidePair>

<GuideImage name="pen-tool/drawing" alt="A path being drawn: two points placed, a curve with its handles, and a line to the pointer" caption="While drawing" />
<GuideImage name="pen-tool/done" alt="The finished open path, selected" caption="The finished path" />

</GuidePair>

While drawing, <Keys mac="⌘ Z" other="Ctrl Z" /> takes back the last point. To change a path later, [edit its points](./vector-edit).

## Draw Freehand

Press <Keys mac="⇧ P" other="Shift P" />, or choose **Pencil** in the pen's menu in the toolbar, and drag.

- Each stroke becomes its own path, smoothed into curves you can edit like any other path. The pencil stays on for the next stroke.
- Hold <Keys mac="⇧" other="Shift" /> to draw straight across or down from where you pressed it.
- End a stroke where it started to close it into a shape.
- Zoom in to keep more detail: the curve follows your hand to within a few pixels on screen.
- A stroke goes into the frame that holds all of it, otherwise onto the page.
- A new stroke's color stands out from what it's drawn on. Change the stroke of the last one you drew, and the next ones keep that style.
