---
pageClass: guide
title: Selection & Manipulation
description: Select layers, then move, resize, rotate, copy, and edit several of them at once.
---

# Selection & Manipulation

To change a layer, select it first. The Design panel then shows its settings, and handles around it let you resize and rotate it.

## Select a Layer

Click a layer on the canvas. In a frame, a click selects a layer just inside the frame, such as a row of a list. Double-click to go one level deeper.

<GuidePair>

<GuideImage name="selection-and-manipulation/click" alt="The Paper Lanterns row selected in a playlist card" caption="Click selects the row" />
<GuideImage name="selection-and-manipulation/double-click" alt="The title and artist inside the row selected" caption="Double-click goes inside it" />

</GuidePair>

To reach the layer under the pointer straight away, hold <Keys mac="⌘" other="Ctrl" /> and click. To select nothing, click an empty part of the canvas or press <Keys mac="Esc" other="Esc" />.

## Select Several Layers

- Hold <Keys mac="⇧" other="Shift" /> and click layers to add them to the selection, or to take them out.
- Drag across the canvas from an empty spot to draw a box. The layers it touches are selected. A frame on the page is selected only when the box covers all of it.
- Press <Keys mac="⌘ A" other="Ctrl A" /> to select everything on the page.

<GuideImage name="selection-and-manipulation/marquee" alt="A selection box drawn across two rows of a playlist card" />

## Select With the Keyboard

- <Keys mac="Enter" other="Enter" /> selects the layers inside the selected one.
- <Keys mac="⇧ Enter" other="Shift Enter" /> selects the layer that holds it.
- <Keys mac="Tab" other="Tab" /> and <Keys mac="⇧ Tab" other="Shift Tab" /> select the next and previous layer at the same level.

## Move Layers

Drag a selected layer. Arrow keys move it by one pixel, and by ten with <Keys mac="⇧" other="Shift" />.

- Hold <Keys mac="⇧" other="Shift" /> while you drag to move in a straight line.
- Let go over a frame to put the layer in it. Drag it out of the frame to take it out.
- Hold <Keys mac="Space" other="Space" /> while you drag to keep the layer in its frame.

## Resize and Rotate

<GuideLegend>

<GuideImage name="selection-and-manipulation/handles" alt="A selected card with three numbered parts: a corner handle, the rotation handle, and the size" />

1. Drag a **handle** to resize. Hold <Keys mac="⇧" other="Shift" /> on a corner to keep the proportions.
2. Drag the **rotation handle** to rotate, or point just outside a corner and drag. Hold <Keys mac="⇧" other="Shift" /> to turn in steps of 15°.
3. The **size** shows while the layer is selected.

</GuideLegend>

To type an exact size or angle, use **W**, **H**, and the angle field in the Design panel. <Keys mac="⇧ H" other="Shift H" /> and <Keys mac="⇧ V" other="Shift V" /> flip the selection across or upside down.

## Copy, Paste, and Delete

- <Keys mac="⌘ D" other="Ctrl D" /> makes a copy next to the original.
- Hold <Keys mac="⌥" other="Alt" /> while you drag to drag out a copy.
- <Keys mac="⌘ C" other="Ctrl C" /> and <Keys mac="⌘ V" other="Ctrl V" /> copy and paste. A pasted layer keeps its place; to paste under the pointer, right-click and choose **Paste here**.
- <Keys mac="⇧ ⌘ R" other="Ctrl Shift R" /> pastes in place of the selected layers.
- <Keys mac="⌫" other="Delete" /> deletes the selection.

Text copied from a web page pastes as one text layer. When you copy part of a page's layout, such as a card, a notice offers **Paste as layers** to rebuild it as frames and text.

## Copy the Look of a Layer

<Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> copies how a layer looks, and <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> gives that look to every selected layer. It works with layers copied in Figma too.

The look is fills, strokes, effects, opacity, blend mode, corner radius, and the styles and variables they use. Between frames it includes auto layout, and between text layers the text style. Position, size, name, and content stay as they are.

## Group Layers

- <Keys mac="⌘ G" other="Ctrl G" /> groups the selection.
- <Keys mac="⌥ ⌘ G" other="Ctrl Alt G" /> puts it in a new frame instead.
- <Keys mac="⇧ ⌘ G" other="Ctrl Shift G" /> takes a group, frame, or section apart, and leaves its layers where they are.

To lay out layers in a row or column, use [auto layout](./auto-layout) instead.

## Show a Layer Through a Shape

Put the shape below the layers it should cut out, select them all, and press <Keys mac="⌥ ⌘ M" other="Ctrl Alt M" />. The bottom layer becomes a mask: the layers above show only inside it, such as a photo in a circle. Press it again to turn the mask off.

## Put Layers in Front or Behind

Layers higher in the [layers list](./layers-and-pages) cover the ones below.

- <Keys mac="]" other="]" /> brings the selection to the front, and <Keys mac="[" other="[" /> sends it to the back.
- <Keys mac="⌘ ]" other="Ctrl ]" /> and <Keys mac="⌘ [" other="Ctrl [" /> move it one step.

## Hide and Lock Layers

- <Keys mac="⇧ ⌘ H" other="Ctrl Shift H" /> hides the selection, or shows it again. Hidden layers stay in the layers list.
- <Keys mac="⇧ ⌘ L" other="Ctrl Shift L" /> locks it. You can't select or move a locked layer on the canvas; select it in the layers list instead.

## Edit Several Layers at Once

With several layers selected, the Design panel shows the settings they share. **Mixed** marks a setting that differs between them. Change a setting, and it changes for all of them.

<GuideImage name="selection-and-manipulation/several" alt="The Design panel for two selected rows, with Y set to Mixed" />

<GuideLegend>

<GuideImage name="selection-and-manipulation/selection-colors" alt="Selection colors listing four colors" />

**Selection colors** lists every color in the selection, including the layers inside it. Change a color here to change it everywhere it's used.

</GuideLegend>
