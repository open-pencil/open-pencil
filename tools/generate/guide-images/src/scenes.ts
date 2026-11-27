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

const button = (variant: string, bg: string, color: string) => `
  <Component name="Variant=${variant}" flex="row" px={28} py={10} rounded={8} bg="${bg}" items="center">
    <Text name="Label" size={14} weight={600} color="${color}" text={property('Label', 'Save')} />
  </Component>`

/** A Button component set with two variants and a Label property, and an instance of it. */
export const buttons = () =>
  `<Frame name="Board" w="hug" h="hug" flex="row" gap={56} p={32} items="start" bg="#FFFFFF" rounded={${SCENE_RADIUS}}>
  <ComponentSet name="Button" flex="col" gap={20} p={20}>${button('Primary', '#2563EB', '#FFFFFF')}${button('Secondary', '#E4E4E7', '#18181B')}</ComponentSet>
  <Instance name="Button" of="Button" Variant="Primary" Label="Publish" />
</Frame>`

/** A Theme collection with Light and Dark modes, and a card that uses it. */
export const themedCard = () => `
const theme = defineVars('Theme', { Surface: '#FFFFFF', Text: '#18181B', Accent: '#2563EB', Radius: 12 }, { mode: 'Light' })
defineMode(theme, 'Dark', { Surface: '#18181B', Text: '#FAFAFA', Accent: '#60A5FA' })
return <Frame name="Card" w={240} h="hug" flex="col" gap={12} p={20} bg={theme.Surface} rounded={theme.Radius}>
  <Text name="Title" size={16} weight={600} fill={theme.Text}>Weekly report</Text>
  <Frame name="Action" flex="row" px={14} py={8} rounded={8} bg={theme.Accent}><Text size={13} weight={600} color="#FFFFFF">Open</Text></Frame>
</Frame>`

/** A switch component set that behaves as Reka UI's Switch, with a transition. */
export const toggle =
  () => `<Switch.Root name="Switch" modelValue="State" states="Interaction" transition={{ duration: 0.2, easing: "ease-out" }} flex="row" gap={16} p={16}>
  <Component name="State=Off, Interaction=Default" w={44} h={24} rounded={12} bg="#D0D4DA"><Switch.Thumb x={2} y={2} w={20} h={20} rounded={10} bg="#FFFFFF" /></Component>
  <Component name="State=On, Interaction=Default" w={44} h={24} rounded={12} bg="#3B6CF6"><Switch.Thumb x={22} y={2} w={20} h={20} rounded={10} bg="#FFFFFF" /></Component>
</Switch.Root>`
