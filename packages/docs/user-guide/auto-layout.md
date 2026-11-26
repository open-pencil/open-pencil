---
pageClass: guide
title: Auto Layout
description: Build frames that arrange their layers and resize with their content.
---

# Auto Layout

Auto layout makes a frame arrange the layers inside it. Edit some text, add a row, or hide a layer, and everything else moves to fit. Use it for buttons, lists, cards, and whole screens.

<GuidePair>

<GuideImage name="auto-layout/before" alt="A playlist card with two songs" caption="Two songs" />
<GuideImage name="auto-layout/after" alt="A taller playlist card with three songs" caption="Add one, and the card grows" />

</GuidePair>

## Add Auto Layout

1. Select a frame, or the layers you want to arrange.
2. Press <Keys mac="⇧ A" other="Shift A" />.

A frame starts arranging its layers. Loose layers are wrapped in a new frame. Press <Keys mac="⇧ A" other="Shift A" /> on the frame again to turn auto layout off.

## Set Up the Frame

Select the frame and look for **Auto layout** in the Design panel.

<GuideLegend>

<GuideImage name="auto-layout/panel" alt="The Auto layout settings with six numbered controls" />

1. **Flow** arranges layers freely, vertically, horizontally, or in a grid.
2. **Wrap** moves layers to a new line when they run out of room.
3. **Sizing** sets how the frame's width and height behave.
4. **Alignment** places the layers in the frame. Click a dot.
5. **Gap** is the space between layers. Choose **Auto** in its menu to spread them apart.
6. **Padding** is the space inside the frame's edges. The button beside it sets each side on its own.

</GuideLegend>

## Change Spacing on the Canvas

Select the frame and point at a gap or an edge to see its size. Double-click it, then click the value that appears and type a new one.

## Choose How Layers Resize

Select a layer, then open the menu in its **W** or **H** field.

<GuideLegend>

<GuideImage name="auto-layout/sizing" alt="The width menu open, with Fixed, Hug, and Fill" />

- **Fixed** keeps the size you set.
- **Hug** fits the content.
- **Fill** takes up the room in the parent frame.

</GuideLegend>

For a list row, try **Fill** for the width and **Hug** for the height. The same menu adds minimum and maximum sizes.

## Reorder Layers

Drag a layer to a new place in the frame. The blue line shows where it will land.

<GuidePair>

<GuideImage name="auto-layout/drag" alt="The pointer dragging Low Tide, with a blue line above Paper Lanterns" caption="Drag Low Tide up" />
<GuideImage name="auto-layout/drop" alt="Low Tide between Slow Morning and Paper Lanterns" caption="Let go, and it moves into place" />

</GuidePair>

## Wrap Layers

Turn on **Wrap** for content such as tags, where the number of items changes. A second gap field sets the space between lines.

<GuideImage name="auto-layout/wrap" alt="Seven tags flowing over three lines" />

## Build a Grid

<GuideLegend>

<GuideImage name="auto-layout/grid-panel" alt="Column and row settings for a grid" />

1. Select the frame and choose **Grid** in **Flow**.
2. Use **+** beside **Columns** and **Rows** to add tracks.
3. Choose **Fill (fr)** for tracks that share the room, or **Fixed (px)** for a set size.
4. Set the gaps between columns and rows at the bottom.

</GuideLegend>

<GuideImage name="auto-layout/grid" alt="Six album covers in three columns and two rows" />

## Place a Layer Freely

Some layers, such as a badge in a corner, shouldn't be arranged with the rest.

1. Select the layer.
2. Click **Ignore auto layout** beside **Position**.
3. Drag it anywhere in the frame.

You can also hold <Keys mac="⌃" other="Ctrl" /> while you drag. The layer goes into the frame under the pointer.
