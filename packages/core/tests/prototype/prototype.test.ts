import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@lawha/core/figma-api'
import { ALL_TOOLS, isToolExposed } from '@lawha/core/tools'
import { SceneGraph } from '@lawha/scene-graph'

import { planPrototype, readingOrder } from '#core/prototype/auto'
import {
  activeScreen,
  clickOutside,
  fire,
  hotspots,
  keyPress,
  reachable,
  start,
  timers,
  trigger
} from '#core/prototype/engine'
import { readFlows, readInteractions, type Interaction } from '#core/prototype/model'

function tool(name: string) {
  const found = ALL_TOOLS.find((item) => item.name === name)
  if (!found) throw new Error(`No tool ${name}`)
  return (figma: FigmaAPI, args: Record<string, unknown>) => found.execute(figma, args)
}

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('expected a value')
  return value
}

/** Login → Home → Profile, laid out left to right, with a button, a tab bar and a back arrow. */
function app() {
  const figma = new FigmaAPI(new SceneGraph())
  const screen = (name: string, x: number) => {
    const f = figma.createFrame()
    f.name = name
    f.resize(390, 844)
    f.x = x
    return f
  }
  const box = (
    parent: ReturnType<typeof screen>,
    name: string,
    x: number,
    y: number,
    w = 120,
    h = 48
  ) => {
    const b = figma.createFrame()
    parent.appendChild(b)
    b.name = name
    b.x = x
    b.y = y
    b.resize(w, h)
    return b
  }
  const text = (parent: ReturnType<typeof box>, content: string) => {
    const t = figma.createText()
    parent.appendChild(t)
    figma.graph.updateNode(t.id, { text: content, name: content })
    return t
  }
  const login = screen('Login', 0)
  const home = screen('Home', 500)
  const profile = screen('Profile', 1000)
  const signIn = box(login, 'Button', 40, 700, 310, 52)
  const signInLabel = text(signIn, 'تسجيل الدخول')
  const tabBar = box(home, 'Tab bar', 0, 780, 390, 64)
  const profileTab = box(tabBar, 'Tab', 260, 8, 100, 48)
  text(profileTab, 'Profile')
  const back = box(profile, 'Back', 16, 48, 40, 40)
  text(back, '←')
  return { figma, login, home, profile, signIn, signInLabel, tabBar, profileTab, back }
}

/** What get_prototype returns, as far as these tests read it. */
interface PrototypeReport {
  flows: { name: string; start: string }[]
  screens: { id: string; name: string }[]
  interactions: { id: string; name: string }[]
}

const slide = { type: 'slide-in', direction: 'left', duration: 300, easing: 'ease-out' } as const

describe('auto_prototype', () => {
  test('orders screens as read and links forward, nav and back', () => {
    const a = app()
    const plan = planPrototype(a.figma.graph, a.figma.currentPage.id)
    expect(plan.screens).toEqual([a.login.id, a.home.id, a.profile.id])
    const byNode = Object.fromEntries(plan.links.map((l) => [l.node, l]))
    // The Arabic "Sign in" label stands for its whole button.
    expect(byNode[a.signIn.id]).toMatchObject({ kind: 'forward', destination: a.home.id })
    expect(byNode[a.profileTab.id]).toMatchObject({ kind: 'nav', destination: a.profile.id })
    expect(byNode[a.back.id]).toMatchObject({ kind: 'back' })
  })

  test('writes interactions and a flow starting at the first screen', () => {
    const a = app()
    const out = tool('auto_prototype')(a.figma, { transition: slide }) as { linked: number }
    expect(out.linked).toBe(3)
    const signIn = must(a.figma.graph.getNode(a.signIn.id))
    expect(readInteractions(signIn)).toEqual([
      {
        trigger: { type: 'click' },
        action: { type: 'navigate', destination: a.home.id, transition: slide }
      }
    ])
    // Back slides the other way.
    const back = readInteractions(must(a.figma.graph.getNode(a.back.id)))[0]
    expect(back.action).toMatchObject({
      type: 'back',
      transition: { type: 'slide-in', direction: 'right' }
    })
    expect(readFlows(must(a.figma.graph.getNode(a.figma.currentPage.id)))).toEqual([
      { name: 'Flow 1', start: a.login.id }
    ])
  })

  test('keeps clicks the user set unless asked to replace them', () => {
    const a = app()
    const mine: Interaction = {
      trigger: { type: 'click' },
      action: {
        type: 'navigate',
        destination: a.profile.id,
        transition: { ...slide, type: 'dissolve' }
      }
    }
    tool('set_interactions')(a.figma, { id: a.signIn.id, interactions: [mine] })
    const kept = tool('auto_prototype')(a.figma, {}) as { skipped: number }
    expect(kept.skipped).toBe(1)
    expect(readInteractions(must(a.figma.graph.getNode(a.signIn.id)))).toEqual([mine])
    tool('auto_prototype')(a.figma, { replace: true })
    const replaced = readInteractions(must(a.figma.graph.getNode(a.signIn.id)))[0]
    expect(replaced.action).toMatchObject({ destination: a.home.id })
  })

  test('dry run plans without writing', () => {
    const a = app()
    const out = tool('auto_prototype')(a.figma, { dry_run: true }) as { linked: number }
    expect(out.linked).toBe(3)
    expect(readInteractions(must(a.figma.graph.getNode(a.signIn.id)))).toEqual([])
  })

  test('a page with no screens reports it', () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(tool('auto_prototype')(figma, {})).toMatchObject({ error: expect.any(String) })
  })

  test('reading order: rows top to bottom, left to right inside a row', () => {
    const frames = [
      { id: 'c', x: 0, y: 1000, height: 800 },
      { id: 'b', x: 500, y: 10, height: 800 },
      { id: 'a', x: 0, y: 0, height: 800 }
    ]
    // Only the fields readingOrder reads.
    const order = readingOrder(frames as never)
    expect(order.map((f) => (f as { id: string }).id)).toEqual(['a', 'b', 'c'])
  })
})

describe('player engine', () => {
  function linked() {
    const a = app()
    tool('auto_prototype')(a.figma, { transition: slide })
    return a
  }

  test('a click on a label inside the button bubbles up to the button', () => {
    const a = linked()
    const step = must(trigger(a.figma.graph, start(a.login.id), a.signInLabel.id, 'click'))
    expect(step.state).toEqual({ screen: a.home.id, history: [a.login.id], overlays: [] })
    expect(step.transition).toEqual(slide)
  })

  test('clicking where nothing is linked does nothing', () => {
    const a = linked()
    expect(trigger(a.figma.graph, start(a.login.id), a.login.id, 'click')).toBeNull()
    expect(trigger(a.figma.graph, start(a.login.id), a.signIn.id, 'hover')).toBeNull()
  })

  test('back returns along the history, and does nothing at the start', () => {
    const a = linked()
    let state = must(trigger(a.figma.graph, start(a.login.id), a.signIn.id, 'click')).state
    state = must(trigger(a.figma.graph, state, a.profileTab.id, 'click')).state
    expect(state.history).toEqual([a.login.id, a.home.id])
    const back = must(trigger(a.figma.graph, state, a.back.id, 'click'))
    expect(back.state).toEqual({ screen: a.home.id, history: [a.login.id], overlays: [] })
    expect(back.transition?.direction).toBe('right')
    expect(fire(a.figma.graph, start(a.login.id), { type: 'back' })).toBeNull()
  })

  test('overlays stack on the screen, take the clicks, and close', () => {
    const a = linked()
    const settings = a.figma.createFrame()
    settings.name = 'Settings sheet'
    settings.resize(390, 300)
    settings.x = 1500
    const open = must(
      fire(a.figma.graph, start(a.home.id), {
        type: 'overlay',
        destination: settings.id,
        position: 'bottom',
        closeOnOutside: true,
        transition: { ...slide, type: 'move-in', direction: 'up' }
      })
    )
    expect(open.state.screen).toBe(a.home.id)
    expect(activeScreen(open.state)).toBe(settings.id)
    // Clicks on the screen underneath no longer reach its layers.
    expect(trigger(a.figma.graph, open.state, a.profileTab.id, 'click')).toBeNull()
    expect(must(clickOutside(open.state)).state.overlays).toEqual([])
    expect(must(fire(a.figma.graph, open.state, { type: 'close-overlay' })).state.overlays).toEqual(
      []
    )
    expect(must(fire(a.figma.graph, open.state, { type: 'back' })).state.overlays).toEqual([])
  })

  test('after-delay and key interactions', () => {
    const a = linked()
    tool('add_interaction')(a.figma, {
      id: a.home.id,
      trigger: { type: 'after-delay', delay: 3000 },
      action: { type: 'navigate', destination: a.profile.id, transition: { type: 'dissolve' } }
    })
    tool('add_interaction')(a.figma, {
      id: a.profileTab.id,
      trigger: { type: 'key', key: 'P' },
      action: { type: 'navigate', destination: a.profile.id, transition: { type: 'instant' } }
    })
    const home = start(a.home.id)
    const [timer] = timers(a.figma.graph, home)
    expect(timer.delay).toBe(3000)
    expect(must(fire(a.figma.graph, home, timer.action)).state.screen).toBe(a.profile.id)
    expect(must(keyPress(a.figma.graph, home, 'p')).state.screen).toBe(a.profile.id)
    expect(keyPress(a.figma.graph, home, 'x')).toBeNull()
  })

  test('hotspots sit where the layers are on their screen', () => {
    const a = linked()
    const spots = hotspots(a.figma.graph, a.home.id)
    expect(spots).toEqual([
      { node: a.profileTab.id, x: 260, y: 788, width: 100, height: 48, triggers: ['click'] }
    ])
  })

  test('every screen is reachable from the flow start', () => {
    const a = linked()
    expect(reachable(a.figma.graph, a.login.id, a.figma.currentPage.id)).toEqual(
      new Set([a.login.id, a.home.id, a.profile.id])
    )
  })
})

describe('prototype tools', () => {
  test('rejects a destination that does not exist', () => {
    const a = app()
    const out = tool('set_interactions')(a.figma, {
      id: a.signIn.id,
      interactions: [
        {
          trigger: { type: 'click' },
          action: { type: 'navigate', destination: '9:9', transition: { type: 'instant' } }
        }
      ]
    })
    expect(out).toMatchObject({ error: expect.stringContaining('9:9') })
  })

  test('rejects malformed transitions', () => {
    const a = app()
    expect(() =>
      tool('add_interaction')(a.figma, {
        id: a.signIn.id,
        trigger: { type: 'click' },
        action: { type: 'navigate', destination: a.home.id, transition: { type: 'teleport' } }
      })
    ).toThrow()
  })

  test('flows start on screens only, and can be removed', () => {
    const a = app()
    expect(tool('set_flow')(a.figma, { name: 'Main', start: a.signIn.id })).toMatchObject({
      error: expect.any(String)
    })
    expect(tool('set_flow')(a.figma, { name: 'Main', start: a.login.id })).toMatchObject({
      flows: [{ name: 'Main', start: a.login.id }]
    })
    expect(tool('set_flow')(a.figma, { name: 'Main', remove: true })).toMatchObject({ flows: [] })
  })

  test('get_prototype reports flows, screens and interactions', () => {
    const a = app()
    tool('auto_prototype')(a.figma, {})
    const out = tool('get_prototype')(a.figma, {}) as PrototypeReport
    expect(out.flows).toHaveLength(1)
    expect(out.screens).toHaveLength(3)
    expect(out.interactions).toHaveLength(3)
  })

  test('interactions survive clone, so copies stay interactive', () => {
    const a = app()
    tool('auto_prototype')(a.figma, {})
    const copy = a.figma.getNodeById(a.signIn.id)?.clone()
    expect(readInteractions(must(a.figma.graph.getNode(must(copy).id)))).toHaveLength(1)
  })

  test('prototype tools reach AI chat and MCP', () => {
    for (const name of [
      'get_prototype',
      'set_interactions',
      'add_interaction',
      'set_flow',
      'auto_prototype'
    ]) {
      const def = must(ALL_TOOLS.find((t) => t.name === name))
      expect(isToolExposed(def, 'mcp') && isToolExposed(def, 'ai')).toBe(true)
    }
  })
})

test('a layer on another screen takes no events', () => {
  const a = app()
  tool('auto_prototype')(a.figma, {})
  // The Profile tab lives on Home; the player is on Login.
  expect(trigger(a.figma.graph, start(a.login.id), a.profileTab.id, 'click')).toBeNull()
})
