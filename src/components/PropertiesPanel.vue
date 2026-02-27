<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'

import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

import ColorPicker from './ColorPicker.vue'
import { useEditorStore } from '../stores/editor'

import type { Color, Fill, Stroke, LayoutSizing, LayoutAlign, LayoutCounterAlign } from '../engine/scene-graph'

const store = useEditorStore()

const node = computed(() => store.selectedNode.value)
const multiCount = computed(() => store.selectedNodes.value.length)
const showIndividualPadding = ref(false)
const widthSizingOpen = ref(false)
const heightSizingOpen = ref(false)
const widthDimRef = ref<HTMLElement | null>(null)
const heightDimRef = ref<HTMLElement | null>(null)

onClickOutside(widthDimRef, () => { widthSizingOpen.value = false })
onClickOutside(heightDimRef, () => { heightSizingOpen.value = false })

const isInAutoLayout = computed(() => {
  const n = node.value
  if (!n?.parentId) return false
  const parent = store.graph.getNode(n.parentId)
  return parent ? parent.layoutMode !== 'NONE' : false
})

const widthSizing = computed(() => {
  const n = node.value
  if (!n) return 'FIXED'
  if (n.layoutMode !== 'NONE') {
    return n.layoutMode === 'HORIZONTAL' ? n.primaryAxisSizing : n.counterAxisSizing
  }
  if (isInAutoLayout.value && n.layoutGrow > 0) return 'FILL'
  return 'FIXED'
})

const heightSizing = computed(() => {
  const n = node.value
  if (!n) return 'FIXED'
  if (n.layoutMode !== 'NONE') {
    return n.layoutMode === 'VERTICAL' ? n.primaryAxisSizing : n.counterAxisSizing
  }
  if (isInAutoLayout.value && n.layoutAlignSelf === 'STRETCH') return 'FILL'
  return 'FIXED'
})

function setWidthSizing(sizing: LayoutSizing) {
  const n = node.value
  if (!n) return
  if (n.layoutMode !== 'NONE') {
    if (n.layoutMode === 'HORIZONTAL') updateProp('primaryAxisSizing', sizing)
    else updateProp('counterAxisSizing', sizing)
  } else if (isInAutoLayout.value) {
    updateProp('layoutGrow', sizing === 'FILL' ? 1 : 0)
  }
  widthSizingOpen.value = false
}

function setHeightSizing(sizing: LayoutSizing) {
  const n = node.value
  if (!n) return
  if (n.layoutMode !== 'NONE') {
    if (n.layoutMode === 'VERTICAL') updateProp('primaryAxisSizing', sizing)
    else updateProp('counterAxisSizing', sizing)
  } else if (isInAutoLayout.value) {
    updateProp('layoutAlignSelf', sizing === 'FILL' ? 'STRETCH' : 'AUTO')
  }
  heightSizingOpen.value = false
}

function sizingLabel(s: string) {
  if (s === 'HUG') return 'Hug'
  if (s === 'FILL') return 'Fill'
  return 'Fixed'
}

function hasUniformPadding() {
  const n = node.value
  if (!n) return true
  return n.paddingTop === n.paddingRight &&
    n.paddingRight === n.paddingBottom &&
    n.paddingBottom === n.paddingLeft
}

function setUniformPadding(v: number) {
  if (!node.value) return
  store.updateNode(node.value.id, {
    paddingTop: v,
    paddingRight: v,
    paddingBottom: v,
    paddingLeft: v
  })
}

const ALIGN_GRID: Array<{ primary: LayoutAlign; counter: LayoutCounterAlign }> = [
  { primary: 'MIN', counter: 'MIN' },
  { primary: 'CENTER', counter: 'MIN' },
  { primary: 'MAX', counter: 'MIN' },
  { primary: 'MIN', counter: 'CENTER' },
  { primary: 'CENTER', counter: 'CENTER' },
  { primary: 'MAX', counter: 'CENTER' },
  { primary: 'MIN', counter: 'MAX' },
  { primary: 'CENTER', counter: 'MAX' },
  { primary: 'MAX', counter: 'MAX' }
]

function setAlignment(primary: LayoutAlign, counter: LayoutCounterAlign) {
  if (!node.value) return
  store.updateNode(node.value.id, {
    primaryAxisAlign: primary,
    counterAxisAlign: counter
  })
}

function updateProp(key: string, value: number | string) {
  if (multiCount.value > 1) {
    for (const n of store.selectedNodes.value) {
      store.updateNode(n.id, { [key]: value })
    }
  } else if (node.value) {
    store.updateNode(node.value.id, { [key]: value })
  }
}

function updateFillColor(index: number, color: Color) {
  if (!node.value) return
  const fills = [...node.value.fills]
  fills[index] = { ...fills[index], color }
  store.updateNode(node.value.id, { fills })
}

function addFill() {
  if (!node.value) return
  const fill: Fill = {
    type: 'SOLID',
    color: { r: 0.83, g: 0.83, b: 0.83, a: 1 },
    opacity: 1,
    visible: true
  }
  store.updateNode(node.value.id, { fills: [...node.value.fills, fill] })
}

function removeFill(index: number) {
  if (!node.value) return
  const fills = node.value.fills.filter((_, i) => i !== index)
  store.updateNode(node.value.id, { fills })
}

function toggleFillVisibility(index: number) {
  if (!node.value) return
  const fills = [...node.value.fills]
  fills[index] = { ...fills[index], visible: !fills[index].visible }
  store.updateNode(node.value.id, { fills })
}

function addStroke() {
  if (!node.value) return
  const stroke: Stroke = {
    color: { r: 0, g: 0, b: 0, a: 1 },
    weight: 1,
    opacity: 1,
    visible: true,
    align: 'CENTER'
  }
  store.updateNode(node.value.id, { strokes: [...node.value.strokes, stroke] })
}

function updateStrokeColor(index: number, color: Color) {
  if (!node.value) return
  const strokes = [...node.value.strokes]
  strokes[index] = { ...strokes[index], color }
  store.updateNode(node.value.id, { strokes })
}

function updateStrokeWeight(index: number, weight: number) {
  if (!node.value) return
  const strokes = [...node.value.strokes]
  strokes[index] = { ...strokes[index], weight }
  store.updateNode(node.value.id, { strokes })
}

function removeStroke(index: number) {
  if (!node.value) return
  const strokes = node.value.strokes.filter((_, i) => i !== index)
  store.updateNode(node.value.id, { strokes })
}

function colorHex(c: Color) {
  const hex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`
}
</script>

<template>
  <aside class="properties-panel">
    <div class="panel-tabs">
      <button class="tab active">Design</button>
      <button class="tab">Prototype</button>
      <span class="zoom-display">{{ Math.round(store.state.zoom * 100) }}%</span>
    </div>

    <!-- Multi-select summary -->
    <div v-if="multiCount > 1" class="panel-scroll">
      <div class="section node-header">
        <span class="node-type">Mixed</span>
        <span class="node-name">{{ multiCount }} layers</span>
      </div>

      <div class="section">
        <label class="section-label">Appearance</label>
        <div class="opacity-row">
          <span class="prop-label">Opacity</span>
          <SliderRoot
            class="slider-root"
            :model-value="[Math.round((store.selectedNodes.value[0]?.opacity ?? 1) * 100)]"
            :max="100"
            :step="1"
            @update:model-value="(v) => updateProp('opacity', (v?.[0] ?? 100) / 100)"
          >
            <SliderTrack class="slider-track">
              <SliderRange class="slider-range" />
            </SliderTrack>
            <SliderThumb class="slider-thumb" />
          </SliderRoot>
          <span class="prop-value">{{ Math.round((store.selectedNodes.value[0]?.opacity ?? 1) * 100) }}%</span>
        </div>
      </div>
    </div>

    <!-- Single selection -->
    <div v-else-if="node" class="panel-scroll">
      <div class="section node-header">
        <span class="node-type">{{ node.type }}</span>
        <span class="node-name">{{ node.name }}</span>
      </div>

      <!-- Position -->
      <div class="section">
        <label class="section-label">Position</label>
        <div class="input-row">
          <label class="prop-input">
            <span class="prop-label">X</span>
            <input
              type="number"
              :value="Math.round(node.x)"
              @change="updateProp('x', +($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="prop-input">
            <span class="prop-label">Y</span>
            <input
              type="number"
              :value="Math.round(node.y)"
              @change="updateProp('y', +($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>

      <!-- Rotation -->
      <div class="section">
        <div class="input-row">
          <label class="prop-input">
            <span class="prop-label">R</span>
            <input
              type="number"
              :value="Math.round(node.rotation)"
              @change="updateProp('rotation', +($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>

      <!-- Dimensions -->
      <div class="section">
        <label class="section-label">Layout</label>
        <div class="input-row">
          <div ref="widthDimRef" class="dim-input">
            <span class="prop-label">W</span>
            <input
              type="number"
              :value="Math.round(node.width)"
              @change="updateProp('width', +($event.target as HTMLInputElement).value)"
            />
            <button
              v-if="node.layoutMode !== 'NONE' || isInAutoLayout"
              class="sizing-badge"
              @click="widthSizingOpen = !widthSizingOpen"
            >
              {{ sizingLabel(widthSizing) }}
            </button>
            <div v-if="widthSizingOpen" class="sizing-dropdown">
              <button
                :class="{ selected: widthSizing === 'FIXED' }"
                @click="setWidthSizing('FIXED')"
              >
                <span class="sizing-icon">↔</span>
                Fixed width ({{ Math.round(node.width) }})
              </button>
              <button
                v-if="node.layoutMode !== 'NONE'"
                :class="{ selected: widthSizing === 'HUG' }"
                @click="setWidthSizing('HUG')"
              >
                <span class="sizing-icon">↤↦</span>
                Hug contents
              </button>
              <button
                v-if="isInAutoLayout"
                :class="{ selected: widthSizing === 'FILL' }"
                @click="setWidthSizing('FILL')"
              >
                <span class="sizing-icon">⟷</span>
                Fill container
              </button>
            </div>
          </div>
          <div ref="heightDimRef" class="dim-input">
            <span class="prop-label">H</span>
            <input
              type="number"
              :value="Math.round(node.height)"
              @change="updateProp('height', +($event.target as HTMLInputElement).value)"
            />
            <button
              v-if="node.layoutMode !== 'NONE' || isInAutoLayout"
              class="sizing-badge"
              @click="heightSizingOpen = !heightSizingOpen"
            >
              {{ sizingLabel(heightSizing) }}
            </button>
            <div v-if="heightSizingOpen" class="sizing-dropdown">
              <button
                :class="{ selected: heightSizing === 'FIXED' }"
                @click="setHeightSizing('FIXED')"
              >
                <span class="sizing-icon">↕</span>
                Fixed height ({{ Math.round(node.height) }})
              </button>
              <button
                v-if="node.layoutMode !== 'NONE'"
                :class="{ selected: heightSizing === 'HUG' }"
                @click="setHeightSizing('HUG')"
              >
                <span class="sizing-icon">↤↦</span>
                Hug contents
              </button>
              <button
                v-if="isInAutoLayout"
                :class="{ selected: heightSizing === 'FILL' }"
                @click="setHeightSizing('FILL')"
              >
                <span class="sizing-icon">⟷</span>
                Fill container
              </button>
            </div>
          </div>
        </div>
        <div class="input-row">
          <label class="prop-input">
            <span class="prop-label">↻</span>
            <input
              type="number"
              :value="node.cornerRadius"
              @change="updateProp('cornerRadius', +($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>

      <!-- Auto Layout -->
      <div v-if="node.type === 'FRAME'" class="section">
        <div class="section-header">
          <label class="section-label">Auto layout</label>
          <button
            v-if="node.layoutMode === 'NONE'"
            class="section-add"
            title="Add auto layout (Shift+A)"
            @click="store.setLayoutMode(node.id, 'VERTICAL')"
          >
            +
          </button>
          <button
            v-else
            class="section-add"
            title="Remove auto layout"
            @click="store.setLayoutMode(node.id, 'NONE')"
          >
            −
          </button>
        </div>

        <template v-if="node.layoutMode !== 'NONE'">
          <!-- Direction -->
          <div class="layout-direction-row">
            <button
              class="dir-btn"
              :class="{ active: node.layoutMode === 'VERTICAL' }"
              title="Vertical layout"
              @click="store.setLayoutMode(node.id, 'VERTICAL')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="3" y="2" width="10" height="3" rx="0.5" fill="currentColor" />
                <rect x="3" y="6.5" width="10" height="3" rx="0.5" fill="currentColor" />
                <rect x="3" y="11" width="10" height="3" rx="0.5" fill="currentColor" />
              </svg>
            </button>
            <button
              class="dir-btn"
              :class="{ active: node.layoutMode === 'HORIZONTAL' }"
              title="Horizontal layout"
              @click="store.setLayoutMode(node.id, 'HORIZONTAL')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="2" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
                <rect x="6.5" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
                <rect x="11" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
              </svg>
            </button>
            <button
              class="dir-btn"
              :class="{ active: node.layoutWrap === 'WRAP' }"
              title="Wrap"
              @click="updateProp('layoutWrap', node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="2" y="2" width="5" height="5" rx="0.5" fill="currentColor" />
                <rect x="9" y="2" width="5" height="5" rx="0.5" fill="currentColor" />
                <rect x="2" y="9" width="5" height="5" rx="0.5" fill="currentColor" />
              </svg>
            </button>
          </div>

          <!-- Alignment grid + Gap -->
          <div class="layout-align-gap-row">
            <div class="align-grid">
              <button
                v-for="(a, i) in ALIGN_GRID"
                :key="i"
                class="align-dot"
                :class="{
                  active:
                    node.primaryAxisAlign === a.primary &&
                    node.counterAxisAlign === a.counter
                }"
                @click="setAlignment(a.primary, a.counter)"
              >
                <span class="dot" />
              </button>
            </div>
            <div class="gap-input">
              <svg class="gap-icon" width="14" height="14" viewBox="0 0 14 14">
                <rect x="0" y="1" width="4" height="12" rx="0.5" fill="currentColor" opacity="0.4" />
                <rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="10" y="1" width="4" height="12" rx="0.5" fill="currentColor" opacity="0.4" />
              </svg>
              <input
                type="number"
                :value="node.itemSpacing"
                min="0"
                @change="updateProp('itemSpacing', +($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <!-- Padding -->
          <div class="layout-padding-row">
            <template v-if="showIndividualPadding || !hasUniformPadding()">
              <div class="padding-grid">
                <div class="pad-cell pad-top">
                  <input
                    type="number"
                    :value="node.paddingTop"
                    min="0"
                    @change="updateProp('paddingTop', +($event.target as HTMLInputElement).value)"
                  />
                </div>
                <div class="pad-cell pad-right">
                  <input
                    type="number"
                    :value="node.paddingRight"
                    min="0"
                    @change="updateProp('paddingRight', +($event.target as HTMLInputElement).value)"
                  />
                </div>
                <div class="pad-cell pad-bottom">
                  <input
                    type="number"
                    :value="node.paddingBottom"
                    min="0"
                    @change="updateProp('paddingBottom', +($event.target as HTMLInputElement).value)"
                  />
                </div>
                <div class="pad-cell pad-left">
                  <input
                    type="number"
                    :value="node.paddingLeft"
                    min="0"
                    @change="updateProp('paddingLeft', +($event.target as HTMLInputElement).value)"
                  />
                </div>
              </div>
            </template>
            <template v-else>
              <div class="padding-uniform">
                <svg class="pad-icon" width="14" height="14" viewBox="0 0 14 14">
                  <rect x="0" y="0" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1" />
                  <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" opacity="0.3" />
                </svg>
                <input
                  type="number"
                  :value="node.paddingTop"
                  min="0"
                  @change="setUniformPadding(+($event.target as HTMLInputElement).value)"
                />
              </div>
            </template>
            <button
              class="pad-toggle"
              :class="{ active: showIndividualPadding || !hasUniformPadding() }"
              title="Individual padding"
              @click="showIndividualPadding = !showIndividualPadding"
            >
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect x="0" y="0" width="14" height="4" rx="1" fill="currentColor" opacity="0.6" />
                <rect x="10" y="0" width="4" height="14" rx="1" fill="currentColor" opacity="0.6" />
                <rect x="0" y="10" width="14" height="4" rx="1" fill="currentColor" opacity="0.6" />
                <rect x="0" y="0" width="4" height="14" rx="1" fill="currentColor" opacity="0.6" />
              </svg>
            </button>
          </div>
        </template>
      </div>

      <!-- Appearance -->
      <div class="section">
        <label class="section-label">Appearance</label>
        <div class="opacity-row">
          <span class="prop-label">Opacity</span>
          <SliderRoot
            class="slider-root"
            :model-value="[Math.round(node.opacity * 100)]"
            :max="100"
            :step="1"
            @update:model-value="(v) => updateProp('opacity', (v?.[0] ?? 100) / 100)"
          >
            <SliderTrack class="slider-track">
              <SliderRange class="slider-range" />
            </SliderTrack>
            <SliderThumb class="slider-thumb" />
          </SliderRoot>
          <span class="prop-value">{{ Math.round(node.opacity * 100) }}%</span>
        </div>
      </div>

      <!-- Fill -->
      <div class="section">
        <div class="section-header">
          <label class="section-label">Fill</label>
          <button class="section-add" @click="addFill">+</button>
        </div>
        <div v-for="(fill, i) in node.fills" :key="i" class="fill-row">
          <button
            class="visibility-toggle"
            :class="{ hidden: !fill.visible }"
            @click="toggleFillVisibility(i)"
          >
            {{ fill.visible ? '◉' : '○' }}
          </button>
          <ColorPicker :color="fill.color" @update="updateFillColor(i, $event)" />
          <span class="color-hex">{{ colorHex(fill.color) }}</span>
          <button class="remove-btn" @click="removeFill(i)">×</button>
        </div>
      </div>

      <!-- Stroke -->
      <div class="section">
        <div class="section-header">
          <label class="section-label">Stroke</label>
          <button class="section-add" @click="addStroke">+</button>
        </div>
        <div v-for="(stroke, i) in node.strokes" :key="i" class="fill-row">
          <ColorPicker :color="stroke.color" @update="updateStrokeColor(i, $event)" />
          <span class="color-hex">{{ colorHex(stroke.color) }}</span>
          <input
            type="number"
            class="stroke-weight"
            :value="stroke.weight"
            min="0"
            @change="updateStrokeWeight(i, +($event.target as HTMLInputElement).value)"
          />
          <button class="remove-btn" @click="removeStroke(i)">×</button>
        </div>
      </div>

      <!-- Effects -->
      <div class="section">
        <label class="section-label">Effects</label>
      </div>

      <!-- Export -->
      <div class="section">
        <label class="section-label">Export</label>
      </div>
    </div>

    <div v-else class="panel-empty">No selection</div>
  </aside>
</template>

<style scoped>
.properties-panel {
  width: 241px;
  background: var(--panel-bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.tab {
  padding: 4px 10px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
}

.tab.active {
  color: var(--text);
  font-weight: 600;
}

.zoom-display {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.zoom-display:hover {
  background: var(--hover);
}

.panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 16px;
}

.panel-empty {
  padding: 16px 12px;
  color: var(--text-muted);
  font-size: 12px;
}

.section {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.section-add {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  border-radius: 4px;
}

.section-add:hover {
  background: var(--hover);
  color: var(--text);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-type {
  font-size: 11px;
  color: var(--text-muted);
}

.node-name {
  font-size: 12px;
  font-weight: 600;
}

.input-row {
  display: flex;
  gap: 6px;
}

.prop-input {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.prop-input.full {
  flex-basis: 100%;
}

.prop-label {
  font-size: 11px;
  color: var(--text-muted);
  width: 14px;
  flex-shrink: 0;
}

.prop-input input[type='number'] {
  flex: 1;
  min-width: 0;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 3px 6px;
  font: inherit;
  font-size: 12px;
}

.opacity-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-root {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  height: 16px;
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

.slider-track {
  position: relative;
  flex-grow: 1;
  height: 3px;
  background: var(--border);
  border-radius: 2px;
}

.slider-range {
  position: absolute;
  height: 100%;
  background: var(--accent, #3b82f6);
  border-radius: 2px;
}

.slider-thumb {
  display: block;
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
  outline: none;
  cursor: pointer;
  transition: box-shadow 0.1s;
}

.slider-thumb:hover {
  box-shadow: 0 0 0 2px var(--accent, #3b82f6);
}

.slider-thumb:focus-visible {
  box-shadow: 0 0 0 2px var(--accent, #3b82f6);
}

.prop-value {
  font-size: 11px;
  color: var(--text-muted);
  width: 32px;
  text-align: right;
}

.fill-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}

.visibility-toggle {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  width: 16px;
  text-align: center;
}

.visibility-toggle.hidden {
  opacity: 0.4;
}

.color-hex {
  font-size: 12px;
  font-family: monospace;
  flex: 1;
}

.remove-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.1s;
}

.fill-row:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  color: var(--text);
}

.dim-input {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  position: relative;
}

.dim-input input[type='number'] {
  flex: 1;
  min-width: 0;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 3px 6px;
  font: inherit;
  font-size: 12px;
}

.sizing-badge {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 10px;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}

.sizing-badge:hover {
  background: var(--hover);
  color: var(--text);
}

.sizing-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--panel-bg, #2c2c2c);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 160px;
}

.sizing-dropdown button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
}

.sizing-dropdown button:hover {
  background: var(--hover);
}

.sizing-dropdown button.selected {
  color: var(--accent, #3b82f6);
}

.sizing-icon {
  width: 16px;
  text-align: center;
  font-size: 11px;
  opacity: 0.7;
}

.layout-direction-row {
  display: flex;
  gap: 2px;
  margin-top: 6px;
}

.dir-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--input-bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.dir-btn.active {
  background: var(--accent, #3b82f6);
  color: white;
  border-color: var(--accent, #3b82f6);
}

.dir-btn:hover:not(.active) {
  background: var(--hover);
  color: var(--text);
}

.layout-align-gap-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.align-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 4px;
  background: var(--input-bg);
  border-radius: 4px;
  border: 1px solid var(--border);
}

.align-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  border-radius: 2px;
}

.align-dot:hover {
  background: var(--hover);
}

.align-dot .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-muted);
  opacity: 0.4;
}

.align-dot.active .dot {
  background: var(--accent, #3b82f6);
  opacity: 1;
  width: 6px;
  height: 6px;
}

.gap-input {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.gap-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.gap-input input[type='number'] {
  flex: 1;
  min-width: 0;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 3px 6px;
  font: inherit;
  font-size: 12px;
}

.layout-padding-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 6px;
}

.padding-uniform {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.pad-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.padding-uniform input[type='number'] {
  flex: 1;
  min-width: 0;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 3px 6px;
  font: inherit;
  font-size: 12px;
}

.padding-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  flex: 1;
}

.pad-cell input[type='number'] {
  width: 100%;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 3px 4px;
  font: inherit;
  font-size: 11px;
  text-align: center;
}

.pad-cell input::-webkit-inner-spin-button {
  display: none;
}

.pad-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  flex-shrink: 0;
}

.pad-toggle:hover {
  background: var(--hover);
  color: var(--text);
}

.pad-toggle.active {
  background: var(--accent, #3b82f6);
  color: white;
  border-color: var(--accent, #3b82f6);
}

.prop-input select {
  flex: 1;
  min-width: 0;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 3px 4px;
  font: inherit;
  font-size: 11px;
}

.stroke-weight {
  width: 36px;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 2px 4px;
  font: inherit;
  font-size: 11px;
  text-align: center;
}

.stroke-weight::-webkit-inner-spin-button {
  display: none;
}
</style>
