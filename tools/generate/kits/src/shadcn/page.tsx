/** @jsxImportSource react */
/**
 * shadcn/ui's components, each a set of its variants in every interaction state, drawn from the
 * modules its CLI installed as an app draws them. Controls built on a Radix root are marked with the
 * behaviour they bind, so the import makes them behave in preview and code.
 */
import type { ReactElement } from 'react'

import {
  kitComponent,
  type KitBehaviour,
  type KitMarks,
  type KitModules,
  type KitState
} from '../kit'

const STATES: KitState[] = ['Default', 'Hover', 'Focus', 'Disabled']
const OFF_ON = ['Off', 'On'] as const

/** A control's checked or pressed value, bound to its `Checked` or `Pressed` variants. */
const checked = (property: string): KitBehaviour => ({
  values: { value: { property, on: 'On', off: 'Off' } },
  states: 'State'
})

export default function page(marks: KitMarks, modules: KitModules): ReactElement {
  const ui = (module: string, name: string) => kitComponent(modules, module, name)
  const Alert = ui('alert', 'Alert')
  const AlertTitle = ui('alert', 'AlertTitle')
  const AlertDescription = ui('alert', 'AlertDescription')
  const Avatar = ui('avatar', 'Avatar')
  const AvatarFallback = ui('avatar', 'AvatarFallback')
  const Badge = ui('badge', 'Badge')
  const Button = ui('button', 'Button')
  const Card = ui('card', 'Card')
  const CardHeader = ui('card', 'CardHeader')
  const CardTitle = ui('card', 'CardTitle')
  const CardDescription = ui('card', 'CardDescription')
  const CardContent = ui('card', 'CardContent')
  const Checkbox = ui('checkbox', 'Checkbox')
  const Input = ui('input', 'Input')
  const Kbd = ui('kbd', 'Kbd')
  const Label = ui('label', 'Label')
  const Progress = ui('progress', 'Progress')
  const Separator = ui('separator', 'Separator')
  const Skeleton = ui('skeleton', 'Skeleton')
  const Slider = ui('slider', 'Slider')
  const Switch = ui('switch', 'Switch')
  const Textarea = ui('textarea', 'Textarea')
  const Toggle = ui('toggle', 'Toggle')

  const set = (name: string, items: ReactElement[]) => (
    <div key={name} {...marks.set(name)}>
      {items}
    </div>
  )
  const { variant } = marks

  const sets = [
    set(
      'Button',
      ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'].flatMap((style) =>
        ['default', 'sm', 'lg'].flatMap((size) =>
          STATES.map((state) => (
            <Button
              key={`${style}${size}${state}`}
              variant={style}
              size={size}
              {...variant({ Variant: style, Size: size, State: state }, { state })}
            >
              Button
            </Button>
          ))
        )
      )
    ),
    set(
      'Badge',
      ['default', 'secondary', 'destructive', 'outline'].map((style) => (
        <Badge key={style} variant={style} {...variant({ Variant: style })}>
          Badge
        </Badge>
      ))
    ),
    set(
      'Switch',
      OFF_ON.flatMap((value) =>
        STATES.map((state) => (
          <Switch
            key={`${value}${state}`}
            defaultChecked={value === 'On'}
            {...variant({ Checked: value, State: state }, { state, behaviour: checked('Checked') })}
          />
        ))
      )
    ),
    set(
      'Checkbox',
      OFF_ON.flatMap((value) =>
        STATES.map((state) => (
          <Checkbox
            key={`${value}${state}`}
            defaultChecked={value === 'On'}
            {...variant({ Checked: value, State: state }, { state, behaviour: checked('Checked') })}
          />
        ))
      )
    ),
    set(
      'Toggle',
      ['default', 'outline'].flatMap((style) =>
        OFF_ON.flatMap((value) =>
          STATES.map((state) => (
            <Toggle
              key={`${style}${value}${state}`}
              variant={style}
              defaultPressed={value === 'On'}
              {...variant(
                { Variant: style, Pressed: value, State: state },
                { state, behaviour: checked('Pressed') }
              )}
            >
              Bold
            </Toggle>
          ))
        )
      )
    ),
    set(
      'Slider',
      STATES.map((state) => (
        <Slider
          key={state}
          defaultValue={[50]}
          className="w-60"
          {...variant(
            { State: state },
            { state, behaviour: { numbers: { value: { default: 50 } }, states: 'State' } }
          )}
        />
      ))
    ),
    set('Progress', [
      <Progress
        key="progress"
        value={60}
        className="w-60"
        {...variant({ Type: 'Default' }, { behaviour: { numbers: { value: { default: 60 } } } })}
      />
    ]),
    set(
      'Input',
      STATES.map((state) => (
        <Input key={state} placeholder="Email" {...variant({ State: state }, { state })} />
      ))
    ),
    set(
      'Textarea',
      STATES.map((state) => (
        <Textarea
          key={state}
          placeholder="Type your message here."
          {...variant({ State: state }, { state })}
        />
      ))
    ),
    set('Label', [
      <Label key="label" {...variant({ Type: 'Default' })}>
        Email
      </Label>
    ]),
    set('Kbd', [
      <Kbd key="kbd" {...variant({ Type: 'Default' })}>
        ⌘K
      </Kbd>
    ]),
    set('Separator', [
      <Separator key="separator" className="w-60" {...variant({ Orientation: 'Horizontal' })} />
    ]),
    set('Skeleton', [
      <Skeleton key="skeleton" className="h-4 w-60" {...variant({ Type: 'Line' })} />
    ]),
    set(
      'Avatar',
      ['sm', 'default', 'lg'].map((size) => (
        <Avatar key={size} size={size} {...variant({ Size: size })}>
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      ))
    ),
    set(
      'Alert',
      ['default', 'destructive'].map((style) => (
        <Alert key={style} variant={style} className="w-96" {...variant({ Variant: style })}>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>You can add components to your app.</AlertDescription>
        </Alert>
      ))
    ),
    set('Card', [
      <Card key="card" className="w-80" {...variant({ Type: 'Default' })}>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card Content</p>
        </CardContent>
      </Card>
    ])
  ]
  return (
    <div className="flex flex-col gap-8 bg-background p-8 font-sans text-foreground">{sets}</div>
  )
}
