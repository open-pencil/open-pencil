---
title: Text Editing
description: Creating and editing text with rich formatting, fonts, and inline editing in OpenPencil.
---

# Text Editing

Create text nodes and edit them directly on the canvas with full rich text support.
## Creating Text

Press <kbd>T</kbd> to activate the text tool, then click on the canvas. An empty text node appears with a blinking cursor — start typing immediately.

## Inline Editing

Double-click any existing text node to enter inline editing mode. A blue outline appears around the text to indicate edit mode. Click outside the text node to commit and exit editing.

Text is rendered directly on the canvas — there's no separate text input overlay.

## Cursor Navigation

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Move left/right | <kbd>←</kbd> / <kbd>→</kbd> | <kbd>←</kbd> / <kbd>→</kbd> |
| Move up/down | <kbd>↑</kbd> / <kbd>↓</kbd> | <kbd>↑</kbd> / <kbd>↓</kbd> |
| Move by word | <kbd>⌥</kbd><kbd>←</kbd> / <kbd>⌥</kbd><kbd>→</kbd> | <kbd>Ctrl</kbd> + <kbd>←</kbd> / <kbd>Ctrl</kbd> + <kbd>→</kbd> |
| Move to line start/end | <kbd>⌘</kbd><kbd>←</kbd> / <kbd>⌘</kbd><kbd>→</kbd> | <kbd>Home</kbd> / <kbd>End</kbd> |

Hold <kbd>Shift</kbd> with any movement key to extend the selection.

## Text Selection

- **Click** inside a text node to position the cursor
- **Click + drag** to select a range of text
- **Double-click** a word to select it
- **Triple-click** to select all text in the node

## Rich Text Formatting

Apply formatting to selected text, or toggle the style for the entire node when nothing is selected.

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Bold | <kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>B</kbd> |
| Italic | <kbd>⌘</kbd><kbd>I</kbd> | <kbd>Ctrl</kbd> + <kbd>I</kbd> |
| Underline | <kbd>⌘</kbd><kbd>U</kbd> | <kbd>Ctrl</kbd> + <kbd>U</kbd> |

Strikethrough is available via the **S** toggle button in the Typography section of the properties panel (no keyboard shortcut — <kbd>⌘</kbd><kbd>S</kbd> is used for Save).

Formatting is applied per character. When you type between a bold and regular segment, the new text inherits the style of the preceding segment.

The **B / I / U / S** toggle buttons in the Typography section of the properties panel also apply formatting.

## Editing Operations

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Delete word before cursor | <kbd>⌥</kbd><kbd>⌫</kbd> | <kbd>Ctrl</kbd> + <kbd>Backspace</kbd> |
| Delete to line start | <kbd>⌘</kbd><kbd>⌫</kbd> | — |
| Cut | <kbd>⌘</kbd><kbd>X</kbd> | <kbd>Ctrl</kbd> + <kbd>X</kbd> |
| Copy | <kbd>⌘</kbd><kbd>C</kbd> | <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Paste | <kbd>⌘</kbd><kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>V</kbd> |

## Font Picker

Open the font picker in the Typography section of the properties panel to change the font family. The picker features:

- **Search filter** — type to narrow the font list
- **Font preview** — each font name is rendered in its own typeface
- **Virtual scroll** — handles large font lists efficiently
- **Scroll-to-current** — the current font is highlighted when the picker opens

## Font Weight

Change the font weight in the Typography section of the properties panel. Available weights depend on the selected font family (e.g., Regular, Medium, Bold, Black).

## Font Sources

- **Default font** — Inter is loaded automatically
- **Desktop app** — all system fonts are available
- **Browser** — system fonts are available in Chrome and Edge

## Tips

- The font list is preloaded at startup so the picker opens without delay.
- IME input (Chinese, Japanese, Korean) is fully supported.
- Rich text formatting is preserved when opening and saving .fig files.
- See [Components](./components) for how text overrides work in component instances.
