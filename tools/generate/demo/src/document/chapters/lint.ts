import { Frame, Text } from '@lawha/design-jsx'

import { panelTabs } from '../chrome'
import { layoutChapter, type Chapter, type ChapterContext } from './chapter'
import { CHAPTERS } from './names'

/** Lint: a card with issues planted in it, for the Lint tab to find. */
export function createLintChapter(context: ChapterContext): Promise<Chapter> {
  const { vars } = context.theme
  return layoutChapter(context, {
    chapter: CHAPTERS.lint,
    heading: {
      title: 'It checks itself.',
      subtitle:
        'Lint reads the document the way a reviewer would: contrast, touch targets, layer names, spacing, colors that bypass the variables. The same rules run from the CLI, so a CI job can fail on them.'
    },
    subject: Frame({
      flex: 'col',
      w: 360,
      h: 'hug',
      p: 24,
      gap: 16,
      rounded: vars.radius,
      bg: vars.surface,
      stroke: vars.line,
      children: [
        Text({ font: 'Inter', size: 20, weight: 600, color: vars.text, children: 'Welcome back' }),
        Text({
          name: 'Faint label',
          font: 'Inter',
          size: 13,
          // Too faint to read in either mode: under 2:1 against the card, where text needs 4.5:1.
          color: vars.faint,
          children: 'Signed in as ada@example.com'
        }),
        // A default name and a hard-coded color, both of which the rules notice.
        Frame({
          name: 'Frame 3',
          flex: 'row',
          w: 'fill',
          h: 44,
          justify: 'center',
          items: 'center',
          rounded: vars.cornerRadius,
          bg: '#7C3AED',
          children: [
            Text({ font: 'Inter', size: 14, weight: 600, color: '#FFFFFF', children: 'Continue' })
          ]
        })
      ]
    }),
    tip: {
      step: 7,
      title: 'Open the Lint tab',
      body: 'This card has a label too faint to read and a layer still called Frame 3, on purpose. Lint lists them by severity; click one to select the layer and fix it in the panel.',
      where: panelTabs(context.theme, 'Lint')
    }
  })
}
