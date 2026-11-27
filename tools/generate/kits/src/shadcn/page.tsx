/** @jsxImportSource react */
/**
 * shadcn/ui as a document: a cover, then a page per component with what its documentation says,
 * the component as a set of its variants in every interaction state, and the examples shadcn
 * shows for it, drawn from the modules its CLI installed as an app draws them. Controls built on
 * a Radix root are marked with the behaviour they bind, so the import makes them behave in
 * preview and code.
 */
import type { ComponentType, ReactElement, ReactNode } from 'react'

import {
  kitComponent,
  type KitAbout,
  type KitBehaviour,
  type KitCell,
  type KitComponentProps,
  type KitMarks,
  type KitModules
} from '../kit'
import { RenderBoundary } from '../react/boundary'
import {
  ALERT_STYLES,
  AVATAR_SIZES,
  BADGE_STYLES,
  BUTTON_SIZES,
  BUTTON_STYLES,
  named,
  OFF_ON,
  STATES,
  TOGGLE_STYLES
} from './variants'

/** A control's checked or pressed value, bound to its `Checked` or `Pressed` variants. */
const checked = (property: string): KitBehaviour => ({
  values: { value: { property, on: 'On', off: 'Off' } },
  states: 'State'
})

type UI = (name: string) => ComponentType<KitComponentProps>

/**
 * A component's set: its variants, or, when they vary by state, a row of cells of one size per
 * `rows` label, one cell per state.
 */
interface SetDrawing {
  rows?: string[]
  cell?: KitCell
  variants: ReactElement[]
}

/** Every value of each property, combined in order, as one label per row. */
const rowsOf = (...properties: (readonly string[])[]): string[] =>
  properties.reduce<string[]>(
    (rows, values) =>
      rows.flatMap((row) => values.map((value) => (row ? `${row} · ${value}` : value))),
    ['']
  )

/** How each component's set is drawn, by the module it is in. */
const SETS: Record<string, (ui: UI, marks: KitMarks) => SetDrawing> = {
  button: (ui, { variant }) => {
    const Button = ui('Button')
    return {
      rows: rowsOf(BUTTON_STYLES.map(named), BUTTON_SIZES.map(named)),
      cell: { width: 136, height: 52 },
      variants: BUTTON_STYLES.flatMap((style) =>
        BUTTON_SIZES.flatMap((size) =>
          STATES.map((state) => (
            <Button
              key={`${style}${size}${state}`}
              variant={style}
              size={size}
              {...variant({ Variant: named(style), Size: named(size), State: state }, { state })}
            >
              Button
            </Button>
          ))
        )
      )
    }
  },
  badge: (ui, { variant }) => {
    const Badge = ui('Badge')
    return {
      variants: BADGE_STYLES.map((style) => (
        <Badge key={style} variant={style} {...variant({ Variant: named(style) })}>
          Badge
        </Badge>
      ))
    }
  },
  switch: (ui, { variant }) => {
    const Switch = ui('Switch')
    return {
      rows: [...OFF_ON],
      cell: { width: 96, height: 40 },
      variants: OFF_ON.flatMap((value) =>
        STATES.map((state) => (
          <Switch
            key={`${value}${state}`}
            defaultChecked={value === 'On'}
            {...variant({ Checked: value, State: state }, { state, behaviour: checked('Checked') })}
          />
        ))
      )
    }
  },
  checkbox: (ui, { variant }) => {
    const Checkbox = ui('Checkbox')
    return {
      rows: [...OFF_ON],
      cell: { width: 96, height: 40 },
      variants: OFF_ON.flatMap((value) =>
        STATES.map((state) => (
          <Checkbox
            key={`${value}${state}`}
            defaultChecked={value === 'On'}
            {...variant({ Checked: value, State: state }, { state, behaviour: checked('Checked') })}
          />
        ))
      )
    }
  },
  toggle: (ui, { variant }) => {
    const Toggle = ui('Toggle')
    return {
      rows: rowsOf(TOGGLE_STYLES.map(named), OFF_ON),
      cell: { width: 112, height: 52 },
      variants: TOGGLE_STYLES.flatMap((style) =>
        OFF_ON.flatMap((value) =>
          STATES.map((state) => (
            <Toggle
              key={`${style}${value}${state}`}
              variant={style}
              defaultPressed={value === 'On'}
              {...variant(
                { Variant: named(style), Pressed: value, State: state },
                { state, behaviour: checked('Pressed') }
              )}
            >
              Bold
            </Toggle>
          ))
        )
      )
    }
  },
  slider: (ui, { variant }) => {
    const Slider = ui('Slider')
    return {
      rows: ['Default'],
      cell: { width: 248, height: 40 },
      variants: STATES.map((state) => (
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
    }
  },
  progress: (ui, { variant }) => {
    const Progress = ui('Progress')
    return {
      variants: [
        <Progress
          key="progress"
          value={60}
          className="w-60"
          {...variant({ Type: 'Default' }, { behaviour: { numbers: { value: { default: 60 } } } })}
        />
      ]
    }
  },
  input: (ui, { variant }) => {
    const Input = ui('Input')
    return {
      rows: ['Default'],
      cell: { width: 248, height: 48 },
      variants: STATES.map((state) => (
        <Input
          key={state}
          placeholder="Email"
          className="w-60"
          {...variant({ State: state }, { state })}
        />
      ))
    }
  },
  textarea: (ui, { variant }) => {
    const Textarea = ui('Textarea')
    return {
      rows: ['Default'],
      cell: { width: 248, height: 96 },
      variants: STATES.map((state) => (
        <Textarea
          key={state}
          placeholder="Type your message here."
          className="w-60"
          {...variant({ State: state }, { state })}
        />
      ))
    }
  },
  label: (ui, { variant }) => {
    const Label = ui('Label')
    return {
      variants: [
        <Label key="label" {...variant({ Type: 'Default' })}>
          Email
        </Label>
      ]
    }
  },
  kbd: (ui, { variant }) => {
    const Kbd = ui('Kbd')
    return {
      variants: [
        <Kbd key="kbd" {...variant({ Type: 'Default' })}>
          ⌘K
        </Kbd>
      ]
    }
  },
  separator: (ui, { variant }) => {
    const Separator = ui('Separator')
    return {
      variants: [
        <Separator key="separator" className="w-60" {...variant({ Orientation: 'Horizontal' })} />
      ]
    }
  },
  skeleton: (ui, { variant }) => {
    const Skeleton = ui('Skeleton')
    return {
      variants: [<Skeleton key="skeleton" className="h-4 w-60" {...variant({ Type: 'Line' })} />]
    }
  },
  avatar: (ui, { variant }) => {
    const Avatar = ui('Avatar')
    const AvatarFallback = ui('AvatarFallback')
    return {
      variants: AVATAR_SIZES.map((size) => (
        <Avatar key={size} size={size} {...variant({ Size: named(size) })}>
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      ))
    }
  },
  alert: (ui, { variant }) => {
    const Alert = ui('Alert')
    const AlertTitle = ui('AlertTitle')
    const AlertDescription = ui('AlertDescription')
    return {
      variants: ALERT_STYLES.map((style) => (
        <Alert key={style} variant={style} className="w-96" {...variant({ Variant: named(style) })}>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>You can add components to your app.</AlertDescription>
        </Alert>
      ))
    }
  },
  card: (ui, { variant }) => {
    const Card = ui('Card')
    const CardHeader = ui('CardHeader')
    const CardTitle = ui('CardTitle')
    const CardDescription = ui('CardDescription')
    const CardContent = ui('CardContent')
    return {
      variants: [
        <Card key="card" className="w-80" {...variant({ Type: 'Default' })}>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card Content</p>
          </CardContent>
        </Card>
      ]
    }
  }
}

/** The order the components' pages come in. */
const ORDER = [
  'button',
  'badge',
  'input',
  'textarea',
  'label',
  'checkbox',
  'switch',
  'toggle',
  'slider',
  'progress',
  'avatar',
  'alert',
  'card',
  'kbd',
  'separator',
  'skeleton'
]

/** What the documentation's links are called on the page. */
const LINK_LABELS: Record<string, string> = { doc: 'Radix docs', api: 'API reference' }

/** Tailwind's radius scale, which the theme's radius sets. */
const RADII = ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']
/** Steps of Tailwind's spacing scale, each a multiple of the theme's spacing. */
const SPACING = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
/** Tailwind's type scale. */
const TYPE_SIZES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']

/** A swatch of each of the theme's colors, named after its custom property. */
function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="grid grid-cols-6 gap-4">
      {colors.map((color) => (
        <div key={color} className="flex flex-col gap-2">
          <div
            className="h-16 rounded-lg border border-border"
            style={{ background: `var(${color})` }}
          />
          <span className="text-xs text-muted-foreground">{color.slice(2)}</span>
        </div>
      ))}
    </div>
  )
}

/** How wide the labels of a set's rows are. */
const ROW_LABEL_WIDTH = 160

/** A set drawn in rows of states, with the states above it and each row's values beside it. */
function LabelledSet({
  rows,
  cell,
  children
}: {
  rows: string[]
  cell: KitCell
  children: ReactNode
}) {
  const label = 'flex items-center text-xs text-muted-foreground'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex" style={{ paddingLeft: ROW_LABEL_WIDTH }}>
        {STATES.map((state) => (
          <div key={state} className={`${label} shrink-0`} style={{ width: cell.width }}>
            {state}
          </div>
        ))}
      </div>
      <div className="flex">
        <div className="flex shrink-0 flex-col" style={{ width: ROW_LABEL_WIDTH }}>
          {rows.map((row) => (
            <div key={row} className={label} style={{ height: cell.height }}>
              {row}
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

export default function page(marks: KitMarks, modules: KitModules, about: KitAbout): ReactElement {
  const pages = ORDER.map((module) => {
    const doc = about.docs[module]
    const ui: UI = (name) => kitComponent(modules, module, name)
    const drawing = SETS[module](ui, marks)
    const Examples = kitComponent(modules, `${module}-example`, 'default')
    return (
      <section
        key={module}
        {...marks.page(doc.title)}
        className="flex w-[1280px] flex-col gap-12 bg-background p-16 text-foreground"
      >
        <header className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{doc.title}</h1>
          <p className="text-lg text-muted-foreground">{doc.description}</p>
          <p className="text-sm text-muted-foreground">
            {Object.entries(doc.links).map(([label, href], index) => (
              <span key={label}>
                {index > 0 && ' · '}
                <a href={href} className="underline underline-offset-4">
                  {LINK_LABELS[label] ?? label}
                </a>
              </span>
            ))}
          </p>
        </header>
        <Section title="Component">
          {drawing.rows && drawing.cell ? (
            <LabelledSet rows={drawing.rows} cell={drawing.cell}>
              <div {...marks.set(doc.title, { columns: STATES.length, cell: drawing.cell })}>
                {drawing.variants}
              </div>
            </LabelledSet>
          ) : (
            <div {...marks.set(doc.title)}>{drawing.variants}</div>
          )}
        </Section>
        <Section title="Examples">
          <RenderBoundary name={`The ${doc.title} examples`}>
            <Examples />
          </RenderBoundary>
        </Section>
        <Section title="Examples in dark">
          <div {...marks.mode('Dark')} className="rounded-xl bg-background p-6">
            <RenderBoundary name={`The ${doc.title} examples`}>
              <Examples />
            </RenderBoundary>
          </div>
        </Section>
      </section>
    )
  })
  const foundations = (
    <section
      {...marks.page('Foundations')}
      className="flex w-[1280px] flex-col gap-12 bg-background p-16 text-foreground"
    >
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Foundations</h1>
        <p className="text-lg text-muted-foreground">
          The theme's variables, in light and dark: its colors, its radius scale, its spacing, and
          its type.
        </p>
      </header>
      <Section title="Colors">
        <Swatches colors={about.theme.colors} />
      </Section>
      <Section title="Colors in dark">
        <div {...marks.mode('Dark')} className="rounded-xl bg-background p-6">
          <Swatches colors={about.theme.colors} />
        </div>
      </Section>
      <Section title="Radius">
        <div className="flex flex-wrap gap-6">
          {RADII.map((radius) => (
            <div key={radius} className="flex flex-col items-center gap-2">
              <div className={`size-20 border border-border bg-muted rounded-${radius}`} />
              <span className="text-xs text-muted-foreground">{radius}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Spacing">
        <div className="flex flex-col gap-2">
          {SPACING.map((step) => (
            <div key={step} className="flex items-center gap-4">
              <span className="w-8 text-xs text-muted-foreground">{step}</span>
              <div
                className="h-3 rounded-sm bg-primary"
                style={{ width: `calc(var(--spacing) * ${step})` }}
              />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Type">
        <div className="flex flex-col gap-3">
          {TYPE_SIZES.map((size) => (
            <p key={size} className={`text-${size}`}>
              {size} · The quick brown fox jumps over the lazy dog
            </p>
          ))}
        </div>
      </Section>
    </section>
  )
  const cover = (
    <section
      {...marks.page('Cover')}
      className="flex w-[1280px] flex-col gap-24 bg-background p-16 text-foreground"
    >
      <div className="flex flex-col gap-4">
        <h1 className="text-6xl font-semibold tracking-tight">shadcn/ui</h1>
        <p className="max-w-2xl text-xl text-muted-foreground">
          shadcn/ui's components as its CLI installs them on Radix, with the nova style and the
          neutral theme, in light and dark. Each page has a component with its variants in every
          state, and the examples shadcn shows for it.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Installed with {about.installer} ·{' '}
        {ORDER.map((module) => about.docs[module].title).join(' · ')}
      </p>
    </section>
  )
  // An app wraps itself in the tooltip provider, which the examples that show tooltips need.
  const TooltipProvider = kitComponent(modules, 'tooltip', 'TooltipProvider')
  return (
    <TooltipProvider>
      <div className="flex flex-col font-sans">
        {cover}
        {foundations}
        {pages}
      </div>
    </TooltipProvider>
  )
}
