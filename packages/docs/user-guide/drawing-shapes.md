---
pageClass: guide
title: Drawing Shapes
description: Draw rectangles, ellipses, lines, polygons, stars, frames, and sections, then color them and add outlines, shadows, and blurs.
---

# Drawing Shapes

The shape tools are in the toolbar at the bottom of the window. Pick one, then drag on the canvas.

## Draw a Shape

1. Press <Keys mac="R" other="R" /> for a rectangle, <Keys mac="O" other="O" /> for an ellipse, or <Keys mac="L" other="L" /> for a line. Polygons and stars are in the shape menu: click the arrow next to the rectangle.
2. Drag on the canvas. Hold <Keys mac="⇧" other="Shift" /> to draw a square or a circle, or to keep a line at steps of 45°.
3. Let go. The new shape stays selected, and the toolbar goes back to **Move**.

<GuideImage name="drawing-shapes/tools" alt="The shape menu open in the toolbar, listing Rectangle, Line, Ellipse, Polygon, and Star" />

A click without a drag makes a 100 × 100 shape, or a line 100 long. Start inside a frame to draw the shape into it.

## Round the Corners

Hover a selected rectangle: a dot shows inside each corner. Drag one to round the corners: all of them while they're equal, or only that one when they differ. Hold <Keys mac="⌥" other="Alt" /> to do the opposite, and <Keys mac="⇧" other="Shift" /> to go in steps of 10.

To type a radius, use **Radius** in the Design panel. The button next to it sets each corner on its own. **Corner smoothing** starts the curve earlier, as on an app icon.

A polygon or star has one radius dot, below its top point, and two more:

- Drag the dot on the next point around the center to change the number of points.
- Drag a star's dot on its first inner point in or out to make the star thinner or fuller.

**Count** and **Ratio** in the Design panel do the same. The dots hide while the shape is smaller than about 108 pixels on screen: zoom in to reach them.

<GuidePair>

<GuideImage name="drawing-shapes/corners" alt="A selected rectangle with a dot inside each corner" caption="Corner dots on a rectangle" />
<GuideImage name="drawing-shapes/star" alt="A selected star with dots for its radius, point count, and ratio" caption="Radius, point, and ratio dots on a star" />

</GuidePair>

## Color a Shape

Click the color square under **Fill**. The buttons at the top of the picker, from left to right, choose the kind of fill:

<GuideLegend>

<GuideImage name="drawing-shapes/fill" alt="The fill picker on its gradient button, with a purple linear gradient and its two stops" />

- **Solid**: one color. Type a hex value in the panel, or use the eyedropper to take a color from the canvas.
- **Gradient**: linear, radial, angular, or diamond. While the picker is open, the canvas shows the gradient's handles. Drag an end to move it, with <Keys mac="⇧" other="Shift" /> to turn it in steps of 15°, and drag a stop's square to slide the stop.
- **Image**: a picture from your computer or a [stock photo](./photos). It can **Fill**, **Fit**, **Crop**, or **Tile** the shape, and the sliders adjust exposure, contrast, and more.
- **Shader**: a moving effect, such as **Aurora**. The canvas shows a still frame, and it plays in preview: click **▷** at the top right of the window, or press <Keys mac="⌘ ⌥ Enter" other="Ctrl Alt Enter" />. Click **{ }** to paste a preset copied from shaders.com.

</GuideLegend>

Click **+** next to **Fill** to add another fill on top. The eye hides a fill, and **−** removes it.

## Add an Outline

Click **+** next to **Stroke**. Then:

- **Inside**, **Center**, or **Outside** sets where the line sits on the edge.
- **W** sets the width. The button with four squares sets each side's width on its own.
- The settings button next to it turns on a dashed line and sets how the line's ends and corners look. An open path can end in an arrow.

## Add Shadows and Blurs

Click **+** next to **Effects**, then choose the kind of effect:

<GuideLegend>

<GuideImage name="drawing-shapes/effects" alt="The list of effects: drop shadow, inner shadow, layer blur, background blur, foreground blur, noise, texture, and glass" />

- **Drop shadow** and **Inner shadow**: a shadow outside or inside the shape.
- **Layer blur** blurs the shape, **Background blur** what's behind it, as frosted glass does, and **Foreground blur** what's in front. A blur is **Uniform**, or **Progressive** to fade from sharp to blurred.
- **Noise** and **Texture**: grain over the shape.
- **Glass**: bends and lights what's behind the shape, like a lens.

</GuideLegend>

Click the square next to an effect to change its settings. A shape can have several effects, but only one glass and one texture.

## Draw a Frame

A frame holds other layers: a screen, a card, or a button. Press <Keys mac="F" other="F" /> or <Keys mac="A" other="A" /> and drag.

- Layers the new frame fully covers go into it.
- For a frame the size of a phone, tablet, or desktop screen, pick a size in the Design panel while the Frame tool is on. With a frame selected, **Frame** in the Design panel resizes it the same way.
- A frame hides what sticks out of it. Turn off **Clip content** to show it.
- To place what's inside a frame in rows or columns, use [auto layout](./auto-layout).

## Group Areas With Sections

A section marks an area of the page, such as a flow or a set of screens. Press <Keys mac="⇧ S" other="Shift S" /> and drag around the layers.

Layers a section fully covers go into it, also when you move or resize the section later. Sections stay at the top of the page: they can't go into a frame. Drag a section's name to move it.

## Arrange the Toolbar

Right-click the toolbar and choose **Customize toolbar…**. The same settings are in **Settings → Editor**.

- Turn a tool off to hide it. Its shortcut still works.
- Drag a tool to move it. Drop it into a box to put it in that menu, between boxes to give it its own button, or onto another tool to put both in one menu.
- **Reset to default** puts everything back.

Tools added in a later version go to their usual place, also in a toolbar you've changed.
