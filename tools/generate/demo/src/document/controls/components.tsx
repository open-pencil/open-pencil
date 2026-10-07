/** @jsxImportSource @open-pencil/design-jsx */
/**
 * The demo's controls, written with Reka UI's element names: each is a main component (or set)
 * with a behaviour, ready to place and to run in preview.
 */
import {
  Button,
  Checkbox,
  Component,
  Slider,
  Switch,
  Tabs,
  Text,
  TextField,
  type BaseProps,
  type TreeNode
} from '@open-pencil/design-jsx'

export const CONTROL_COLORS = {
  ink: '#172554',
  muted: '#536487',
  accent: '#4F46E5',
  accentHover: '#4338CA',
  accentPressed: '#3730A3',
  line: '#CBD5E1',
  tile: '#EEF2FF',
  surface: '#FFFFFF',
  disabled: '#E2E8F0'
}

const { ink, muted, accent, accentHover, accentPressed, line, tile, surface, disabled } =
  CONTROL_COLORS

function buttonVariant(state: string, look: BaseProps, color = surface): TreeNode {
  return (
    <Component name={`Interaction=${state}`} flex="row" px={16} py={8} rounded={8} {...look}>
      <Text font="Inter" size={13} weight={600} color={color}>
        Save
      </Text>
    </Component>
  )
}

/** A button whose variants draw its interaction states. */
export const BUTTON = (
  <Button.Root name="Button" states="Interaction" flex="row" gap={12} p={16}>
    {buttonVariant('Default', { bg: accent })}
    {buttonVariant('Hover', { bg: accentHover })}
    {buttonVariant('Pressed', { bg: accentPressed })}
    {buttonVariant('Focus', { bg: accent, stroke: ink, strokeWidth: 2 })}
    {buttonVariant('Disabled', { bg: disabled }, muted)}
  </Button.Root>
)

export const SWITCH = (
  <Switch.Root name="Switch" modelValue="State" flex="row" gap={16} p={16}>
    <Component name="State=Off" w={40} h={22} rounded={11} bg={line}>
      <Switch.Thumb x={2} y={2} w={18} h={18} rounded={9} bg={surface} />
    </Component>
    <Component name="State=On" w={40} h={22} rounded={11} bg={accent}>
      <Switch.Thumb x={20} y={2} w={18} h={18} rounded={9} bg={surface} />
    </Component>
  </Switch.Root>
)

export const CHECKBOX = (
  <Checkbox.Root name="Checkbox" modelValue="Checked" flex="row" gap={16} p={16}>
    <Component
      name="Checked=Off"
      w={18}
      h={18}
      rounded={4}
      bg={surface}
      stroke={line}
      strokeWidth={1.5}
    />
    <Component name="Checked=On" w={18} h={18} rounded={4} bg={accent}>
      <Checkbox.Indicator x={5} y={5} w={8} h={8} rounded={2} bg={surface} />
    </Component>
  </Checkbox.Root>
)

export const SLIDER = (
  <Slider.Root name="Slider" w={220} h={20} min={0} max={100} step={1} defaultValue={60}>
    <Slider.Track x={0} y={8} w={220} h={4} rounded={2} bg={tile} />
    <Slider.Range x={0} y={8} w={132} h={4} rounded={2} bg={accent} />
    <Slider.Thumb
      x={122}
      y={0}
      w={20}
      h={20}
      rounded={10}
      bg={surface}
      stroke={accent}
      strokeWidth={2}
    />
  </Slider.Root>
)

export const TEXT_FIELD = (
  <TextField.Root
    name="Text field"
    w={260}
    h={36}
    rounded={8}
    bg={surface}
    stroke={line}
    flex="row"
    items="center"
    px={12}
  >
    <TextField.Input font="Inter" size={13} color={ink}>
      ada@example.com
    </TextField.Input>
  </TextField.Root>
)

const TABS_CONTENT = [
  ['Profile', 'Your name and photo, as teammates see them.'],
  ['Notifications', 'Choose what reaches your inbox.'],
  ['Billing', 'Plan, invoices, and payment method.']
] as const

export const TABS = (
  <Tabs.Root name="Tabs" w={300} flex="col" gap={12}>
    <Tabs.List flex="row" gap={4} p={4} rounded={8} bg={tile}>
      {TABS_CONTENT.map(([title]) => (
        <Tabs.Trigger px={12} py={6} rounded={6}>
          <Text font="Inter" size={12} weight={600} color={ink}>
            {title}
          </Text>
        </Tabs.Trigger>
      ))}
    </Tabs.List>
    {TABS_CONTENT.map(([, panel]) => (
      <Tabs.Content w={300} flex="col">
        <Text font="Inter" size={13} color={muted} w="fill">
          {panel}
        </Text>
      </Tabs.Content>
    ))}
  </Tabs.Root>
)
