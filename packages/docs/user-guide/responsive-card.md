---
pageClass: guide
title: Build a Responsive Card
description: "A first project in OpenPencil, step by step: a product card whose text wraps and whose height follows its content at any width."
---

# Build a Responsive Card

In this project you build a product card that adapts: make it narrower or wider, and its photo stretches, its text wraps, and its height follows. It takes about ten minutes and uses the tools you'll use most.

<GuidePair>

<GuideImage name="responsive-card/narrow" alt="The finished card at 240 wide, with its description on three lines" caption="240 wide" />
<GuideImage name="responsive-card/wide" alt="The same card at 420 wide, with its description on two lines" caption="420 wide" />

</GuidePair>

## 1. Add the Parts

Start with a new file: **File → New Design**, or <Keys mac="⌘ N" other="Ctrl N" />.

1. Press <Keys mac="R" other="R" /> and drag a rectangle about 280 wide and 160 tall. It holds the photo.
2. Press <Keys mac="T" other="T" />, click below the rectangle, and type the name: *Ceramic mug*. Press <Keys mac="Esc" other="Esc" />.
3. Add two more texts below it the same way: a description, such as *Hand-thrown in small batches, and keeps your coffee warm for longer*, and *Add to cart*.

Keep the four parts in a column, left edges roughly lined up.

<GuideImage name="responsive-card/parts" alt="A rectangle and three texts in a loose column on the canvas" />

## 2. Put Them in a Card

1. Press <Keys mac="⌘ A" other="Ctrl A" /> to select all four parts.
2. Press <Keys mac="⇧ A" other="Shift A" />. They go into a new frame with [auto layout](./auto-layout), which places them one after another.
3. In the Design panel, under **Flow**, choose the column button, **Vertical layout**, if the parts went into a row.
4. Set the gap between the parts to **12** and the padding to **20**.
5. Click **+** next to **Fill** to give the card a background, and set **Radius** to **16**.
6. Double-click the frame's name in the layers list and name it *Card*.

## 3. Let the Parts Stretch

1. Set the card's **W** to **320**.
2. Select the rectangle. Open the menu in its **W** field and choose **Fill**: it takes the card's width, inside the padding.
3. Do the same for the name and the description. The description wraps onto new lines instead of running past the card's edge.

The card's height follows its content by itself. Now try it: drag the card's right edge, or type another **W**. The photo stretches, the description wraps, and the card grows or shrinks to fit.

## 4. Make a Button

1. Select *Add to cart* and press <Keys mac="⇧ A" other="Shift A" />. The text goes into a frame of its own.
2. Give that frame a blue fill, padding of **16** across and **10** up and down, and a **Radius** of **10**. Make the text white.
3. Press <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" /> to make the button a [component](./components), so you can reuse it.

## 5. Add a Photo

1. Select the rectangle and click the color square under **Fill**.
2. Click the image button at the top of the picker, then **Choose image** to use a picture from your computer, or **Stock photo** to [find one](./photos).

The photo fills the rectangle at any width.

## 6. Check It and Share It

- Open the **Lint** tab to [check the card](./checking-designs) for problems, such as text that's hard to read.
- [Export it](./exporting) as a PNG, or right-click it and choose **Copy/Paste as → Copy as PNG** to paste into a chat.
- Ask the [AI](./ai-chat) for a variant: *"Make a dark version of this card."*

## Where to Go Next

- [Auto Layout](./auto-layout): rows, grids, wrapping, and the other ways layers resize.
- [Components](./components): variants, properties, and instances.
- [Variables](./variables): colors and sizes you set once, with dark and light modes.
