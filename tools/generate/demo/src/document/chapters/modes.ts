import { Frame, Instance, type DesignMode } from '@open-pencil/design-jsx'

import { variablesRow } from '../chrome'
import { layoutChapter, type Chapter, type ChapterContext } from './chapter'
import { CHAPTERS } from './names'
import type { Player } from './slots'

/** Modes: the same player twice, each frame reading the Theme collection in its own mode. */
export async function createModesChapter(
  context: ChapterContext,
  player: Player
): Promise<Chapter> {
  const { graph, theme } = context
  // Both stages pin their mode, so they show dark and light whichever theme the app is in.
  const stage = (name: string, mode: DesignMode) =>
    Frame({
      name,
      mode,
      flex: 'col',
      w: 'hug',
      h: 'hug',
      p: 40,
      rounded: 32,
      bg: theme.vars.raised,
      children: [Instance({ of: player.id })]
    })
  const chapter = await layoutChapter(context, {
    chapter: CHAPTERS.modes,
    heading: {
      title: 'It has modes.',
      subtitle:
        'Every color and radius in the player is a variable from one Theme collection. Each frame reads it in its own mode; nothing else differs. The rest of the tour follows the app’s theme the same way.'
    },
    subject: Frame({
      flex: 'row',
      w: 'hug',
      h: 'hug',
      gap: 40,
      children: [stage('Dark', theme.modes.dark), stage('Light', theme.modes.light)]
    }),
    tip: {
      step: 4,
      title: 'Switch the mode',
      body: 'With nothing selected, open the Theme collection from the panel’s Variables section and change a value in one mode: the player in that mode follows, the other stays.',
      where: variablesRow(theme, `${graph.variables.size} / ${graph.variableCollections.size}`)
    }
  })
  return chapter
}
