<script setup lang="ts">
import { reactive } from 'vue'

import { createDefaultEditorState, createEditor, type Tool } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import { provideEditor } from '@open-pencil/vue'
import { CanvasRoot, CanvasSurface } from '@open-pencil/vue/canvas'
import { LayerTreeItem, LayerTreeRoot } from '@open-pencil/vue/primitives/LayerTree'
import { PageListRoot } from '@open-pencil/vue/primitives/PageList'
import { PositionControlsRoot } from '@open-pencil/vue/primitives/PositionControls'
import { ToolbarItem, ToolbarRoot } from '@open-pencil/vue/primitives/Toolbar'

const graph = new SceneGraph()
const page = graph.getPages()[0]
if (!page) throw new Error('Expected an initial page')

// Reactive state lets the panels follow selection, tool, and page changes.
const editor = createEditor({ graph, state: reactive(createDefaultEditorState(page.id)) })
provideEditor(editor)

editor.createShape('FRAME', 100, 100, 400, 300)
editor.createShape('RECTANGLE', 150, 150, 120, 80)
editor.createShape('ELLIPSE', 350, 200, 100, 100)

editor.zoomToFit()

const TOOL_LIST: Tool[] = [
  'SELECT',
  'FRAME',
  'RECTANGLE',
  'ELLIPSE',
  'LINE',
  'POLYGON',
  'STAR',
  'TEXT',
  'PEN',
  'HAND'
]

const POSITION_FIELDS = ['x', 'y', 'width', 'height'] as const
type PositionField = (typeof POSITION_FIELDS)[number]
const FIELD_LABELS: Record<PositionField, string> = { x: 'X', y: 'Y', width: 'W', height: 'H' }
/** A number, or the SDK's mixed marker when the selected layers disagree. */
type FieldValue = number | symbol

interface PositionSlot {
  xValue: FieldValue
  yValue: FieldValue
  wValue: FieldValue
  hValue: FieldValue
  actions: {
    updateProp: (key: PositionField, value: number) => void
    commitProp: (key: PositionField, value: number, previous: number) => void
  }
}

/** What a field shows: its value, or nothing when the selected layers disagree. */
function shownValue(position: PositionSlot, field: PositionField): number | '' {
  const value = currentValue(position, field)
  return typeof value === 'number' ? value : ''
}

function currentValue(position: PositionSlot, field: PositionField): FieldValue {
  const values = {
    x: position.xValue,
    y: position.yValue,
    width: position.wValue,
    height: position.hValue
  }
  return values[field]
}

/** Applies a typed value and records it for undo, as the editor's own position fields do. */
function setField(position: PositionSlot, field: PositionField, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  const previous = currentValue(position, field)
  position.actions.updateProp(field, value)
  // A multi-selection keeps each layer's previous value itself; the fallback is unused there.
  position.actions.commitProp(field, value, typeof previous === 'number' ? previous : value)
}
</script>

<template>
  <div class="layout">
    <ToolbarRoot>
      <div class="toolbar">
        <ToolbarItem
          v-for="tool in TOOL_LIST"
          :key="tool"
          v-slot="{ active, actions }"
          :tool="tool"
        >
          <button :class="{ active }" @click="actions.select">{{ tool }}</button>
        </ToolbarItem>
      </div>
    </ToolbarRoot>

    <div class="main">
      <div class="panel left">
        <PageListRoot v-slot="{ pages, currentPageId, actions }">
          <div class="section">
            <h3>Pages</h3>
            <div
              v-for="item in pages"
              :key="item.id"
              :class="{ active: item.id === currentPageId }"
              class="list-item"
              @click="actions.switch(item.id)"
            >
              {{ item.name }}
            </div>
          </div>
        </PageListRoot>

        <LayerTreeRoot v-slot="{ visibleRows }">
          <div class="section">
            <h3>Layers</h3>
            <LayerTreeItem
              v-for="row in visibleRows"
              :key="row.node.id"
              v-slot="{ node, isSelected, padLeft, actions }"
              :node="row.node"
              :level="row.level"
              :has-children="row.hasChildren"
            >
              <div
                :class="{ active: isSelected }"
                :style="{ paddingLeft: `calc(${padLeft} + 8px)` }"
                class="list-item"
                @click="actions.select($event.shiftKey)"
              >
                <span v-if="row.hasChildren" class="toggle" @click.stop="actions.toggleExpand">
                  ▸
                </span>
                {{ node.name }}
              </div>
            </LayerTreeItem>
          </div>
        </LayerTreeRoot>
      </div>

      <CanvasRoot>
        <CanvasSurface class="canvas-area" />
      </CanvasRoot>

      <div class="panel right">
        <PositionControlsRoot v-slot="position">
          <div v-if="position.active" class="section">
            <h3>Position</h3>
            <label v-for="field in POSITION_FIELDS" :key="field">
              {{ FIELD_LABELS[field] }}
              <input
                type="number"
                :value="shownValue(position, field)"
                @change="setField(position, field, $event)"
              />
            </label>
          </div>
          <div v-else class="section">
            <p class="muted">No selection</p>
          </div>
        </PositionControlsRoot>
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: system-ui, sans-serif;
  background: #1e1e1e;
  color: #e0e0e0;
}

.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.toolbar {
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
}
.toolbar button {
  padding: 4px 10px;
  font-size: 11px;
  background: transparent;
  color: #ccc;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}
.toolbar button:hover {
  background: #3a3a3a;
}
.toolbar button.active {
  background: #4a90d9;
  color: white;
  border-color: #5a9fe9;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.panel {
  width: 220px;
  background: #252525;
  overflow-y: auto;
  flex-shrink: 0;
}
.panel.left {
  border-right: 1px solid #3a3a3a;
}
.panel.right {
  border-left: 1px solid #3a3a3a;
}

.section {
  padding: 8px;
}
.section h3 {
  font-size: 11px;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}

.list-item {
  padding: 4px 8px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
}
.list-item:hover {
  background: #333;
}
.list-item.active {
  background: #4a90d9;
  color: white;
}

.canvas-area {
  /* Takes the space between the panels; a flex item would otherwise keep the canvas width. */
  flex: 1;
  min-width: 0;
  height: 100%;
  display: block;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 4px;
}
label input {
  flex: 1;
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.muted {
  color: #666;
  font-size: 13px;
}
</style>
