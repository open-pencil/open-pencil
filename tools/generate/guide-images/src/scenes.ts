/** The documents the guide's pictures show, in design JSX. */

const song = (title: string, artist: string, color: string) => `
  <Frame name="${title}" flex="row" gap={12} items="center" w="fill" h="hug">
    <Frame name="Cover" w={40} h={40} rounded={8} bg="${color}" />
    <Frame name="Info" flex="col" gap={2} grow={1} h="hug">
      <Text name="Title" size={14} weight={600} color="#18181B">${title}</Text>
      <Text name="Artist" size={12} color="#71717A">${artist}</Text>
    </Frame>
  </Frame>`

const tag = (name: string) => `
  <Frame name="${name}" flex="row" px={12} py={6} rounded={14} bg="#E0E7FF">
    <Text size={13} weight={500} color="#3730A3">${name}</Text>
  </Frame>`

const album = (color: string, index: number) =>
  `<Frame name="Album ${index + 1}" w="fill" h="fill" rounded={10} bg="${color}" />`

/** The radius of every scene's outer frame. */
export const SCENE_RADIUS = 16

const SONGS = [
  song('Slow Morning', 'The Harbors', '#FB923C'),
  song('Paper Lanterns', 'Mira Vale', '#8B5CF6'),
  song('Low Tide', 'Northbound', '#0EA5E9')
]
const TAGS = ['Ambient', 'Jazz', 'Electronic', 'Folk', 'Neo soul', 'Classical', 'Lo-fi']
const ALBUMS = ['#FB923C', '#8B5CF6', '#0EA5E9', '#10B981', '#F43F5E', '#FACC15']

/** A playlist card of its first `count` songs. */
export const playlist = (count = SONGS.length) =>
  `<Frame name="Playlist" w={300} h="hug" flex="col" gap={16} p={20} bg="#FFFFFF" rounded={${SCENE_RADIUS}}>${SONGS.slice(0, count).join('')}</Frame>`

export const tags = () =>
  `<Frame name="Tags" w={300} h="hug" flex="row" wrap gap={8} rowGap={8} p={20} bg="#FFFFFF" rounded={${SCENE_RADIUS}}>${TAGS.map(tag).join('')}</Frame>`

export const gallery = () =>
  `<Frame name="Gallery" w={360} h={240} grid columns="1fr 1fr 1fr" rows="1fr 1fr" columnGap={12} rowGap={12} p={16} bg="#FFFFFF" rounded={${SCENE_RADIUS}}>${ALBUMS.map(album).join('')}</Frame>`
