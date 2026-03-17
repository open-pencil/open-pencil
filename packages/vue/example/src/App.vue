<script setup lang="ts">
import { createEditor, type Tool } from '@open-pencil/core/editor'
import {
  OpenPencilProvider,
  CanvasRoot,
  CanvasSurface,
  LayerTree,
  ToolbarRoot,
  ToolbarItem,
  NodeProperties
} from '@open-pencil/vue'

const editor = createEditor()
const pages = () => editor.graph.getPages()
const currentPageId = () => editor.state.currentPageId

editor.createShape('FRAME', 100, 100, 400, 300)
editor.createShape('RECTANGLE', 150, 150, 120, 80)
editor.createShape('ELLIPSE', 350, 200, 100, 100)

editor.zoomToFit()

const TOOL_LIST: Tool[] = [
  'SELECT', 'FRAME', 'RECTANGLE', 'ELLIPSE',
  'LINE', 'POLYGON', 'STAR', 'TEXT', 'PEN', 'HAND'
]
</script>

<template>
  <OpenPencilProvider :editor="editor">
    <div class="layout">
      <ToolbarRoot>
        <div class="toolbar">
          <ToolbarItem v-for="tool in TOOL_LIST" :key="tool" v-slot="{ active, select }" :tool="tool">
            <button :class="{ active }" @click="select">{{ tool }}</button>
          </ToolbarItem>
        </div>
      </ToolbarRoot>

      <div class="main">
        <div class="panel left">
          <div class="section">
            <h3>Pages</h3>
            <div
              v-for="page in pages()"
              :key="page.id"
              :class="{ active: page.id === currentPageId() }"
              class="list-item"
              @click="editor.switchPage(page.id)"
            >
              {{ page.name }}
            </div>
          </div>

          <LayerTree v-slot="{ layers, selectedIds, select }">
            <div class="section">
              <h3>Layers</h3>
              <div
                v-for="layer in layers"
                :key="layer.node.id"
                :class="{ active: selectedIds.has(layer.node.id) }"
                :style="{ paddingLeft: layer.depth * 12 + 8 + 'px' }"
                class="list-item"
                @click="select([layer.node.id])"
              >
                {{ layer.node.name }}
              </div>
            </div>
          </LayerTree>
        </div>

        <CanvasRoot>
          <CanvasSurface class="canvas-area" style="width: 100%; height: 100%; display: block" />
        </CanvasRoot>

        <div class="panel right">
          <NodeProperties v-slot="{ node, update }">
            <div v-if="node" class="section">
              <h3>{{ node.type }}</h3>
              <label>
                X <input type="number" :value="node.x" @change="update({ x: +($event.target as HTMLInputElement).value })">
              </label>
              <label>
                Y <input type="number" :value="node.y" @change="update({ y: +($event.target as HTMLInputElement).value })">
              </label>
              <label>
                W <input type="number" :value="node.width" @change="update({ width: +($event.target as HTMLInputElement).value })">
              </label>
              <label>
                H <input type="number" :value="node.height" @change="update({ height: +($event.target as HTMLInputElement).value })">
              </label>
            </div>
            <div v-else class="section">
              <p class="muted">No selection</p>
            </div>
          </NodeProperties>
        </div>
      </div>
    </div>
  </OpenPencilProvider>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #1e1e1e; color: #e0e0e0; }

.layout { display: flex; flex-direction: column; height: 100vh; }

.toolbar {
  display: flex; gap: 2px; padding: 4px 8px;
  background: #2a2a2a; border-bottom: 1px solid #3a3a3a;
}
.toolbar button {
  padding: 4px 10px; font-size: 11px; background: transparent;
  color: #ccc; border: 1px solid transparent; border-radius: 4px; cursor: pointer;
}
.toolbar button:hover { background: #3a3a3a; }
.toolbar button.active { background: #4a90d9; color: white; border-color: #5a9fe9; }

.main { display: flex; flex: 1; overflow: hidden; }

.panel { width: 220px; background: #252525; overflow-y: auto; flex-shrink: 0; }
.panel.left { border-right: 1px solid #3a3a3a; }
.panel.right { border-left: 1px solid #3a3a3a; }

.section { padding: 8px; }
.section h3 { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 0.5px; }

.list-item { padding: 4px 8px; font-size: 13px; border-radius: 4px; cursor: pointer; }
.list-item:hover { background: #333; }
.list-item.active { background: #4a90d9; color: white; }

.canvas-area { flex: 1; }

label { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
label input {
  flex: 1; background: #1e1e1e; border: 1px solid #3a3a3a;
  color: #e0e0e0; padding: 3px 6px; border-radius: 3px; font-size: 12px;
}

.muted { color: #666; font-size: 13px; }
</style>
