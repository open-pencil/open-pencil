---
pageClass: guide
title: Coming from Figma
description: Bring your Figma files and layers to OpenPencil, and find what works the same and what works differently.
---

# Coming from Figma

OpenPencil reads and writes Figma's own `.fig` files and uses Figma's names and shortcuts, so most of what you know works here. Your files stay yours: they open in Figma again whenever you need it.

## Bring Your Files

1. In Figma, open the file and choose **File → Save local copy…**.
2. In OpenPencil, open the `.fig` file, or drag it onto the window. See [Opening and Saving](./files).

Saving in OpenPencil writes a `.fig` file that opens in Figma too.

## Copy Layers Between the Two

Select layers in Figma, press <Keys mac="⌘ C" other="Ctrl C" />, and paste them in OpenPencil with <Keys mac="⌘ V" other="Ctrl V" />. It works the other way too. Fills, strokes, effects, text, auto layout, corner radii, and vector paths come along.

Images in pasted layers are fetched from Figma, so the Figma file they come from has to be one you can open. <Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> and <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> copy and paste only the look of a layer, to and from Figma as well.

## What Works the Same

- **Frames, groups, sections, and auto layout**, with the same settings, including grid layout.
- **Components, variants, and instances**, with properties and slots. See [Components](./components).
- **Variables and modes**. See [Variables](./variables).
- **Styles** from your files and libraries apply as in Figma.
- **Shortcuts** are Figma's, such as <Keys mac="R" other="R" /> for a rectangle and <Keys mac="⇧ A" other="Shift A" /> for auto layout. See [Keyboard Shortcuts](/reference/keyboard-shortcuts).

## What Works Differently

- **Libraries.** Figma's team libraries don't connect to OpenPencil. To share components between files here, [publish an OpenPencil library](./component-libraries).
- **Styles.** You can apply and detach styles, but not yet create or edit them. Use [variables](./variables) for new colors and sizes.
- **Variable modes** are set on a frame or page under **Appearance**, where each collection always has a row.
- **Fonts.** The desktop app uses the fonts on your computer. In the browser, Chrome and Edge do once you allow it. See [Choose a Font](./text-editing#choose-a-font).
- **Prototyping** isn't here yet. Components can [work like controls](./components#make-a-component-work-like-a-control) in preview, such as a switch that flips.
- **Version history** is for files on [OpenPencil Cloud](/cloud/).

The [Figma Feature Matrix](/reference/figma-compatibility) lists every Figma feature and how far OpenPencil supports it.

## Instead of Plugins and Dev Mode

- **Ask the AI.** Much of what plugins do, such as renaming layers, making variants, or checking contrast, the [AI chat](./ai-chat) does from a sentence. It can also use a [coding agent](./coding-agents) you have.
- **Write a script.** Scripts use the same API as Figma plugins, `figma.currentPage` and the rest. See [Scripting](/developers/cli/scripting).
- **Get the code.** The Code tab, next to Design, shows the selection as HTML, Vue, or React, with CSS or Tailwind.
- **Check designs.** [Checking Designs](./checking-designs) finds low contrast, small tap targets, and colors that should use a variable.
