import type { SceneGraph, SceneNode } from '@lawha/scene-graph'

import { readInteractions, screensOf, type Interaction, type Transition } from './model'

/** Words that mark a layer as moving forward, in English and Arabic. */
const FORWARD =
  /\b(next|continue|start|get started|sign ?in|log ?in|sign ?up|register|submit|send|buy|checkout|order|confirm|done|cta|go)\b|التالي|متابعة|تابع|ابدأ|دخول|تسجيل|إرسال|ارسال|اشتر|شراء|تأكيد|إتمام|اطلب/i
const BACK =
  /\b(back|previous|prev|close|cancel)\b|رجوع|عودة|السابق|إغلاق|اغلاق|إلغاء|[←‹]|arrow-left|chevron-left/i
const BUTTONISH = /\b(button|btn|cta|link)\b|زر/i

export interface AutoLink {
  screen: string
  node: string
  name: string
  kind: 'forward' | 'back' | 'nav'
  destination?: string
}

export interface AutoPlan {
  screens: string[]
  links: AutoLink[]
}

function label(node: SceneNode): string {
  return node.type === 'TEXT' ? `${node.name} ${node.text}` : node.name
}

function textOf(graph: SceneGraph, node: SceneNode): string {
  if (node.type === 'TEXT') return node.text
  const texts: string[] = []
  const walk = (id: string) => {
    const n = graph.getNode(id)
    if (!n) return
    if (n.type === 'TEXT') texts.push(n.text)
    n.childIds.forEach(walk)
  }
  node.childIds.forEach(walk)
  return texts.join(' ')
}

/**
 * The layer a click should land on for a match: a text inside a small container (a button)
 * stands for its container, so the whole button is clickable.
 */
function target(graph: SceneGraph, node: SceneNode, screen: SceneNode): SceneNode {
  if (node.type !== 'TEXT' || !node.parentId || node.parentId === screen.id) return node
  const parent = graph.getNode(node.parentId)
  if (!parent) return node
  const small = parent.width * parent.height < screen.width * screen.height * 0.25
  return small ? parent : node
}

function layers(graph: SceneGraph, screen: SceneNode): SceneNode[] {
  const out: SceneNode[] = []
  const walk = (id: string) => {
    const n = graph.getNode(id)
    if (!n || !n.visible) return
    out.push(n)
    n.childIds.forEach(walk)
  }
  screen.childIds.forEach(walk)
  return out
}

/** Screens in reading order: rows top to bottom, then left to right within a row. */
export function readingOrder(screens: readonly SceneNode[]): SceneNode[] {
  const rows: SceneNode[][] = []
  for (const s of [...screens].sort((a, b) => a.y - b.y)) {
    const row = rows.find((r) => Math.abs(r[0].y - s.y) < Math.min(r[0].height, s.height) / 2)
    if (row) row.push(s)
    else rows.push([s])
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x))
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Works out which layers to connect, without changing anything. */
export function planPrototype(graph: SceneGraph, pageId: string): AutoPlan {
  const screens = readingOrder(screensOf(graph, pageId))
  const byName = new Map(screens.map((s) => [norm(s.name), s.id]))
  const links: AutoLink[] = []
  screens.forEach((screen, index) => {
    const used = new Set<string>()
    const add = (node: SceneNode, kind: AutoLink['kind'], destination?: string) => {
      const t = target(graph, node, screen)
      if (used.has(t.id) || t.id === screen.id) return
      used.add(t.id)
      links.push({ screen: screen.id, node: t.id, name: t.name, kind, destination })
    }
    const all = layers(graph, screen)
    // Navigation: a layer whose text or name is another screen's name.
    for (const node of all) {
      const key = norm(node.type === 'TEXT' ? node.text : node.name)
      const dest = byName.get(key)
      if (dest && dest !== screen.id) add(node, 'nav', dest)
    }
    for (const node of all) if (BACK.test(label(node))) add(node, 'back')
    // The last screen has nowhere forward to go.
    if (index + 1 < screens.length) {
      const next = screens[index + 1]
      const forward =
        all.find((n) => FORWARD.test(label(n)) || (n.type !== 'TEXT' && FORWARD.test(n.name))) ??
        all.find((n) => n.type !== 'TEXT' && BUTTONISH.test(n.name) && !BACK.test(textOf(graph, n)))
      if (forward) add(forward, 'forward', next.id)
    }
  })
  return { screens: screens.map((s) => s.id), links }
}

export function opposite(direction: Transition['direction']): Transition['direction'] {
  return { left: 'right', right: 'left', up: 'down', down: 'up' }[
    direction
  ] as Transition['direction']
}

/** The interaction each planned link becomes, with the chosen transition. */
export function interactionFor(link: AutoLink, transition: Transition): Interaction {
  if (link.kind === 'back')
    return {
      trigger: { type: 'click' },
      action: {
        type: 'back',
        transition: { ...transition, direction: opposite(transition.direction) }
      }
    }
  return {
    trigger: { type: 'click' },
    action: { type: 'navigate', destination: link.destination ?? '', transition }
  }
}

/** Whether a layer already has a click interaction the user set. */
export function hasClick(node: SceneNode): boolean {
  return readInteractions(node).some((i) => i.trigger.type === 'click')
}
