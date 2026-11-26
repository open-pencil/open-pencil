import { CHAPTERS } from '#demo/document/chapters/names'
import { COLLECTION_NAMES } from '#demo/document/theme'

/** The frame the docs landing's recorded AI turn renders into: the hero, which lays out its row. */
export const RECORDED_TURN_PARENT = CHAPTERS.hello.subject

/** The name of the card the turn adds, which a replay looks up to remove first. */
export const RECORDED_TURN_RESULT = 'Up next'

const UP_NEXT = [
  { title: 'Side B', artist: 'The Tapes', length: '3:12' },
  { title: 'Lo-fi Hours', artist: 'Various', length: '4:05' },
  { title: 'Night Shift', artist: 'Lumen', length: '2:48' }
]

/**
 * Names a variable of the tour's Theme collection. The App chrome collection has variables of the
 * same names, so a bare name is ambiguous.
 */
const themeVar = (name: string) => `designVar('${COLLECTION_NAMES.theme}', '${name}')`

/**
 * The design JSX the turn's `render` call carries. Its colors and radius are the tour's Theme
 * variables, as the player's are, so it switches between dark and light with the player and the
 * docs site. The hero spaces its row by nothing, so the card keeps its distance from the player
 * with padding of its own. `tests/build.test.ts` renders it into the built tour.
 */
export const RECORDED_TURN_JSX = [
  `<Frame name="${RECORDED_TURN_RESULT}" w="hug" h="hug" pl={24}>`,
  `  <Frame name="Queue" w={280} h="hug" flex="col" gap={14} p={20} bg={${themeVar('Surface')}} rounded={${themeVar('Radius')}}>`,
  `    <Text name="Heading" size={14} weight={600} color={${themeVar('Text')}}>${RECORDED_TURN_RESULT}</Text>`,
  ...UP_NEXT.flatMap(({ title, artist, length }) => [
    '    <Frame name="Track" w="fill" h="hug" flex="row" gap={12} items="center">',
    `      <Frame name="Cover" w={40} h={40} rounded={${themeVar('Radius/Control')}} bg={${themeVar('Surface/Raised')}} />`,
    '      <Frame name="Names" grow={1} h="hug" flex="col" gap={2}>',
    `        <Text name="Title" size={13} weight={500} color={${themeVar('Text')}}>${title}</Text>`,
    `        <Text name="Artist" size={12} color={${themeVar('Text/Muted')}}>${artist}</Text>`,
    '      </Frame>',
    `      <Text name="Length" size={12} color={${themeVar('Text/Muted')}}>${length}</Text>`,
    '    </Frame>'
  ]),
  '  </Frame>',
  '</Frame>'
].join('\n')
