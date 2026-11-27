import { Alert, AlertDescription, AlertTitle } from '#shadcn-ui/alert'
import { Avatar, AvatarFallback } from '#shadcn-ui/avatar'
import { Badge } from '#shadcn-ui/badge'
import { Button } from '#shadcn-ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#shadcn-ui/card'
import { Checkbox } from '#shadcn-ui/checkbox'
import { Input } from '#shadcn-ui/input'
import { Kbd } from '#shadcn-ui/kbd'
import { Label } from '#shadcn-ui/label'
import { Progress } from '#shadcn-ui/progress'
import { Separator } from '#shadcn-ui/separator'
import { Skeleton } from '#shadcn-ui/skeleton'
import { Slider } from '#shadcn-ui/slider'
import { Switch } from '#shadcn-ui/switch'
import { Textarea } from '#shadcn-ui/textarea'
import { Toggle } from '#shadcn-ui/toggle'
/** @jsxImportSource react */
/**
 * shadcn/ui's components, each a set of its variants in every interaction state, rendered from
 * the copied sources as an app renders them. Controls built on a Radix root are marked with the
 * behaviour they bind, so the import makes them behave in preview and code.
 */
import type { ReactElement } from 'react'

import type { KitBehaviour, KitMarks, KitState } from '../kit'

const STATES: KitState[] = ['Default', 'Hover', 'Focus', 'Disabled']
const OFF_ON = ['Off', 'On'] as const

/** A control's checked or pressed value, bound to its `Checked` or `Pressed` variants. */
const checked = (property: string): KitBehaviour => ({
  values: { value: { property, on: 'On', off: 'Off' } },
  states: 'State'
})

export default function page(marks: KitMarks): ReactElement {
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
              variant={style as 'default'}
              size={size as 'default'}
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
        <Badge key={style} variant={style as 'default'} {...variant({ Variant: style })}>
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
              variant={style as 'default'}
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
        <Avatar key={size} size={size as 'default'} {...variant({ Size: size })}>
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      ))
    ),
    set(
      'Alert',
      ['default', 'destructive'].map((style) => (
        <Alert
          key={style}
          variant={style as 'default'}
          className="w-96"
          {...variant({ Variant: style })}
        >
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
