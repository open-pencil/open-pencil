import * as v from 'valibot'

import type { FigmaAPI } from '#core/figma-api'
import { hasClick, interactionFor, planPrototype } from '#core/prototype/auto'
import {
  FLOWS_KEY,
  INTERACTIONS_KEY,
  readFlows,
  readInteractions,
  screensOf,
  type Flow,
  type Interaction
} from '#core/prototype/model'
import {
  actionSchema,
  flowSchema,
  interactionSchema,
  transitionSchema,
  triggerSchema
} from '#core/prototype/schema'
import { defineTool, requireNode } from '#core/tools/schema'

function writeInteractions(figma: FigmaAPI, id: string, list: readonly Interaction[]): void {
  const node = requireNode(figma, id)
  if (!node) return
  node.setPluginData(INTERACTIONS_KEY, list.length > 0 ? JSON.stringify(list) : '')
}

function writeFlows(figma: FigmaAPI, flows: readonly Flow[]): void {
  figma.currentPage.setPluginData(FLOWS_KEY, flows.length > 0 ? JSON.stringify(flows) : '')
}

function pageNode(figma: FigmaAPI) {
  const page = figma.graph.getNode(figma.currentPage.id)
  if (!page) throw new Error('No current page')
  return page
}

/** Destinations must be layers on this page, so a saved prototype never points nowhere. */
function checkDestinations(figma: FigmaAPI, list: readonly Interaction[]): string | null {
  for (const { action } of list) {
    if (!('destination' in action)) continue
    if (!figma.graph.getNode(action.destination))
      return `Destination ${action.destination} not found`
  }
  return null
}

export const getPrototype = defineTool({
  name: 'get_prototype',
  description:
    'Read the prototype on the current page: its flows (name and starting screen), its screens, and every layer’s interactions (trigger, action, transition).',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({}),
  execute: (figma) => {
    const page = pageNode(figma)
    const interactions: { id: string; name: string; interactions: Interaction[] }[] = []
    const walk = (id: string) => {
      const node = figma.graph.getNode(id)
      if (!node) return
      const list = readInteractions(node)
      if (list.length > 0) interactions.push({ id: node.id, name: node.name, interactions: list })
      node.childIds.forEach(walk)
    }
    page.childIds.forEach(walk)
    return {
      flows: readFlows(page),
      screens: screensOf(figma.graph, page.id).map((s) => ({ id: s.id, name: s.name })),
      interactions
    }
  }
})

export const setInteractions = defineTool({
  name: 'set_interactions',
  description:
    'Replace a layer’s prototype interactions. Each has a trigger (click, hover, press, after-delay with delay ms, key) and an action (navigate, back, overlay, close-overlay, scroll-to, open-url) with a transition (instant, dissolve, slide-in, slide-out, push, move-in, smart-animate; direction, duration ms, easing). Pass [] to remove them.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Layer that triggers the interactions')),
    interactions: v.pipe(v.array(interactionSchema), v.maxLength(20))
  }),
  execute: (figma, args) => {
    const error = checkDestinations(figma, args.interactions)
    if (error) return { error }
    writeInteractions(figma, args.id, args.interactions)
    return { id: args.id, interactions: args.interactions.length }
  }
})

export const addInteraction = defineTool({
  name: 'add_interaction',
  description:
    'Add one prototype interaction to a layer, replacing any it already has for the same trigger.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Layer that triggers the interaction')),
    trigger: triggerSchema,
    action: actionSchema
  }),
  execute: (figma, args) => {
    const node = requireNode(figma, args.id)
    if (!node) return { error: `Node ${args.id} not found` }
    const added: Interaction = { trigger: args.trigger, action: args.action }
    const error = checkDestinations(figma, [added])
    if (error) return { error }
    const raw = figma.graph.getNode(args.id)
    const kept = raw
      ? readInteractions(raw).filter((i) => i.trigger.type !== args.trigger.type)
      : []
    writeInteractions(figma, args.id, [...kept, added])
    return { id: args.id, interactions: kept.length + 1 }
  }
})

export const setFlow = defineTool({
  name: 'set_flow',
  description:
    'Create or update a prototype flow (a named starting screen) on the current page. Pass remove: true to delete the flow with that name.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    name: v.pipe(v.string(), v.minLength(1)),
    start: v.optional(v.pipe(v.string(), v.description('Starting screen (top-level frame) id'))),
    remove: v.optional(v.boolean(), false)
  }),
  execute: (figma, args) => {
    const page = pageNode(figma)
    const flows = readFlows(page).filter((f) => f.name !== args.name)
    if (!args.remove) {
      if (!args.start) return { error: 'start is required unless removing the flow' }
      const screens = new Set(screensOf(figma.graph, page.id).map((s) => s.id))
      if (!screens.has(args.start))
        return { error: 'A flow must start on a screen (a top-level frame)' }
      flows.push(v.parse(flowSchema, { name: args.name, start: args.start }))
    }
    writeFlows(figma, flows)
    return { flows }
  }
})

export const autoPrototype = defineTool({
  name: 'auto_prototype',
  description:
    'Turn the page’s screens into a clickable prototype in one step: orders screens as read, links each screen’s forward button (Next, Continue, Sign in, التالي, متابعة…) to the next screen, makes Back/Close buttons go back, and links navigation items named after another screen to it. Adds a flow starting at the first screen. Layers that already have a click interaction are kept unless replace is true.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    transition: v.optional(transitionSchema, {
      type: 'slide-in',
      direction: 'left',
      duration: 300,
      easing: 'ease-out'
    }),
    replace: v.optional(v.boolean(), false),
    flow_name: v.optional(v.pipe(v.string(), v.minLength(1)), 'Flow 1'),
    dry_run: v.optional(v.boolean(), false)
  }),
  execute: (figma, args) => {
    const page = pageNode(figma)
    const plan = planPrototype(figma.graph, page.id)
    if (plan.screens.length === 0)
      return { error: 'No screens on this page: add top-level frames first' }
    const transition = v.parse(transitionSchema, args.transition)
    const applied = plan.links.filter((link) => {
      const node = figma.graph.getNode(link.node)
      return node && (args.replace || !hasClick(node))
    })
    if (!args.dry_run) {
      for (const link of applied) {
        const node = figma.graph.getNode(link.node)
        const others = node ? readInteractions(node).filter((i) => i.trigger.type !== 'click') : []
        writeInteractions(figma, link.node, [...others, interactionFor(link, transition)])
      }
      const flows = readFlows(page)
      if (!flows.some((f) => f.start === plan.screens[0]))
        writeFlows(figma, [
          ...flows.filter((f) => f.name !== args.flow_name),
          { name: args.flow_name, start: plan.screens[0] }
        ])
    }
    return {
      screens: plan.screens.length,
      linked: applied.length,
      skipped: plan.links.length - applied.length,
      links: applied.map((l) => ({
        node: l.node,
        name: l.name,
        kind: l.kind,
        destination: l.destination
      })),
      flow: { name: args.flow_name, start: plan.screens[0] },
      dryRun: args.dry_run
    }
  }
})
