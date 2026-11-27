/** @jsxImportSource @open-pencil/design-jsx */
import { Component, Frame, Instance, Switch, Text, type TreeNode } from '@open-pencil/design-jsx'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createSlide,
  createSlideRow,
  defaultLayerAnimation,
  renumberSlides,
  slideGrid,
  slideSettings,
  type LayerAnimation,
  type SlideSettings,
  type SlideTransition
} from '@open-pencil/scene-graph/slides'
import { easingPreset } from '@open-pencil/scene-graph/variables'

import { Icon } from '../document/elements'
import { renderTree } from '../document/icons'
import { MOTION_VARIABLES } from './names'

const INK = '#15171F'
const MUTED = '#5B6070'
const PAPER = '#FFFFFF'
const ON_NIGHT = '#FFFFFF'
const ON_NIGHT_MUTED = '#A9B0C2'
const ACCENT = '#3B6CF6'
const NIGHT_PANEL = '#232838'
const MARGIN = 160

/** A slide's heading and the line under it, at the slide's top. */
function heading(title: string, line: string, dark = false): TreeNode {
  return (
    <Frame name="Heading" flex="col" w={1600} h="hug" gap={24}>
      <Text name="Title" size={88} weight={700} color={dark ? ON_NIGHT : INK} w="fill">
        {title}
      </Text>
      <Text name="Line" size={40} color={dark ? ON_NIGHT_MUTED : MUTED} w="fill">
        {line}
      </Text>
    </Frame>
  )
}

/** A card of the build slide: an icon, a name, and what it stands for. */
function card(name: string, icon: `lucide:${string}`, line: string, color: string): TreeNode {
  return (
    <Frame name={name} flex="col" w={480} h={420} gap={28} p={48} rounded={32} bg={color}>
      <Icon name={icon} size={72} color={PAPER} />
      <Text name="Name" size={56} weight={700} color={PAPER}>
        {name}
      </Text>
      <Text name="Line" size={32} color={PAPER} w="fill">
        {line}
      </Text>
    </Frame>
  )
}

/** One of the two windows a presentation with notes opens. */
function screen(name: string, icon: `lucide:${string}`, line: string, color: string): TreeNode {
  return (
    <Frame name={name} flex="col" w="fill" h={380} gap={24} p={48} rounded={32} bg={color}>
      <Icon name={icon} size={64} color={PAPER} />
      <Text name="Name" size={48} weight={700} color={PAPER}>
        {name}
      </Text>
      <Text name="Line" size={32} color={PAPER} w="fill">
        {line}
      </Text>
    </Frame>
  )
}

/** A switch whose variants Reka UI's Switch runs while the deck is presented. */
const SWITCH = (
  <Switch.Root
    name="Switch"
    modelValue="State"
    states="Interaction"
    transition={{ duration: 0.2, easing: 'ease-out' }}
    flex="row"
    gap={32}
    p={32}
  >
    <Component name="State=Off, Interaction=Default" w={176} h={96} rounded={48} bg="#D0D4DA">
      <Switch.Thumb x={8} y={8} w={80} h={80} rounded={40} bg={PAPER} />
    </Component>
    <Component name="State=On, Interaction=Default" w={176} h={96} rounded={48} bg={ACCENT}>
      <Switch.Thumb x={88} y={8} w={80} h={80} rounded={40} bg={PAPER} />
    </Component>
  </Switch.Root>
)

/** Lays `tree` on the slide at `x`, `y` and gives the layer's ID. */
async function place(graph: SceneGraph, slide: SceneNode, tree: TreeNode, x = MARGIN, y = 120) {
  return (await renderTree(graph, tree, { parentId: slide.id, x, y })).id
}

function settle(graph: SceneGraph, slide: SceneNode, settings: Partial<SlideSettings>) {
  const current = slideSettings(slide)
  if (current) graph.updateNode(slide.id, { slide: { ...current, ...settings } })
}

function darken(graph: SceneGraph, slide: SceneNode) {
  graph.updateNode(slide.id, {
    fills: [
      { type: 'SOLID', color: { r: 0.067, g: 0.075, b: 0.102, a: 1 }, opacity: 1, visible: true }
    ]
  })
}

function animate(graph: SceneGraph, id: string, order: number, change: Partial<LayerAnimation>) {
  graph.updateNode(id, { animation: { ...defaultLayerAnimation(order), ...change } })
}

function transition(change: Partial<SlideTransition>): SlideTransition {
  return {
    style: 'DISSOLVE',
    duration: 0.4,
    easing: easingPreset('OUT_CUBIC'),
    timing: { type: 'ON_CLICK' },
    ...change
  }
}

/**
 * The deck's slides in its sections: a title, four slides that each show one part of presenting,
 * a close, and a skipped backup slide holding the main component the third slide places.
 */
function createSlides(graph: SceneGraph, pageId: string): SceneNode[] {
  const grid = slideGrid(graph, pageId)
  if (!grid) throw new Error('A new deck has a slide grid')
  const [first] = graph.getChildren(grid.id)
  const [title] = graph.getChildren(first.id)
  const slides = [title]
  for (const count of [4, 1, 1]) {
    const row = createSlideRow(graph, grid.id)
    for (let index = 0; index < count; index++) slides.push(createSlide(graph, row.id))
  }
  return slides
}

/** Fills the deck: each slide's layers, its transition and build, and its speaker notes. */
export async function createDeck(graph: SceneGraph, pageId: string): Promise<void> {
  const [title, build, controls, motion, notes, end, backup] = createSlides(graph, pageId)
  const collection = graph.createCollection('Motion')
  const slow = graph.createVariable(MOTION_VARIABLES.slow, 'TIMING', collection.id, 1.2)
  const bouncy = graph.createVariable(
    MOTION_VARIABLES.bouncy,
    'EASING',
    collection.id,
    easingPreset('SPRING_PRESET_TWO')
  )

  darken(graph, title)
  await place(
    graph,
    title,
    heading(
      'Presenting in OpenPencil',
      'Press → or click to move on, ← to go back, Esc to end.',
      true
    ),
    MARGIN,
    380
  )
  settle(graph, title, {
    notes:
      'Welcome. This deck shows transitions, build steps, live controls, and motion bound to variables.',
    transition: transition({ style: 'PUSH_FROM_RIGHT', duration: 0.6 })
  })

  await place(graph, build, heading('Build it step by step', 'Each click brings one card on.'))
  const steps = [
    card('Plan', 'lucide:map', 'Outline the talk in slides and sections.', '#F2553D'),
    card('Design', 'lucide:pen-tool', 'Lay out each slide like any frame.', ACCENT),
    card('Present', 'lucide:presentation', 'Play it full screen, with notes.', '#22A060')
  ]
  const styles: LayerAnimation['style'][] = ['SLIDE_FROM_LEFT', 'SLIDE_FROM_BOTTOM', 'FADE']
  for (const [index, tree] of steps.entries()) {
    const id = await place(graph, build, tree, MARGIN + index * 560, 480)
    animate(graph, id, index, { style: styles[index] })
  }
  settle(graph, build, {
    notes: 'Each click plays the next step. Going back takes a step back at once.',
    transition: transition({
      style: 'SLIDE_FROM_RIGHT',
      duration: 0.8,
      easing: easingPreset('GENTLE_SPRING')
    })
  })

  // The main component lives on the skipped backup slide; this slide places an instance of it.
  const set = await place(graph, backup, SWITCH)
  const off = graph.getChildren(set).find((variant) => variant.name.startsWith('State=Off'))
  if (!off) throw new Error('The switch has no Off variant')
  await place(
    graph,
    controls,
    heading('Controls stay live', 'Click the switch: it toggles, and the deck stays where it is.')
  )
  await place(graph, controls, <Instance of={off.id} />, MARGIN, 480)
  settle(graph, controls, {
    notes: 'Try the switch while presenting. Clicks and keys on a control work the control.',
    transition: transition({ duration: 0.5 })
  })

  await place(
    graph,
    motion,
    heading(
      'Motion from variables',
      `This slide leaves timed by ${MOTION_VARIABLES.slow} and eased by ${MOTION_VARIABLES.bouncy}.`
    )
  )
  const banner = await place(
    graph,
    motion,
    <Frame
      name="Banner"
      flex="row"
      w={1600}
      h={360}
      p={64}
      items="center"
      rounded={40}
      bg="#F7D046"
    >
      <Text name="Hint" size={48} weight={600} color={INK} w="fill">
        Open Variables and change Motion/Slow, then present again.
      </Text>
    </Frame>,
    MARGIN,
    520
  )
  animate(graph, banner, 0, {
    style: 'SLIDE_FROM_BOTTOM',
    easing: easingPreset('SPRING_PRESET_TWO'),
    easingVariableId: bouncy.id
  })
  settle(graph, motion, {
    notes: 'The Animate tab shows which variables the transition follows.',
    transition: transition({
      style: 'MOVE_OUT_TO_TOP',
      duration: 1.2,
      durationVariableId: slow.id,
      easing: easingPreset('SPRING_PRESET_TWO'),
      easingVariableId: bouncy.id
    })
  })

  await place(
    graph,
    notes,
    heading(
      'Speaker notes',
      'Present with speaker notes opens a second window with this slide, the next one, and these notes.'
    )
  )
  await place(
    graph,
    notes,
    <Frame name="Windows" flex="row" w={1600} h="hug" gap={64}>
      {screen('Audience', 'lucide:monitor', 'The slide, full screen.', NIGHT_PANEL)}
      {screen(
        'You',
        'lucide:notebook-pen',
        'This slide, the next one, the notes, and a timer.',
        ACCENT
      )}
    </Frame>,
    MARGIN,
    520
  )
  settle(graph, notes, {
    notes: 'You are reading the notes. The audience sees only the slide.',
    transition: transition({ style: 'SLIDE_FROM_BOTTOM', duration: 0.6 })
  })

  darken(graph, end)
  await place(
    graph,
    end,
    heading('Make it yours', 'Save a copy, change a slide, and press Present.', true),
    MARGIN,
    380
  )
  settle(graph, end, { notes: 'Thanks for watching.' })

  await place(
    graph,
    backup,
    heading('Backup', 'Skipped while presenting: it holds the switch the third slide places.'),
    MARGIN,
    600
  )
  settle(graph, backup, {
    skipped: true,
    notes: 'Main components can live on a skipped slide, out of the talk.'
  })
  renumberSlides(graph, pageId)
}
