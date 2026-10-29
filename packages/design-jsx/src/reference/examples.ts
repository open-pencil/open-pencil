import dedent from 'dedent'

export interface AuthoringExample {
  title: string
  jsx: string
}

/** Shared verbatim by runtime prompts and the installable skill; exercised in engine tests. */
export const AUTHORING_EXAMPLES: readonly AuthoringExample[] = [
  {
    title: 'Content-sized review note',
    jsx: dedent`<Frame name="Review note" w={280} h="hug" flex="col" gap={8} p={16} bg="#FFFFFF">
  <Text name="Author" size={12} weight="medium" color="#252A31">June Lee</Text>
  <Text name="Message" w="fill" size={12} color="#6B7079">Give the date a little more room at the bottom.</Text>
</Frame>`
  },
  {
    title: 'Variable-bound spacing and typography',
    jsx: dedent`<Frame name="Bound note" w={280} h="hug" flex="col" gap={designVar('Space/small')} p={designVar('Space/medium')} bg="#FFFFFF">
  <Text name="Message" w="fill" size={designVar('Type/body')} lineHeight={designVar('Type/body-leading')} letterSpacing={designVar('Type/body-tracking')} color="#252A31">A note that grows with its content.</Text>
</Frame>`
  },
  {
    title: 'A theme with two modes',
    jsx: dedent`const theme = defineVars('Theme', { Surface: '#FFFFFF', Ink: '#252A31', Radius: 12 }, { mode: 'Light' })
const dark = defineMode(theme, 'Dark', { Surface: '#1A1A20', Ink: '#F5F5F7' })
return <Frame name="Dark note" mode={dark} w={280} h="hug" flex="col" gap={8} p={16} bg={theme.Surface} rounded={theme.Radius}>
  <Text name="Message" w="fill" size={12} color={theme.Ink}>Shown in the Dark mode of the Theme collection.</Text>
</Frame>`
  },
  {
    title: 'Component with text and visibility properties',
    jsx: dedent`<Component name="Comment" w={280} h="hug" flex="col" gap={8} p={16} bg="#FFFFFF">
  <Text name="Author" size={12} weight="medium" color="#252A31" text={property('Author', 'June Lee')} />
  <Text name="Message" w="fill" size={12} color="#6B7079" text={property('Message', 'Give the date more room.')} visible={property('Show message', true)} />
</Component>`
  },
  {
    title: 'Rich text with spans and lists',
    jsx: dedent`<Frame name="Release notes" w={280} h="hug" flex="col" gap={8} p={16} bg="#FFFFFF">
  <Text name="Notes" w="fill" size={12} color="#252A31" paragraphSpacing={4}>
    <Paragraph spacing={8}>Version 2 is <Span weight="bold" color="#3B6CF6" textDecoration="underline" textDecorationStyle="wavy" textUnderlineOffset={2}>out now</Span>.</Paragraph>
    <Paragraph list="unordered">Faster export</Paragraph>
    <Paragraph list="unordered" level={2}>PDF and SVG</Paragraph>
    <Paragraph list="ordered">Fewer clicks</Paragraph>
  </Text>
</Frame>`
  }
]
