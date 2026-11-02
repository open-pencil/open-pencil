/** @jsxImportSource @lawha/design-jsx */
/**
 * Pieces of Lawha's own chrome, drawn at the app's sizes in its colors, so a tip can show
 * where to click rather than describe it. A ring in the tour's accent marks the target. Colors
 * come from the App chrome collection, which follows the app's dark or light theme; sizes were
 * measured from 2× screenshots of the header, menu bar, and panel.
 */
import {
  Frame,
  Text,
  type BaseProps,
  type DesignVariable,
  type TreeNode
} from '@lawha/design-jsx'

import { Icon, type IconProps } from './elements'
import type { Theme } from './theme'

const FONT = 'Inter'

function label(children: string, color: DesignVariable, weight = 500): TreeNode {
  return (
    <Text font={FONT} size={13} weight={weight} color={color}>
      {children}
    </Text>
  )
}

function icon(name: IconProps['name'], color: DesignVariable, size = 16): TreeNode {
  return <Icon name={name} size={size} color={color} />
}

function spacer(): TreeNode {
  return <Frame name="Spacer" w="fill" h={1} />
}

/** The ring that marks what to click, drawn around `children`. */
function target(theme: Theme, children: TreeNode[], props: BaseProps = {}): TreeNode {
  return (
    <Frame
      name="Target"
      flex="row"
      w="hug"
      h="hug"
      items="center"
      p={3}
      rounded={10}
      stroke={theme.vars.accent}
      strokeWidth={2}
      {...props}
    >
      {children}
    </Frame>
  )
}

/**
 * A fragment's own panel, the color of the chrome it is cut from, edged so it stands apart from
 * the card it sits on in either theme.
 */
function panel(
  theme: Theme,
  name: string,
  bg: DesignVariable,
  children: TreeNode[],
  props: BaseProps = {}
): TreeNode {
  return (
    <Frame
      name={name}
      flex="row"
      w="hug"
      h="hug"
      items="center"
      gap={8}
      p={10}
      rounded={10}
      bg={bg}
      stroke={theme.chrome.border}
      {...props}
    >
      {children}
    </Frame>
  )
}

/** The top right of the window: Share, and the preview button next to it. */
export function previewButton(theme: Theme): TreeNode {
  const c = theme.chrome
  return panel(theme, 'Header', c.header, [
    <Frame name="Share" flex="row" h={30} px={12} gap={6} items="center" rounded={6} bg={c.blue}>
      {icon('lucide:share-2', c.onBlue, 14)}
      {label('Share', c.onBlue, 600)}
    </Frame>,
    target(theme, [
      <Frame name="Preview" flex="row" w={30} h={30} justify="center" items="center" rounded={6}>
        {icon('lucide:play', c.text)}
      </Frame>
    ])
  ])
}

/** The pill that replaces the header while previewing. */
export function previewPill(theme: Theme): TreeNode {
  const c = theme.chrome
  return panel(theme, 'Preview pill', c.panel, [
    label('Demo', c.text, 600),
    target(theme, [
      <Frame
        name="Previewing"
        flex="row"
        h={28}
        px={10}
        gap={6}
        items="center"
        rounded={6}
        bg={c.previewChip}
      >
        {icon('lucide:play', c.previewText, 14)}
        {label('Previewing', c.previewText, 600)}
      </Frame>
    ]),
    <Frame name="Reset" flex="row" h={28} px={10} gap={6} items="center" rounded={6} bg={c.field}>
      {icon('lucide:rotate-ccw', c.text, 14)}
      {label('Reset', c.text, 600)}
    </Frame>,
    icon('lucide:x', c.muted)
  ])
}

const TABS = [
  ['Design', null],
  ['Code', 'lucide:code'],
  ['AI', 'lucide:sparkles'],
  ['Lint', 'lucide:list-checks']
] as const

/** The panel's tab strip, with `active` lit. */
export function panelTabs(theme: Theme, active: (typeof TABS)[number][0]): TreeNode {
  const c = theme.chrome
  const tab = (name: string, iconName: IconProps['name'] | null) => {
    const lit = name === active
    const color = lit ? c.text : c.muted
    const content = (
      <Frame name={name} flex="col" h="hug" gap={6} items="center">
        <Frame name="Label" flex="row" gap={6} items="center">
          {iconName ? icon(iconName, color, 14) : null}
          {label(name, color, 600)}
        </Frame>
        <Frame name="Underline" w="fill" h={2} rounded={1} bg={lit ? c.blue : c.panel} />
      </Frame>
    )
    return lit ? target(theme, [content], { p: 4 }) : content
  }
  return panel(
    theme,
    'Tabs',
    c.panel,
    TABS.map(([name, iconName]) => tab(name, iconName)),
    { gap: 14, px: 12 }
  )
}

/** The slot row of an instance's component properties. */
export function slotRow(theme: Theme): TreeNode {
  const c = theme.chrome
  return panel(
    theme,
    'Slot row',
    c.panel,
    [
      <Frame name="Rows" flex="col" w="hug" h="hug" gap={8}>
        {label('Component properties', c.component, 600)}
        <Frame name="Artwork" flex="col" w="fill" h="hug" gap={6}>
          {label('Artwork', c.muted)}
          {target(
            theme,
            [
              <Frame
                name="State"
                flex="row"
                w={214}
                h={32}
                px={10}
                gap={10}
                items="center"
                rounded={6}
                bg={c.field}
              >
                <Frame
                  name="Slot"
                  w={14}
                  h={14}
                  rounded={3}
                  stroke={c.slot}
                  strokeWidth={1.5}
                  strokeDash={[2, 2]}
                />
                {label('Modified', c.text)}
                {spacer()}
                {label('1 item', c.muted)}
              </Frame>,
              icon('lucide:plus', c.text),
              icon('lucide:ellipsis', c.text)
            ],
            { gap: 8, px: 6 }
          )}
        </Frame>
      </Frame>
    ],
    { p: 12 }
  )
}

/** A fill row of the Fill section, naming the paint it shows. */
export function fillRow(theme: Theme, paint: string): TreeNode {
  const c = theme.chrome
  return panel(
    theme,
    'Fill row',
    c.panel,
    [
      <Frame name="Rows" flex="col" w="hug" h="hug" gap={8}>
        <Frame name="Heading" flex="row" w="fill" items="center">
          {label('Fill', c.text, 700)}
          {spacer()}
          {icon('lucide:plus', c.text)}
        </Frame>
        <Frame name="Row" flex="row" gap={10} items="center">
          {target(theme, [
            <Frame
              name="Paint"
              flex="row"
              h={32}
              px={8}
              gap={8}
              items="center"
              rounded={6}
              bg={c.field}
            >
              <Frame name="Swatch" w={16} h={16} rounded={3} bg={c.checker} />
              {label(paint, c.text)}
              <Frame name="Divider" w={1} h={16} bg={c.border} />
              {label('100 %', c.text)}
            </Frame>
          ])}
          {icon('lucide:eye', c.text)}
          {icon('lucide:minus', c.text)}
        </Frame>
      </Frame>
    ],
    { p: 12 }
  )
}

/**
 * The Variables section of the page panel, whose button opens the collections; `count` is what
 * the section shows, variables over collections.
 */
export function variablesRow(theme: Theme, count: string): TreeNode {
  const c = theme.chrome
  return panel(
    theme,
    'Variables row',
    c.panel,
    [
      <Frame name="Rows" flex="col" w={240} h="hug" gap={10}>
        <Frame name="Heading" flex="row" w="fill" items="center">
          {label('Variables', c.text, 700)}
          {spacer()}
          {target(theme, [icon('lucide:square-arrow-out-up-right', c.text)])}
        </Frame>
        {label(count, c.muted)}
      </Frame>
    ],
    { p: 12 }
  )
}

const MENUS = ['File', 'Edit', 'View', 'Object', 'Text'] as const

/** The menu bar, with `active` marked. */
export function menuBar(theme: Theme, active: (typeof MENUS)[number]): TreeNode {
  const c = theme.chrome
  return panel(
    theme,
    'Menu bar',
    c.panel,
    MENUS.map((name) =>
      name === active
        ? target(theme, [label(name, c.text)], { px: 6, py: 2 })
        : label(name, c.muted)
    ),
    { gap: 16, px: 14 }
  )
}
