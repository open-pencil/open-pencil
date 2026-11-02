import { Frame, Text } from '@lawha/design-jsx'
import type { TreeNode } from '@lawha/design-jsx'

import { menuBar } from '../chrome'
import { Icon, type IconProps } from '../elements'
import type { Theme } from '../theme'
import {
  CHAPTER_PADDING,
  fitSection,
  layoutChapter,
  type Chapter,
  type ChapterContext
} from './chapter'
import { CHAPTERS } from './names'

const TIP_COMPONENT_GAP = 96

const WAYS: { icon: IconProps['name']; title: string; body: string }[] = [
  {
    icon: 'lucide:users',
    title: 'Share it',
    body: 'Press Share at the top right. The link opens this document in another browser with live cursors, selection, and a voice call. No account and no server in between.'
  },
  {
    icon: 'lucide:folder-open',
    title: 'Open your own',
    body: 'Drop a .fig onto the canvas, paste layers copied in Figma, or paste HTML and CSS. All of it becomes editable layers.'
  },
  {
    icon: 'lucide:sparkles',
    title: 'Ask the AI',
    body: 'The AI tab builds and edits with the same tools this tour used. Bring a key from any provider; it stays on your machine.'
  },
  {
    icon: 'lucide:terminal',
    title: 'Script it',
    body: 'npx @lawha/cli inspects, lints, exports, and edits documents from a terminal, a CI job, or an agent. The MCP server gives agents the same tools.'
  }
]

function way({ vars }: Theme, { icon, title, body }: (typeof WAYS)[number]): TreeNode {
  return Frame({
    name: title,
    flex: 'row',
    w: 'fill',
    h: 'hug',
    gap: 20,
    items: 'start',
    children: [
      Frame({
        name: 'Icon',
        flex: 'row',
        w: 44,
        h: 44,
        rounded: vars.cornerRadius,
        justify: 'center',
        items: 'center',
        bg: vars.raised,
        children: [Icon({ name: icon, size: 22, color: vars.accent })]
      }),
      Frame({
        name: 'Text',
        flex: 'col',
        w: 'fill',
        h: 'hug',
        gap: 6,
        children: [
          Text({ font: 'Inter', size: 17, weight: 600, color: vars.text, children: title }),
          Text({
            font: 'Inter',
            size: 14,
            lineHeight: 22,
            w: 'fill',
            color: vars.muted,
            children: body
          })
        ]
      })
    ]
  })
}

/** Yours: what to do once the tour is over, and the Tip component itself. */
export async function createYoursChapter(context: ChapterContext): Promise<Chapter> {
  const { graph, theme } = context
  const chapter = await layoutChapter(context, {
    chapter: CHAPTERS.yours,
    heading: {
      title: 'Now make it yours.',
      subtitle:
        'The tour ends here. The document does not: everything in it is yours to edit, and it works with what you already have.'
    },
    subject: Frame({
      flex: 'col',
      w: 640,
      h: 'hug',
      gap: 32,
      p: 32,
      rounded: theme.vars.radius,
      bg: theme.vars.surface,
      stroke: theme.vars.line,
      children: WAYS.map((entry) => way(theme, entry))
    }),
    tip: {
      step: 8,
      title: 'Keep it',
      body: 'File → Save writes a .fig you can open here again, or in Figma. The card you are reading is a component as well: its main component sits under the list.',
      keys: '⌘ S',
      where: menuBar(theme, 'File')
    }
  })
  // The Tip component every chapter's card comes from closes the tour, under the list.
  const { section, subject } = chapter
  graph.reparentNode(context.tipId, section.id)
  graph.updateNode(context.tipId, {
    x: CHAPTER_PADDING,
    y: subject.y + subject.height + TIP_COMPONENT_GAP
  })
  fitSection(context, section.id)
  return chapter
}
