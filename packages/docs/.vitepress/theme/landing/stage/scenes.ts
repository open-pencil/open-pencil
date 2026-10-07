import dedent from 'dedent'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { computeAllLayouts } from '@open-pencil/core/layout'

import type { EditorStore } from '@/app/editor/active-store'
import { loadFont } from '@/app/editor/fonts'
// The app's own demo, prebuilt from `tools/generate/demo`; the docs config ensures it exists.
import demoFigURL from '#app-public/demo.fig?url'

// Placeholder: a third-party preview file, to be replaced with one we publish ourselves.
import sampleFigURL from './assets/sample.fig?url'

const GUARANTEES = [
  { title: 'Opens .fig', detail: 'Bring your Figma files with you.' },
  { title: 'MIT licensed', detail: 'Read, fork, and ship all of it.' },
  { title: 'Your AI keys', detail: 'Any provider. Nothing goes through us.' }
]

export const GUARANTEES_JSX = [
  '<Frame name="Guarantees" w="fill" h="hug" flex="row" gap={12}>',
  ...GUARANTEES.flatMap(({ title, detail }) => [
    '  <Frame name="Guarantee" grow={1} h="hug" flex="col" gap={4} p={16} bg="#F4F5FA" rounded={12}>',
    `    <Text name="Title" size={14} weight={600} color="#11131F">${title}</Text>`,
    `    <Text name="Detail" w="fill" size={13} lineHeight={19} color="#5B6072">${detail}</Text>`,
    '  </Frame>'
  ]),
  '</Frame>'
].join('\n')

function pricingJSX(): string {
  return dedent`
    <Frame name="Pricing" w={720} h="hug" flex="col" gap={28} p={40} bg="#FFFFFF" rounded={24}>
      <Frame name="Header" w="fill" h="hug" flex="col" gap={10}>
        <Text name="Eyebrow" size={12} weight={600} color="#3B5BDB" letterSpacing={1} textCase="upper">Plans</Text>
        <Text name="Title" w="fill" size={34} weight="bold" color="#11131F">Own your design stack</Text>
        <Text name="Subtitle" w="fill" size={16} lineHeight={24} color="#5B6072">Open files, open formats, and storage you control.</Text>
      </Frame>
      <Frame name="Plans" w="fill" h="hug" flex="row" gap={20}>
        <Frame name="Plan / Local" grow={1} h="hug" flex="col" gap={18} p={24} bg="#F4F5FA" rounded={16}>
          <Text name="Plan name" size={14} weight={600} color="#5B6072">Local</Text>
          <Frame name="Price" w="fill" h="hug" flex="col" gap={2}>
            <Text name="Amount" size={40} weight="bold" color="#11131F">$0</Text>
            <Text name="Period" size={14} color="#5B6072">forever</Text>
          </Frame>
          <Text name="Summary" w="fill" size={14} lineHeight={21} color="#5B6072">The full editor on your machine. No account.</Text>
          <Frame name="Button" w="fill" h={44} flex="row" justify="center" items="center" bg="#11131F" rounded={10}>
            <Text name="Label" size={14} weight={600} color="#FFFFFF">Download</Text>
          </Frame>
        </Frame>
        <Frame name="Plan / Self-hosted" grow={1} h="hug" flex="col" gap={18} p={24} bg="#11131F" rounded={16}>
          <Text name="Plan name" size={14} weight={600} color="#A5B4FC">Self-hosted</Text>
          <Frame name="Price" w="fill" h="hug" flex="col" gap={2}>
            <Text name="Amount" size={40} weight="bold" color="#FFFFFF">Yours</Text>
            <Text name="Period" size={14} color="#9AA0B4">on your servers</Text>
          </Frame>
          <Text name="Summary" w="fill" size={14} lineHeight={21} color="#9AA0B4">Your storage, your identity provider, your rules.</Text>
          <Frame name="Button" w="fill" h={44} flex="row" justify="center" items="center" bg="#3B5BDB" rounded={10}>
            <Text name="Label" size={14} weight={600} color="#FFFFFF">Coming soon</Text>
          </Frame>
        </Frame>
      </Frame>
    </Frame>
  `
}

async function finish(store: EditorStore): Promise<void> {
  const pageId = store.state.currentPageId
  await store.loadFontsForNodes(store.graph.getChildren(pageId).map((node) => node.id))
  computeAllLayouts(store.graph, pageId)
  store.clearSelection()
  store.zoomToFit()
  store.requestRender()
}

const INTER_STYLES = ['Regular', 'Medium', 'SemiBold', 'Bold']

/** Text is measured as it is laid out, so the faces it uses load first. */
async function loadInter(): Promise<void> {
  await Promise.all(INTER_STYLES.map((style) => loadFont('Inter', style)))
}

async function openFig(store: EditorStore, url: string, name: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${name} is unavailable (${response.status})`)
  await store.openFigFile(new File([await response.blob()], name))
}

/** Opens the app's demo and frames one of its sections, as the app's demo route would show it. */
async function demoSection(store: EditorStore, section: string): Promise<void> {
  await openFig(store, demoFigURL, 'Demo.fig')
  const id = findByName(store, section)
  const node = id ? store.graph.getNode(id) : undefined
  if (!node) {
    store.zoomToFit()
    return
  }
  const { x, y } = store.graph.getAbsolutePosition(node.id)
  store.zoomToBounds(x, y, x + node.width, y + node.height)
}

export function findByName(store: EditorStore, name: string): string | null {
  const pending = store.graph.getChildren(store.state.currentPageId).map((node) => node.id)
  while (pending.length > 0) {
    const id = pending.shift()
    const node = id ? store.graph.getNode(id) : undefined
    if (!node) continue
    if (node.name === name) return node.id
    pending.push(...node.childIds)
  }
  return null
}

async function pricing(store: EditorStore): Promise<void> {
  await loadInter()
  await renderJSX(store.graph, pricingJSX(), {
    parentId: store.state.currentPageId,
    x: 0,
    y: 0
  })
  await finish(store)
}

/** A plan card selected, so the block's panel has something to show from the start. */
async function pricingWithSelection(store: EditorStore): Promise<void> {
  await pricing(store)
  const plan = findByName(store, 'Plan / Local')
  if (plan) store.select([plan])
}

export type SceneBuilder = (store: EditorStore) => Promise<void>

export const SCENES = {
  announcement: (store) => demoSection(store, 'Announcement system'),
  figma: async (store) => {
    await openFig(store, sampleFigURL, 'Preview.fig')
    store.zoomToFit()
  },
  components: (store) => demoSection(store, 'Components'),
  pricing: (store) => pricing(store),
  pricingSelected: pricingWithSelection
} satisfies Record<string, SceneBuilder>
