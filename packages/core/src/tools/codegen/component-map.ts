import { defineTool } from '#core/tools/schema'

import type { FigmaAPI } from '#core/figma-api'
import type { SceneGraph, SceneNode } from '#core/scene-graph'

interface ComponentInfo {
  id: string
  name: string
  type: string
  width: number
  height: number
  variants: string[]
  instanceCount: number
  propCandidates: string[]
  usedOnScreens: string[]
}

interface ScreenInfo {
  id: string
  name: string
  width: number
  height: number
  componentRefs: { id: string; name: string; count: number }[]
  topLevelSections: number
}

function collectInstanceCounts(figma: FigmaAPI, componentIds: Set<string>): Map<string, number> {
  const counts = new Map<string, number>()
  const page = figma.currentPage

  page.findAll((node) => {
    if (node.type !== 'INSTANCE') return false
    const raw = figma.graph.getNode(node.id)
    if (!raw?.componentId) return false
    if (componentIds.has(raw.componentId)) {
      counts.set(raw.componentId, (counts.get(raw.componentId) ?? 0) + 1)
    }
    return false
  })

  return counts
}

function detectPropCandidates(node: SceneNode, graph: SceneGraph): string[] {
  const props: string[] = []

  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child) continue
    if (child.type === 'TEXT' && child.text) {
      props.push(`text:${child.name}`)
    }
    if (child.fills.some((fill) => fill.visible && fill.type === 'SOLID')) {
      const hasBoundVar = Object.keys(child.boundVariables).length > 0
      if (hasBoundVar) props.push(`color:${child.name}`)
    }
    if (child.type === 'FRAME' || child.type === 'GROUP') {
      props.push(`slot:${child.name}`)
    }
  }

  return props
}

function detectVariants(componentNode: SceneNode, graph: SceneGraph): string[] {
  if (componentNode.type !== 'COMPONENT_SET') return []

  const variants: string[] = []
  for (const childId of componentNode.childIds) {
    const child = graph.getNode(childId)
    if (child?.type === 'COMPONENT') variants.push(child.name)
  }
  return variants
}

function buildScreenInfo(
  figma: FigmaAPI,
  frameNode: SceneNode,
  componentIds: Set<string>
): ScreenInfo {
  const refs = new Map<string, { name: string; count: number }>()
  let topLevelSections = 0

  const walk = (nodeId: string) => {
    const node = figma.graph.getNode(nodeId)
    if (!node) return
    if (node.type === 'SECTION') topLevelSections++
    if (node.type === 'INSTANCE' && node.componentId && componentIds.has(node.componentId)) {
      const entry = refs.get(node.componentId)
      if (entry) entry.count++
      else {
        const component = figma.graph.getNode(node.componentId)
        refs.set(node.componentId, { name: component?.name ?? node.componentId, count: 1 })
      }
    }
    for (const childId of node.childIds) walk(childId)
  }

  for (const childId of frameNode.childIds) walk(childId)

  return {
    id: frameNode.id,
    name: frameNode.name,
    width: frameNode.width,
    height: frameNode.height,
    componentRefs: [...refs.entries()].map(([id, { name, count }]) => ({ id, name, count })),
    topLevelSections,
  }
}

export const designToComponentMap = defineTool({
  name: 'design_to_component_map',
  description:
    'Analyze the document and return a structured component decomposition: components (with variants, props, instance counts), screens, and a dependency overview.',
  params: {
    page: {
      type: 'string',
      description: 'Page name to analyze (default: current page)',
    },
  },
  execute: (figma, args) => {
    if (args.page) {
      const target = figma.root.children.find((page) => page.name === args.page)
      if (target) figma.currentPage = target
      else return { error: `Page "${args.page}" not found` }
    }

    const page = figma.currentPage
    const components: ComponentInfo[] = []
    const componentIds = new Set<string>()

    page.findAll((node) => {
      if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
      const raw = figma.graph.getNode(node.id)
      if (!raw) return false

      componentIds.add(raw.id)
      components.push({
        id: raw.id,
        name: raw.name,
        type: raw.type,
        width: raw.width,
        height: raw.height,
        variants: detectVariants(raw, figma.graph),
        instanceCount: 0,
        propCandidates: detectPropCandidates(raw, figma.graph),
        usedOnScreens: [],
      })
      return false
    })

    const instanceCounts = collectInstanceCounts(figma, componentIds)
    for (const component of components) {
      component.instanceCount = instanceCounts.get(component.id) ?? 0
    }

    const screens: ScreenInfo[] = []
    const topFrames = page.children.filter((child) => {
      const raw = figma.graph.getNode(child.id)
      if (!raw) return false
      if (raw.type === 'COMPONENT' || raw.type === 'COMPONENT_SET') return false
      if (raw.type === 'SECTION') return false
      return raw.width >= 200 && raw.height >= 200
    })

    for (const frame of topFrames) {
      const raw = figma.graph.getNode(frame.id)
      if (!raw) continue
      const screen = buildScreenInfo(figma, raw, componentIds)
      screens.push(screen)

      for (const ref of screen.componentRefs) {
        const component = components.find((candidate) => candidate.id === ref.id)
        if (component) component.usedOnScreens.push(screen.name)
      }
    }

    const sections: { id: string; name: string; childCount: number }[] = []
    for (const child of page.children) {
      const raw = figma.graph.getNode(child.id)
      if (raw?.type === 'SECTION') {
        sections.push({ id: raw.id, name: raw.name, childCount: raw.childIds.length })
      }
    }

    return {
      componentCount: components.length,
      screenCount: screens.length,
      components: components.sort((a, b) => b.instanceCount - a.instanceCount),
      screens,
      sections,
    }
  },
})
