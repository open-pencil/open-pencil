---
pageClass: guide
title: Getting Started
description: Open OpenPencil in your browser or on your computer, find your way around, and make a first design.
---

# Getting Started

OpenPencil is a design editor for screens, from one button to a whole app. It opens and saves Figma files, and runs in your browser or as a desktop app.

## Open OpenPencil

- **In your browser:** go to [cloud.openpencil.dev](https://cloud.openpencil.dev). There is nothing to install.
- **On your computer:** get the app for macOS, Windows, or Linux from the [download page](/download). On a Mac, you can also install it with Homebrew: `brew install --cask openpencil`.

::: tip Moved from app.openpencil.dev
The web app moved to cloud.openpencil.dev. Files you kept in your browser at [app.openpencil.dev](https://app.openpencil.dev) stay there until that address starts redirecting: open it to save them to Cloud or download them.
:::

## System Requirements

In a browser, OpenPencil needs Chrome or Edge 111, Firefox 128, or Safari 16.4 or later. Browsers built on Chrome, such as Brave and Opera, work from the same versions.

The desktop app needs:

- **macOS** 13 Ventura or later, with its Safari updates installed.
- **Windows** 10 or later, with the Microsoft Edge WebView2 runtime, which Windows keeps up to date.
- **Linux** with WebKitGTK 2.40 or later (`webkit2gtk-4.1`).

If your browser or system is too old, OpenPencil says what to update. If you see that on a system that meets these requirements, click **Report a problem** in the message.

## Find Your Way Around

<GuideImage name="getting-started/editor" alt="The editor with eight numbered areas" />

1. **Menus.** File, Edit, View, and the rest, under the file's name.
2. **Pages.** Each page is a separate canvas in the same file.
3. **Layers.** Everything on the page, in the order it's drawn.
4. **Canvas.** Where you design.
5. **Toolbar.** Tools for frames, shapes, the pen, and text.
6. **Design panel.** Settings for what you selected. The tabs beside **Design** show it as code, open the AI chat, and check your design for problems.
7. **Zoom.** Click the percentage for zoom options.
8. **Share and Preview.** Invite people to the file, or try your design as a prototype.

## Make a First Design

1. Press <Keys mac="F" other="F" /> and drag on the canvas to draw a frame. Frames hold the rest of your design, like a screen or a card.
2. Press <Keys mac="R" other="R" /> and drag inside the frame to draw a rectangle.
3. Press <Keys mac="T" other="T" />, click inside the frame, and type.
4. Press <Keys mac="Esc" other="Esc" /> to finish typing. The Design panel now shows the text's font and size.
5. Press <Keys mac="⌘ S" other="Ctrl S" /> to save.

[Opening and Saving](./user-guide/files) explains where your file goes.

## Find a Command

Press <Keys mac="⌘ K" other="Ctrl K" /> and type what you want to do, such as "align left" or "export". Choose a result to run it. You can also type a page's name to go to that page.

## Use a Phone or Tablet

On a small screen, the panels move into a drawer at the bottom. Its buttons open the layers, the Design panel, the code, and the AI chat.

## Next Steps

- [Canvas Navigation](./user-guide/canvas-navigation): move around and zoom.
- [Selection & Manipulation](./user-guide/selection-and-manipulation): select, move, and resize layers.
- [Layers & Pages](./user-guide/layers-and-pages): organize what's in your file.
- [Auto Layout](./user-guide/auto-layout): build frames that resize with their content.

Want to build OpenPencil yourself? See [Contributing](/development/contributing#build-from-source).
