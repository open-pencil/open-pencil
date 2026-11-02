import { Instance } from '@lawha/design-jsx'

import { panelTabs } from '../chrome'
import { layoutChapter, type Chapter, type ChapterContext } from './chapter'
import { CHAPTERS } from './names'
import type { Player } from './slots'

/** Code: the player once more, for the Code tab to read. */
export function createCodeChapter(context: ChapterContext, player: Player): Promise<Chapter> {
  return layoutChapter(context, {
    chapter: CHAPTERS.code,
    heading: {
      title: 'It is code, too.',
      subtitle:
        'Anything on the canvas reads as HTML, Vue, or React, with CSS or Tailwind. Components with behaviours come out as Reka UI components, variables as tokens.'
    },
    subject: Instance({ of: player.id }),
    tip: {
      step: 6,
      title: 'Open the Code tab',
      body: 'Select the player and switch the panel from Design to Code. Choose a framework and a styling, then copy, or export the selection as a file from the Export section.',
      where: panelTabs(context.theme, 'Code')
    }
  })
}
