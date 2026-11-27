/** @jsxImportSource @open-pencil/design-jsx */
/**
 * A launch talk for the tour's music player, Lumen 2: the tour's Theme collection and player,
 * laid out as a deck. Every slide's background follows the Theme, the player and its controls are
 * the real components, and each slide has a transition, a build where one helps, and notes.
 */
import {
  Frame,
  Instance,
  Text,
  shader,
  type DesignMode,
  type TreeNode
} from '@open-pencil/design-jsx'
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
import { bindVariable, easingPreset } from '@open-pencil/scene-graph/variables'

import { variantOf } from '../document/chapters/controls'
import { HERO_PRESET } from '../document/chapters/hello'
import {
  coveredPlayer,
  iconCover,
  makeArtworkSlot,
  typeCover,
  type Player
} from '../document/chapters/slots'
import { renderTree } from '../document/icons'
import { PLAYER_WIDTH, playerComponent, type PlayerParts } from '../document/player/card'
import { optionToggle, playToggle, progressSlider, skipButton } from '../document/player/controls'
import { createTheme, type Theme } from '../document/theme'
import { DECK_SECTIONS, MOTION_VARIABLES } from './names'

const WIDTH = 1920
const HEIGHT = 1080
const MARGIN = 140

interface Deck {
  graph: SceneGraph
  theme: Theme
  player: Player
  slow: string
  bouncy: string
}

/** Lays `tree` on `parentId` at `x`, `y` and gives the layer. */
async function place(graph: SceneGraph, parentId: string, tree: TreeNode, x = 0, y = 0) {
  const { id } = await renderTree(graph, tree, { parentId, x, y })
  const node = graph.getNode(id)
  if (!node) throw new Error(`"${tree.props.name ?? tree.type}" did not render`)
  return node
}

/** A slide's heading as the tour's chapters have one: a numeral, a title, and a line. */
function heading(
  { vars }: Theme,
  numeral: string,
  title: string,
  line: string,
  width = 820
): TreeNode {
  return (
    <Frame name="Heading" flex="col" w={width} h="hug" gap={24}>
      <Text
        name="Number"
        font="Inter"
        size={120}
        weight={800}
        letterSpacing={-5}
        color={vars.numeral}
      >
        {numeral}
      </Text>
      <Text
        name="Title"
        font="Inter"
        size={80}
        weight={700}
        letterSpacing={-2}
        color={vars.text}
        w="fill"
      >
        {title}
      </Text>
      <Text name="Line" font="Inter" size={32} lineHeight={46} color={vars.muted} w="fill">
        {line}
      </Text>
    </Frame>
  )
}

/** A full-bleed slide on the tour's live hero shader. */
function hero(name: string, children: TreeNode[]): TreeNode {
  return (
    <Frame
      name={name}
      flex="row"
      w={WIDTH}
      h={HEIGHT}
      p={MARGIN}
      gap={80}
      items="center"
      bg={shader(HERO_PRESET)}
    >
      {children}
    </Frame>
  )
}

/** A card telling the audience what to try, as the tour's tips do. */
function tryIt({ vars }: Theme, title: string, body: string): TreeNode {
  return (
    <Frame
      name="Try it"
      flex="col"
      w={820}
      h="hug"
      gap={20}
      p={40}
      rounded={vars.radius}
      bg={vars.raised}
      stroke={vars.line}
    >
      <Frame name="Title" flex="row" w="fill" h="hug" gap={20} items="center">
        <Frame
          name="Step"
          flex="row"
          w={56}
          h={56}
          rounded={28}
          justify="center"
          items="center"
          bg={vars.accent}
        >
          <Text font="Inter" size={28} weight={700} color={vars.onAccent}>
            1
          </Text>
        </Frame>
        <Text font="Inter" size={36} weight={700} color={vars.text}>
          {title}
        </Text>
      </Frame>
      <Text font="Inter" size={28} lineHeight={42} color={vars.muted} w="fill">
        {body}
      </Text>
    </Frame>
  )
}

/** A figure on the numbers slide: the number and what it counts. */
function figure({ vars }: Theme, value: string, label: string): TreeNode {
  return (
    <Frame
      name={label}
      flex="col"
      w="fill"
      h="hug"
      gap={16}
      p={48}
      rounded={vars.radius}
      bg={vars.surface}
      stroke={vars.line}
    >
      <Text font="Inter" size={180} weight={800} letterSpacing={-8} color={vars.accent}>
        {value}
      </Text>
      <Text font="Inter" size={36} lineHeight={48} color={vars.muted} w="fill">
        {label}
      </Text>
    </Frame>
  )
}

/** A stage that reads the Theme in one mode, as the tour's modes chapter has two. */
function stage({ vars }: Theme, player: Player, name: string, mode: DesignMode): TreeNode {
  return (
    <Frame
      name={name}
      mode={mode}
      flex="col"
      w="hug"
      h="hug"
      p={48}
      gap={28}
      rounded={32}
      bg={vars.raised}
    >
      <Text font="Inter" size={28} weight={600} color={vars.muted}>
        {name}
      </Text>
      <Instance of={player.id} />
    </Frame>
  )
}

function settle(graph: SceneGraph, slide: SceneNode, settings: Partial<SlideSettings>) {
  const current = slideSettings(slide)
  if (current) graph.updateNode(slide.id, { slide: { ...current, ...settings } })
}

/**
 * Animates the layers in order: from one click, each after the one before, or, when `perClick`,
 * one per click.
 */
function build(
  graph: SceneGraph,
  ids: string[],
  change: Partial<LayerAnimation>,
  perClick = false
) {
  for (const [order, id] of ids.entries()) {
    const trigger = order > 0 && !perClick ? 'AFTER_PREVIOUS' : 'ON_CLICK'
    graph.updateNode(id, { animation: { ...defaultLayerAnimation(order), trigger, ...change } })
  }
}

function transition(change: Partial<SlideTransition>): SlideTransition {
  return {
    style: 'DISSOLVE',
    duration: 0.5,
    easing: easingPreset('OUT_CUBIC'),
    timing: { type: 'ON_CLICK' },
    ...change
  }
}

/** The deck's slides in the sections `DECK_SECTIONS` lists. */
function createSlides(graph: SceneGraph, pageId: string): SceneNode[] {
  const grid = slideGrid(graph, pageId)
  if (!grid) throw new Error('A new deck has a slide grid')
  const [first] = graph.getChildren(grid.id)
  const slides = [...graph.getChildren(first.id)]
  for (const _ of DECK_SECTIONS[0].slice(1)) slides.push(createSlide(graph, first.id))
  for (const section of DECK_SECTIONS.slice(1)) {
    const row = createSlideRow(graph, grid.id)
    for (const _ of section) slides.push(createSlide(graph, row.id))
  }
  return slides
}

/** The controls and the Player main component, on the appendix slide the talk skips. */
async function createComponents(
  graph: SceneGraph,
  theme: Theme,
  slide: SceneNode
): Promise<Player> {
  const { vars } = theme
  const line = 'Skipped while presenting: the main components the talk places.'
  await place(graph, slide.id, heading(theme, '—', 'Components', line), MARGIN, 80)
  const controls = await place(
    graph,
    slide.id,
    <Frame
      name="Controls"
      flex="col"
      w="hug"
      h="hug"
      gap={24}
      p={24}
      rounded={vars.radius}
      bg={vars.surface}
      stroke={vars.line}
    >
      {progressSlider(theme)}
      {playToggle(theme)}
      {optionToggle(theme)}
      {skipButton(theme)}
    </Frame>,
    1060,
    80
  )
  const [slider, play, option, skip] = graph.getChildren(controls.id)
  const parts: PlayerParts = {
    slider: slider.id,
    play: variantOf(graph, play.id, 'Playing=Off'),
    shuffle: variantOf(graph, option.id, 'Pressed=On, Icon=Shuffle'),
    repeat: variantOf(graph, option.id, 'Pressed=Off, Icon=Repeat'),
    back: variantOf(graph, skip.id, 'Direction=Back, Interaction=Default'),
    forward: variantOf(graph, skip.id, 'Direction=Forward, Interaction=Default')
  }
  const component = await place(graph, slide.id, playerComponent(theme, parts), 1460, 80)
  return makeArtworkSlot(graph, component.id)
}

async function cover(deck: Deck, slide: SceneNode) {
  const { graph, theme, player } = deck
  const { vars } = theme
  await place(
    graph,
    slide.id,
    hero('Cover', [
      <Frame name="Title" flex="col" w="fill" h="hug" gap={32}>
        <Text font="Inter" size={32} weight={600} letterSpacing={3} color={vars.onAccent}>
          LUMEN · FALL LAUNCH
        </Text>
        <Text font="Inter" size={240} weight={800} letterSpacing={-12} color={vars.onAccent}>
          Lumen 2
        </Text>
        <Text font="Inter" size={48} lineHeight={64} color={vars.onAccent} w={900}>
          A music player that lives inside your designs, and plays.
        </Text>
      </Frame>,
      <Instance of={player.id} />
    ])
  )
  settle(graph, slide, {
    notes:
      'Welcome, everyone. Tonight is about Lumen 2.\nEverything you see is the real design file: the player, its controls, and this deck.',
    transition: transition({ duration: 1, durationVariableId: deck.slow })
  })
}

async function agenda(deck: Deck, slide: SceneNode) {
  const { graph, theme } = deck
  const { vars } = theme
  await place(
    graph,
    slide.id,
    heading(theme, '00', 'Tonight', 'Four things, five minutes.'),
    MARGIN,
    80
  )
  const points = [
    'Every song brings its cover',
    'The controls work',
    'Light and dark, one collection',
    'The numbers'
  ]
  const rows: string[] = []
  for (const [index, point] of points.entries()) {
    const row = await place(
      graph,
      slide.id,
      <Frame name={point} flex="row" w={1500} h="hug" gap={48} items="center">
        <Text font="Inter" size={56} weight={800} color={vars.accent} w={120}>
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Text font="Inter" size={56} weight={600} color={vars.text}>
          {point}
        </Text>
      </Frame>,
      MARGIN,
      560 + index * 110
    )
    rows.push(row.id)
  }
  build(graph, rows, { style: 'SLIDE_FROM_LEFT', duration: 0.5 })
  settle(graph, slide, {
    notes: 'One click brings the agenda in, each row right after the one before.',
    transition: transition({
      style: 'SLIDE_FROM_RIGHT',
      duration: 0.8,
      easing: easingPreset('SPRING_PRESET_TWO'),
      easingVariableId: deck.bouncy
    })
  })
}

async function covers(deck: Deck, slide: SceneNode) {
  const { graph, theme, player } = deck
  const line = 'One player component. Its artwork is a slot each instance fills its own way.'
  const title = heading(theme, '01', 'Every song brings its cover.', line, WIDTH - 2 * MARGIN)
  await place(graph, slide.id, title, MARGIN, 60)
  // Three players and their gaps, centered under the heading.
  const row = await place(
    graph,
    slide.id,
    <Frame name="Players" flex="row" w="hug" h="hug" gap={48} items="start" />,
    (WIDTH - 3 * PLAYER_WIDTH - 2 * 48) / 2,
    440
  )
  const tracks = [
    { title: 'Side B', artist: 'The Tapes', cover: iconCover(theme) },
    { title: 'Lo-fi Hours', artist: 'Various', cover: typeCover(theme) }
  ]
  const ids = [(await place(graph, row.id, <Instance of={player.id} />)).id]
  for (const track of tracks) ids.push(await coveredPlayer(graph, row.id, player, track))
  build(graph, ids, { style: 'SLIDE_FROM_BOTTOM' })
  settle(graph, slide, {
    notes:
      'The same component three times. The cover is a slot: a shader, an icon on a gradient, and plain type.',
    transition: transition({ style: 'PUSH_FROM_RIGHT', duration: 0.7 })
  })
}

async function controls(deck: Deck, slide: SceneNode) {
  const { graph, theme, player } = deck
  const line =
    'Press play, drag the progress, toggle shuffle: the real component, running while we present.'
  await place(graph, slide.id, heading(theme, '02', 'The controls work.', line), MARGIN, 80)
  const tip =
    'Click the player on the right. A click on a control works the control and leaves the deck where it is.'
  await place(graph, slide.id, tryIt(theme, 'Try it now', tip), MARGIN, 700)
  await place(
    graph,
    slide.id,
    <Frame
      name="Stage"
      flex="row"
      w={760}
      h={920}
      justify="center"
      items="center"
      rounded={40}
      overflow="hidden"
      bg={shader(HERO_PRESET)}
    >
      <Instance of={player.id} />
    </Frame>,
    1020,
    80
  )
  settle(graph, slide, {
    notes:
      'Invite someone to press play. The deck moves on only with the arrow keys or a click outside the player.',
    transition: transition({ style: 'SLIDE_FROM_RIGHT', duration: 0.6 })
  })
}

async function modes(deck: Deck, slide: SceneNode) {
  const { graph, theme, player } = deck
  const line = 'Every color and radius is a Theme variable; each stage reads it in its own mode.'
  await place(
    graph,
    slide.id,
    heading(theme, '03', 'Light and dark, one collection.', line, 640),
    MARGIN,
    80
  )
  await place(
    graph,
    slide.id,
    <Frame name="Stages" flex="row" w="hug" h="hug" gap={48}>
      {stage(theme, player, 'Dark', theme.modes.dark)}
      {stage(theme, player, 'Light', theme.modes.light)}
    </Frame>,
    880,
    160
  )
  settle(graph, slide, {
    notes:
      'Nothing differs between the two players but the mode their frame picks. The whole deck reads the same Theme.',
    transition: transition({ style: 'MOVE_FROM_RIGHT', duration: 0.6 })
  })
}

async function numbers(deck: Deck, slide: SceneNode) {
  const { graph, theme } = deck
  await place(
    graph,
    slide.id,
    heading(theme, '04', 'The numbers.', 'What it takes to ship a player that plays.'),
    MARGIN,
    80
  )
  const row = await place(
    graph,
    slide.id,
    <Frame name="Figures" flex="row" w={WIDTH - 2 * MARGIN} h="hug" gap={48} />,
    MARGIN,
    600
  )
  const ids: string[] = []
  const figures = [
    ['5', 'controls, each a real Reka UI component'],
    ['1', 'Theme collection, in two modes'],
    ['0', 'mock-ups: every slide is the design itself']
  ]
  for (const [value, label] of figures)
    ids.push((await place(graph, row.id, figure(theme, value, label))).id)
  build(graph, ids, { style: 'FADE', duration: 0.4 }, true)
  settle(graph, slide, {
    notes: 'One click per number. Pause on the zero.',
    transition: transition({ duration: 0.8 })
  })
}

async function close(deck: Deck, slide: SceneNode) {
  const { graph, theme, player } = deck
  const { vars } = theme
  await place(
    graph,
    slide.id,
    hero('Close', [
      <Frame name="Title" flex="col" w="fill" h="hug" gap={32}>
        <Text font="Inter" size={180} weight={800} letterSpacing={-9} color={vars.onAccent}>
          Out today.
        </Text>
        <Text font="Inter" size={48} lineHeight={64} color={vars.onAccent} w={900}>
          Open the tour to see how the player is built, then make this deck your own.
        </Text>
      </Frame>,
      <Instance of={player.id} />
    ])
  )
  settle(graph, slide, { notes: 'Thank you. Questions?' })
}

/** Fills a new deck with the talk: its sections, slides, transitions, builds, and notes. */
export async function createDeck(graph: SceneGraph, pageId: string): Promise<void> {
  const theme = createTheme()
  const slides = createSlides(graph, pageId)
  const [coverSlide, agendaSlide, coversSlide, controlsSlide, modesSlide, numbersSlide] = slides
  const [closeSlide, appendix] = slides.slice(6)
  const player = await createComponents(graph, theme, appendix)
  const collection = graph.createCollection('Motion')
  const slow = graph.createVariable(MOTION_VARIABLES.slow, 'TIMING', collection.id, 1)
  const bouncy = graph.createVariable(
    MOTION_VARIABLES.bouncy,
    'EASING',
    collection.id,
    easingPreset('SPRING_PRESET_TWO')
  )
  const deck: Deck = { graph, theme, player, slow: slow.id, bouncy: bouncy.id }

  await cover(deck, coverSlide)
  await agenda(deck, agendaSlide)
  await covers(deck, coversSlide)
  await controls(deck, controlsSlide)
  await modes(deck, modesSlide)
  await numbers(deck, numbersSlide)
  await close(deck, closeSlide)
  settle(graph, appendix, { skipped: true, notes: 'Main components live here, out of the talk.' })

  // Each slide's background is the Theme's Page color, so the deck follows its modes.
  const page = graph.getLiveVariables().find((variable) => variable.name === 'Page')
  if (!page) throw new Error('The Theme has no Page color')
  for (const slide of slides) bindVariable(graph, slide.id, 'fills/0/color', page.id)
  renumberSlides(graph, pageId)
}
