---
title: Custom Editor Shell
description: Build your own editor shell with provideEditor, CanvasRoot, menus, panels, and toolbars.
---

# Custom Editor Shell

A typical OpenPencil Vue app has three layers:

1. `@open-pencil/core` creates the editor
2. `@open-pencil/vue` adapts it into Vue composables and headless primitives
3. your app renders the shell, styling, and product UX

## Why this matters

The built-in OpenPencil app is only one possible shell.

You can build a very different one for a focused workflow: an embedded editor inside another product, an internal asset tool, a template editor, an annotation UI, or an AI-assisted editing surface with custom controls.

That is the main reason the SDK exists.

## Recommended composition

A practical shell often looks like this:

- provider at the top with `provideEditor()`
- canvas in the center
- page/layer navigation on one side
- properties on the other side
- menus and toolbars driven by composables

## Example

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { createDefaultEditorState, createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import { provideEditor } from '@open-pencil/vue'
import { CanvasRoot, CanvasSurface } from '@open-pencil/vue/canvas'
import { ToolbarRoot } from '@open-pencil/vue/primitives/Toolbar'
import { PageListRoot } from '@open-pencil/vue/primitives/PageList'

const graph = new SceneGraph()
const page = graph.getPages()[0]
if (!page) throw new Error('Expected an initial page')

const editor = createEditor({
  graph,
  state: reactive(createDefaultEditorState(page.id))
})
provideEditor(editor)
</script>

<template>
  <div class="grid h-screen grid-cols-[240px_1fr_320px] grid-rows-[48px_1fr]">
    <ToolbarRoot v-slot="{ tools, activeTool, actions }">
      <header class="col-span-3 flex items-center gap-2 border-b px-3">
        <button
          v-for="tool in tools"
          :key="tool.key"
          :data-active="activeTool === tool.key"
          @click="actions.setTool(tool.key)"
        >
          {{ tool.label }}
        </button>
      </header>
    </ToolbarRoot>

    <aside class="border-r">
      <PageListRoot v-slot="{ pages, currentPageId, actions }">
        <nav>
          <button
            v-for="page in pages"
            :key="page.id"
            :data-active="page.id === currentPageId"
            @click="actions.switch(page.id)"
          >
            {{ page.name }}
          </button>
        </nav>
      </PageListRoot>
    </aside>

    <main>
      <CanvasRoot>
        <CanvasSurface class="size-full" />
      </CanvasRoot>
    </main>

    <aside class="border-l">Properties panel here</aside>
  </div>
</template>
```

`CanvasRoot` takes the canvas's pointer input and typing and tells the editor the canvas's size, so zooming to fit fills the canvas rather than the window. It emits `ready` once the page draws and `failed` if the canvas cannot start. See [SDK Getting Started](../getting-started) for installation requirements and migration notes.

## Keyboard

`useEditorKeyboard()` binds the editor's keys as OpenPencil does: each command's shortcut, the tool keys the profile offers, a held Space for the hand, arrow nudges, Delete, Enter and Escape for selections and paths, opacity digits, and zoom. Keys wait while a text field, an open dialog or menu, or text being edited has them, and undo and redo stop the browser's own. Call it in a component under `provideEditor`, and add the shell's own keys beside the editor's. Keys are [TanStack Hotkeys](https://tanstack.com/hotkeys) chords such as `Mod+S` or `Control+Shift+Tab`, typed so a misspelled key fails to compile, and the same ones `formatShortcut` prints for menus and tooltips, so a key and its label come from one string:

```ts
import { useEditorKeyboard } from '@open-pencil/vue/editor/keyboard'

useEditorKeyboard({
  shortcuts: [
    { id: 'save', keys: 'Mod+S', run: () => save() },
    // Closes the shell's panel while one is open; otherwise declines, and the editor's Escape runs.
    { id: 'close-panel', keys: 'Escape', run: () => (panelOpen.value ? closePanel() : false) }
  ]
})
```

A shell's key on a key the editor uses runs first. Returning `false` declines the key, and the editor's own action runs instead, so a shell takes Escape only while it has something to close, or starts a pen path over before the editor would finish it.

## Limiting what the editor offers

A shell that is not a general design tool, such as a lettering game or a guided exercise, narrows the editor rather than hiding controls. Restrictions only take away from what the document offers, and everything that reads the editor's profile follows them: the toolbar's tools, the tool keys, `setTool`, the canvas, and the editor's actions.

```ts
// Only Move and Hand; a tool no longer offered gives way to Move.
editor.setHostRestrictions({ tools: new Set(['SELECT', 'HAND']) })

// Paths keep their points: only handles move. Adding, deleting, joining, breaking, aligning,
// and continuing points with the pen are refused, and points select but do not drag.
editor.setHostRestrictions({ pathEdits: 'handles' })

// Layers stay as they are: nothing moves, resizes, restyles, or is added or deleted, by the
// canvas, the keys, or the editor's actions, which throw a `FixedLayersError`; vector edit mode
// still reshapes a path.
editor.setHostRestrictions({ layerEdits: 'none' })

// Layers only move, within their parents: dragging and arrow keys work, and everything else,
// resizing and rotating included, throws a `MoveOnlyLayersError`.
editor.setHostRestrictions({ layerEdits: 'move' })

// The host's own edits run past its restrictions, which narrow what the person does; a read-only
// document still refuses them. Undo takes them back like any other step. They run synchronously:
// await outside `asHost`, not inside it.
editor.asHost(() => editor.booleanOperationSelected('UNION'))

// Open one path for editing and keep it open: clicking off it, Escape, Enter, another tool, or
// another layer leave it open. Every point shows its handles.
editor.enterNodeEditMode(nodeId, { keepOpen: true, showHandles: 'all' })

// The host ends it; so do switching pages, deleting the layer, replacing the document, and
// going read-only.
editor.exitNodeEditMode(true, { release: true })
```

Undo and redo stop at the steps made before layers were restricted. A host that responds to the person's edits, such as snapping a dropped layer into place, records its response into their step with `recordEdit({ label, joinStep: step }, run)`, so one undo takes back both. `history:changed` says why history changed (`'record'`, `'join'`, `'undo'`, `'redo'`, or `'clear'`) and passes the step it recorded, so the host responds to new steps only. A response whose step was undone or followed by another before it ran changes nothing:

```ts
editor.onEditorEvent('history:changed', (change, step) => {
  if (change !== 'record') return
  queueMicrotask(() => editor.recordEdit({ label: 'Snap', joinStep: step }, snap))
})
```

`setReadOnly(true)` is the strongest restriction: the document can be looked at, selected in, and copied from, and an open path closes.

## Guiding what the person does

A shell that judges input as it comes, such as a tracing game, follows the gesture in progress through editor events, in page coordinates, and refuses one with `cancelGesture()`: the gesture is taken back with no undo step and no redo, and the canvas drops it.

```ts
// Before a press of the pen acts: kind is 'start', 'point', 'redo-handle', or 'close'.
editor.onEditorEvent('pen:pressed', ({ at, kind }) => {
  if (kind === 'start' && !nearStart(at)) editor.cancelGesture()
})

// After the press placed its point or set up a close, before anything commits; segment is the
// cubic it finished, the closing one for a close.
editor.onEditorEvent('pen:released', ({ kind, segment }) => {
  if (segment && !onShape(segment)) editor.cancelGesture()
})

// Points the pen and vector edit mode snap to, alongside the path's own.
editor.setSnapTargets({ points: [shapeStart, shapeEnd] })
```

A host decides where the person's moves put layers with a move policy, which sees each drag's live preview as well as the move that lands, nudges, and X and Y typed in the position panel:

```ts
// Letters stay on their line; anything else moves as the person moves it.
editor.setMovePolicy(({ node, to }) => (letters.has(node.id) ? { x: to.x, y: node.y } : to))
```

It returns where the layer goes, adjusted however the host likes, or `null` to keep it where it is; a drag it refuses changes nothing, not even the frame it was dropped over. It decides moves only: resizing, rotating, and edits through `updateNode` place layers as they say, and the host's own edits (`asHost`) and undo and redo pass it. A front end of its own asks it with `editor.constrainMove(node, changes)`.

`cancelGesture()` also puts back a drag in vector edit mode. Escape and other keys go through `useEditorKeyboard`'s `shortcuts`.

## Styling the canvas

The canvas's own chrome follows editor state, so a shell with a look of its own sets it there:

```ts
// Selection outlines, handles, the pen, and vector edit mode's points and handles, with the
// text on its labels; the default blue when unset.
editor.state.selectionTheme = { color: ink, foreground: paper }

// No width × height label under the selection.
editor.state.showSizeLabels = false

// The page behind the layers. It is a document edit, so a restricted host makes it as the host.
editor.asHost(() => editor.setPageColor(paper))
```

## Why this split works

- the SDK owns editor integration and reusable headless logic
- your app owns layout, styling, and product-specific actions
- composables can power menus and panels without extra wrapper components

## Related APIs

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
