---
pageClass: guide
title: Text Editing
description: Add text, style all of it or a few words, make lists, size the text box, and choose fonts.
---

# Text Editing

Text is typed and styled right on the canvas. The Typography section of the Design panel holds its settings.

## Add Text

Press <Keys mac="T" other="T" />, then:

- Click and type. The text box grows as you type.
- Or drag a box first. The text wraps inside its width.

To finish, press <Keys mac="Esc" other="Esc" /> or click outside the text.

## Change Text

Double-click a text to edit it, or select it and press <Keys mac="Enter" other="Enter" />. All of its text is selected, so you can type over it.

While editing:

- Click to put the cursor somewhere, or drag to select.
- Double-click selects a word, and a triple-click all the text.
- The usual text keys work, such as <Keys mac="⌥ ←" other="Ctrl ←" /> to move by a word and <Keys mac="⇧" other="Shift" /> with an arrow to select.

## Style Text

Select a text layer to style all of it, or select some characters while editing to style only those.

<GuideLegend>

<GuideImage name="text-editing/typography" alt="The Typography section of the Design panel with five numbered parts: font, weight and size, spacing, alignment, and formatting" />

1. **Font**. The gear next to it opens the font settings.
2. **Font weight** and **Font size**.
3. **Line height** and **Letter spacing**.
4. **Text alignment**, across and up and down.
5. **Bold**, **Italic**, **Underline**, and **Strikethrough**. Bold, italic, and underline also have shortcuts: <Keys mac="⌘ B" other="Ctrl B" />, <Keys mac="⌘ I" other="Ctrl I" />, and <Keys mac="⌘ U" other="Ctrl U" />.

</GuideLegend>

Below these, **Text case** shows text in capitals or lowercase without retyping it. Typing next to styled characters takes their style.

## Make a List

Under **Lists and paragraphs**, choose a bulleted or numbered list for the selected lines. The fields below set the space between list items, the space between paragraphs, and the indent of a paragraph's first line. **Hanging lists** puts bullets and numbers outside the text's edge, so the lines of text stay aligned.

## Size the Text Box

The buttons under **Resizing** in the Layout section choose how the box follows its text:

- **Auto width**: the box grows sideways, and the text stays on one line unless you press <Keys mac="Enter" other="Enter" />.
- **Auto height**: the width stays and the text wraps, while the box grows down.
- **Fixed size**: the box keeps its size. Set **Truncation** to **Ending ellipsis** to end the text with "…" where it no longer fits, or after a number of lines.

## Choose a Font

Click the font name in Typography, then type to search. Each font in the list shows in its own typeface, with where it comes from.

Which fonts you can choose depends on where you run OpenPencil:

- **Desktop app**: the fonts on your computer, and fonts from Google Fonts, Fontsource, Bunny Fonts, and Fontshare. Downloaded fonts are kept for next time.
- **Browser**: Fontsource, Bunny Fonts, and Fontshare. Chrome and Edge also show the fonts on your computer once you allow it.

Choose sources in **Settings → Fonts**, which the gear next to the font name opens. Inter is always there.

## Fine-Tune a Variable Font

A variable font, such as Inter, can be drawn at any weight, width, or other setting it supports. Typography lists these settings with their values: type or drag a value to change one. Choosing a weight or another font puts them back.

**Optical size** reads **Auto** while it follows the font size. Set a value, or choose **Fixed** from its menu, to keep it the same at any size.

## When a Font Is Missing

When a file uses a font OpenPencil can't load, a note shows above the canvas. Open it to see which fonts are missing and what shows instead.

- **Select layers** selects the text that uses them.
- **Retry fonts** tries again, for example after you allow access to your computer's fonts or turn on another source.

A missing style, such as Bold, can be drawn from another style of the same font. A missing font shows as Inter.

## Text on a Path

Text that follows a curve in a Figma file keeps its shape here. You can edit its text and style, but not yet put new text on a path.
