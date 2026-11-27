---
pageClass: guide
title: Vector Editing
description: Move a path's points and curves, add and delete points, and combine shapes into new ones.
---

# Vector Editing

A path is made of points joined by straight or curved lines. To change its shape, edit the points themselves.

## Edit a Path

Double-click a path, or select it and press <Keys mac="Enter" other="Enter" />. Its points show, and the handles around the layer go away.

<GuideImage name="vector-edit/points" alt="A curved path in edit mode, with a point selected and its two handles" />

- Drag a point to move it.
- Drag a point's handle to change the curve.
- Click a line between two points to select it, and drag it to move both of its points.
- Drag across an empty spot to select the points inside the box.
- Inside a filled shape, the area under the pointer is hatched. Click to select it with all its points, and drag to move it.
- Hold <Keys mac="⇧" other="Shift" /> and click to add to the selection.

To stop editing, press <Keys mac="Esc" other="Esc" /> or <Keys mac="Enter" other="Enter" />, or click an empty part of the canvas.

## Shape a Curve

Hold a key while you drag a handle:

| Hold | What it does |
| ---- | ------------ |
| <Keys mac="⌘" other="Ctrl" /> | Keeps both handles in one line, for a smooth curve. Only this handle's length changes. |
| <Keys mac="⌥" other="Alt" /> | Moves only this handle, for a sharp corner. |
| <Keys mac="⇧" other="Shift" /> | Keeps the handle's direction and changes only its length. |

Hold <Keys mac="⌘" other="Ctrl" /> and drag a point to pull out its handles and bend the lines next to it.

## Add and Delete Points

Press <Keys mac="P" other="P" /> while editing to use the pen:

- Click a line to add a point on it.
- Click the end of an open path to keep drawing from there.
- Hold <Keys mac="⌥" other="Alt" /> and click a point to delete it.

To delete what's selected, press <Keys mac="⌫" other="Delete" />. A deleted point takes its lines with it. A deleted line leaves its points, unless nothing else holds them, so deleting a line in the middle splits a path in two. To split a path at a point instead, select the point and press <Keys mac="⌥ ⌫" other="Alt Delete" />.

## Combine Shapes

Select two or more shapes and choose how to combine them in **Object**:

<GuideImage name="vector-edit/combine" alt="A square and a circle that overlap, and the four ways to combine them: union, subtract, intersect, and exclude" />

- **Union selection** joins them into one shape.
- **Subtract selection** cuts the shapes on top out of the bottom one.
- **Intersect selection** keeps only where they overlap.
- **Exclude selection** keeps everything except where they overlap.

The result stays editable: each shape keeps its own points inside it. **Flatten** turns the selection into one plain path, and **Outline stroke** turns a stroke into a filled shape. Rectangles, ellipses, and stars become paths you can edit point by point once flattened.
