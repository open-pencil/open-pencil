<!-- Generated from design-jsx reference and renderer metadata. Do not edit; run bun run generate:authoring-reference. -->

# OpenPencil design authoring

This reference describes scene creation, not React DOM output. Use the `render` tool for JSX strings, or import `Frame`, `Text`, and other authoring exports from `@open-pencil/design-jsx` and render them with `renderTree` from `@open-pencil/core/design-jsx` in library code. Library exports are not automatically globals in agent `eval`; use only the bindings exposed by that execution environment.

## Composition and layout

- `flex="row"` / `flex="col"` enables auto-layout. Use it for content; reserve explicit `x`/`y` or `position="absolute"` for intentional overlays and artwork. Without layout, children share the origin unless positioned.
- `w` / `h` accept pixels, `"hug"` (content-sized), or `"fill"` (available space in a supported layout parent). Use Hug for notes, cards, and long pages instead of guessing heights. Fixed viewport sizes and artwork geometry are intentional exceptions.
- `gap` controls spacing. `p`, `px`, `py`, and `pt`/`pr`/`pb`/`pl` control padding; longhands override shorthands. There is no margin shorthand.
- `justify="start"|"end"|"center"|"between"` controls the primary axis; `items="start"|"end"|"center"|"stretch"|"baseline"` controls the cross axis. Distribution needs available space: `between` cannot create extra room in a Hug container.
- `grow` distributes available space. Avoid circular Hug/Fill dependencies and redundant fixed widths on growing children. Keep Fill sizing through intermediate containers that should stretch.
- For wrapping text in a column, prefer `w="fill"`; fixed-width text can use `textAutoResize="height"`. `maxLines` / `truncate` are intentional truncation, not fixes for accidental overflow.
- `wrap` and `rowGap` enable wrapped flex rows. `grid`, `columns`, and `rows` enable grid (for example `columns="1fr 200px 1fr"` or `columns="repeat(7, 1fr)"`); tracks are `fr`, pixel lengths, `auto`, `repeat()`, and `minmax()`, which grows like its maximum. Grid children use `colStart`, `rowStart`, `colSpan`, and `rowSpan`. The current grid `gap` shorthand takes precedence over `columnGap` and `rowGap`.
- `flow="auto"|"ltr"|"rtl"` controls container flow; text `dir` controls writing direction. Preserve these separately.
- Outside auto-layout, and for `position="absolute"` children, `constraints={{ horizontal, vertical }}` sets how a layer follows its parent's resizing, with Figma's values in lowercase: `"min"`, `"center"`, `"max"`, `"stretch"`, or `"scale"`. `minW`, `maxW`, `minH`, and `maxH` bound a layer's size. `visible={false}` hides a layer and `locked` locks it.
- Use measured node bounds and the existing `arrange` tool for independent artboards. Prefer layout constraints to calculating child coordinates; ordinary JavaScript arithmetic is appropriate when real geometry calculations are needed.

## Paint, text, and artwork

- `bg` / `fill`, `stroke`, and text `color` accept colors and supported variable references. Set colors explicitly for predictable contrast. `fills` accepts structured paints; gradient helpers include `linearGradient`, `radialGradient`, `angularGradient`, and `diamondGradient`, each taking an array of stops and optional `{ opacity, transform }`: `fills={[linearGradient([['#3b82f6', 0], ['#8b5cf6', 1]])]}`. Without a `transform` a linear gradient runs left to right and the others are centred; `transform` is Figma's `gradientTransform`, mapping the layer's unit square onto gradient space. Write it as the plugin API's rows, as export does: `linearGradient(stops, { transform: [[0, 1, 0], [-1, 0, 1]] })` runs top to bottom. A paint written as an object takes its `gradientTransform` and `imageTransform` as rows too; the matrix fields `{ m00, m01, m02, m10, m11, m12 }` are accepted as well.
- `shader(effects, { opacity, visible, blendMode })` fills a layer with a shader from the [`shaders`](https://shaders.com) library: an array of effects such as `bg={shader([{ type: 'Aurora', props: { speed: 2 } }])}`, or a preset as shaders.com exports it, `{ components: [...] }`. The canvas shows the shader's first frame, preview plays it, and files and other formats keep that frame as an image.
- `stroke` describes one stroke, refined by `strokeWidth`, `strokeAlign` (`"inside"`, `"center"`, `"outside"`), `strokeDash`, `strokeCap`, and `strokeJoin`. `strokes` takes several, as objects with `color`, `weight`, `align`, `dash`, `cap`, `join`, and `visible`; `strokeWeights={{ top, right, bottom, left }}` sets per-side widths. `dashPattern` sets the node's own dash pattern, separate from the per-stroke `strokeDash`.
- `rounded` and `roundedTL`/`roundedTR`/`roundedBL`/`roundedBR` control corners. `strokeWidth`, `opacity`, `rotate`, and `blendMode` control appearance. `overflow="hidden"` clips content; do not hide accidental text overflow to make a broken layout appear correct.
- `rotate` turns a layer by degrees, and `flipX` and `flipY` reflect it across its centre before it turns, as the canvas places it. `Star` takes `points` and `innerRadius` (0–1, how deep its points go); `Polygon` takes `points`. `Ellipse` draws an arc or a donut with `startAngle` and `endAngle` in degrees, clockwise from three o'clock (0 to 360 by default), and `innerRadius` (0–1, the hole): `<Ellipse w={80} h={80} startAngle={0} endAngle={270} innerRadius={0.6} />`.
- `effects` accepts structured effects such as `dropShadow`, `innerShadow`, and `layerBlur`. `shadow` takes a CSS `box-shadow` list, such as `shadow="0 4 8 #0002, inset 0 1 0 #fff"`, and `blur` a layer blur radius; both are convenient shorthands. Effect helpers take `radius`, as Figma's effects do; when a JSX string is rendered, an option a paint or effect helper does not support is reported as a warning.
- Text content belongs inside `Text`. Use `size`, `font`, `weight`, `italic`, `lineHeight`, `letterSpacing`, `textAlign`, `textAlignVertical`, `textDecoration`, and `textCase`. Decorations take CSS's names and values: `textDecorationStyle` (`solid`, `dotted`, `wavy`), `textDecorationColor` (`currentColor` follows the text), `textDecorationThickness` and `textUnderlineOffset` (pixels or `auto`), and `textDecorationSkipInk`. `lineHeight="auto"` follows the font, and `fills={[]}` paints no text. Verify fonts actually load before judging dimensions; do not assume every font is available.
- `Span` styles some characters of a `Text` with `Text`'s own prop names: `size`, `font`, `weight`, `italic`, `color`, `fills`, `lineHeight`, `letterSpacing`, `textDecoration`, the decoration details, and `textCase`. `href` links its characters to a URL without changing how they look. Spans nest; the inner one wins. `Paragraph` writes one paragraph: `list="ordered"` or `list="unordered"` makes it a list item nested at `level` 1–5, and `spacing`, `listSpacing`, and `indent` override the `Text`'s `paragraphSpacing`, `listSpacing`, and `paragraphIndent` for it; `hangingList` on the `Text` hangs list markers outside the text box. A `Text` holds only `Paragraph`s or none; without them, a line break in its text still starts a paragraph.
- `Icon` uses an Iconify name, size, and color. Prefer icons to emoji when reliable vector output is needed. Image fills belong on appropriate leaf shapes, not containers whose children must remain visible.
- `Sticky` makes a FigJam sticky note whose text is its body: `<Sticky color="yellow" author="Ada">Ship it</Sticky>`. `color` takes a FigJam palette name (`white`, `gray`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `violet`, `pink`) or any colour, `author` signs it (`authorVisible={false}` hides the line), `wide` makes it 416 wide instead of 240, `textSize` is `small`, `medium`, `large`, `extraLarge`, or `huge`, `typeface` is `simple`, `bookish`, `technical`, or `scribbled`, and `scale` scales the whole note. A note sizes itself; it takes no `w`, `h`, fills, or layout props.
- `Shape` makes a FigJam shape with text whose text is its label: `<Shape kind="diamond" bg="#FFC943">Valid?</Shape>`. `kind` is `square` (default), `ellipse`, `diamond`, `rounded_rectangle`, `parallelogram_right`, `eng_database`, or another FigJam shape, written in lowercase. `w` and `h` are the size it is given (176 by default); it grows taller to fit its label, never wider, so a word too long for it breaks. `truncate` keeps its height and cuts the label off with "…" instead, as FigJam does once a shape's height is set. `bg`, `stroke`, `strokeWidth`, `rounded` (6 by default), and `rotate` style it as any layer; the label is centred in the shape and takes the same `textSize` and `typeface` as `Sticky`.
- `Connector` draws a FigJam connector that follows the layers it joins: `<Connector from="Start" to="Done">Next</Connector>`. `from` and `to` name layers of the same JSX, take a `ref()` a layer is marked with (`const card = ref()`, then `<Frame ref={card}>` and `from={card}`), or give `{ x, y }` points in the connector's parent; `fromSide`/`toSide` (`top`, `right`, `bottom`, `left`) fix the side it attaches by, `line` is `elbowed` (default), `straight`, or `curved`, and `startCap`/`endCap` take the same caps as `strokeCap`: `none`, `round`, `square`, `arrow_lines`, `arrow_equilateral`, `triangle_filled`, `diamond_filled`, or `circle_filled` (it starts with none and ends with `arrow_lines`). Its text is the label; `stroke`, `strokeWidth`, and `dashPattern` style the line. When layers share a name, join them by `ref()`; a name more than one layer has joins the first, with a warning.
- Design JSX props are the portable authoring interface. Some CSS-style aliases are supported, but this is not a browser CSS engine; do not assume arbitrary HTML, classes, or styles work.

## Variables and components

- Create document variables before referencing them with `designVar('id-or-name')`. `defineVars` groups references; it does not create variable collections.
- COLOR references work in paint props. FLOAT references work in `w`, `h`, `gap`, padding, corner radii, `strokeWidth`, `opacity`, text `size`/`fontSize`, `lineHeight`, and `letterSpacing`. Grid `columnGap`/`rowGap` and wrapped flex `rowGap` also support FLOAT references; grid `gap` overrides both axis-specific gaps. Use numbers or FLOAT references for these scalar props, not CSS unit strings.
- References preserve real graph bindings, not just copied values. Set the intended collection mode on the parent before creating scalar-bound content: initial scalar layout resolves that inherited mode. This does not guarantee automatic scalar layout recomputation after a later mode switch. Verify resulting geometry as well as paint when changing modes. Missing or incorrectly typed scalar variables are errors.
- `bind` maps supported scene-field paths to variable IDs or references when no shorthand exists. Use semantic tokens consistently rather than declaring unused collections.
- Build repeated or computed content with JavaScript inside `{}` rather than writing each item out: `{days.map((day) => <Text>{day}</Text>)}`, `{Array.from({ length: 35 }, (_, i) => <Frame>…</Frame>)}`, and conditionals. Statements such as `const weeks = …` may come first and then end with `return` and the JSX, as a component's body does: `const weeks = 5` on one line, `return <Frame>…</Frame>` on the next.
- A reusable JavaScript function shares source code, not component identity. Use `Component`, `ComponentSet`, and `Instance` for editable main components and linked instances.
- `Instance` resolves an existing component through `of`, `component`, or `componentId`. Component-set children named `variant=Primary`, for example, define variants that can be selected when instantiating the set.
- `Component` and `ComponentSet` accept `properties`, an array of native property definitions (`id`, `name`, `type`, `defaultValue`). An `Instance` sets text, boolean, and swap properties by name, the way it picks a variant: `<Instance of="Note" State="Done" Message="Updated review" Pinned={false} />`. `properties` takes the same values keyed by property ID or name, for names that are not JSX identifiers or that design JSX already uses, such as `name`. Names survive a `.fig` save, which replaces authored IDs such as `message` with Figma IDs. Ordinary nodes do not accept `properties`.
- Child `propertyRefs` connect fields to stable property IDs, for example `[{ propertyId: 'message', field: 'TEXT' }]`. Supported fields are `TEXT`, `VISIBLE`, and `INSTANCE_SWAP`; text and swap references require text and instance nodes respectively. References do not depend on layer names.
- Instance assignments use the native string values (`'true'` / `'false'` for BOOLEAN properties and component IDs for swaps), and a property set as a prop also takes `true` / `false`, as in `Pinned={false}`. Assignments persist through component synchronization; unknown IDs and invalid values fail rather than silently creating inert overrides. Select variants through component-set variant props, not through instance property assignments.
- Reuse existing local or library components before recreating them. Keep meaningful text, visibility, and swap properties exposed rather than hand-editing cloned child nodes.
- Explicit instance `w` / `h` replace the inherited sizing mode on that axis; omitted dimensions retain the main component's sizing. Authored overrides survive component synchronization. Distinguish those placement constraints from the main component's default size, and verify actual bounds in narrower parents. Do not compensate for a sizing mismatch with guessed heights, clipping, or manually positioned siblings.

## Controls

- A main component can behave as a Reka UI control in preview and code. Write it with Reka's names: `Switch.Root` is the component (a component set when its children are `Component` variants), and each Reka part is the slot that draws it, such as `Switch.Thumb`, `Slider.Track`, `Slider.Range`, `Slider.Thumb`, `Progress.Track`, `Progress.Indicator`, `Tabs.List`, `Collapsible.Trigger`, or `NumberField.Increment`. Parts in different variants share one slot.
- The root names the properties that hold its values: `modelValue` (`open` on `Collapsible.Root`), `disabled`, and, for text fields, `filled`, as a variant or boolean property name, or `{ property, on, off }` when the variant values are not named like On and Off. `states` names the variant property that draws default, hover, pressed, focus, and disabled; a slider, progress bar, or number field takes `min`, `max`, `step`, and `defaultValue`.
- `TextField.Input`, `Textarea.Input`, and `NumberField.Input` are the text layers whose text becomes the field's text property. `Tabs.Trigger` goes in `Tabs.List`; `Tabs.Content` panels may sit directly under `Tabs.Root`, the first showing. A part with children and no `flex`, `display`, `w`, or `h` of its own stacks them in a column that hugs them.
- A group's item component is written on its own (`RadioGroup.Item`, `ToggleGroup.Item`, `Accordion.Item` with its `Accordion.Trigger` and `Accordion.Content`); the group's root then lists items as `<RadioGroup.Item of={radioId} />`.

```tsx
<Switch.Root name="Switch" modelValue="State" states="Interaction">
  <Component name="State=Off, Interaction=Default" w={44} h={24} rounded={12} bg="#D0D4DA">
    <Switch.Thumb x={2} y={2} w={20} h={20} rounded={10} bg="#FFFFFF" />
  </Component>
  <Component name="State=On, Interaction=Default" w={44} h={24} rounded={12} bg="#3B6CF6">
    <Switch.Thumb x={22} y={2} w={20} h={20} rounded={10} bg="#FFFFFF" />
  </Component>
</Switch.Root>
```

## Verification

Inspect structure and actual rendered output. Node counts and `describe` diagnostics do not establish visual fidelity. Check wrapping with longer content, narrower containers, component edits, and relevant modes. Resolve overflow and contrast problems at their source. Reuse IDs returned by creation tools rather than repeatedly searching for the same nodes.

The examples below are executed by the authoring-reference tests. Create the named variables before running a variable-bound example.

## Content-sized review note

```jsx
<Frame name="Review note" w={280} h="hug" flex="col" gap={8} p={16} bg="#FFFFFF">
<Text name="Author" size={12} weight="medium" color="#252A31">June Lee</Text>
<Text name="Message" w="fill" size={12} color="#6B7079">Give the date a little more room at the bottom.</Text>
</Frame>
```

## Variable-bound spacing and typography

```jsx
<Frame name="Bound note" w={280} h="hug" flex="col" gap={designVar('Space/small')} p={designVar('Space/medium')} bg="#FFFFFF">
<Text name="Message" w="fill" size={designVar('Type/body')} lineHeight={designVar('Type/body-leading')} letterSpacing={designVar('Type/body-tracking')} color="#252A31">A note that grows with its content.</Text>
</Frame>
```

## Rich text with spans and lists

```jsx
<Frame name="Release notes" w={280} h="hug" flex="col" gap={8} p={16} bg="#FFFFFF">
<Text name="Notes" w="fill" size={12} color="#252A31" paragraphSpacing={4}>
  <Paragraph spacing={8}>Version 2 is <Span weight="bold" color="#3B6CF6" textDecoration="underline" textDecorationStyle="wavy" textUnderlineOffset={2}>out now</Span>.</Paragraph>
  <Paragraph list="unordered">Faster export</Paragraph>
  <Paragraph list="unordered" level={2}>PDF and SVG</Paragraph>
  <Paragraph list="ordered">Fewer clicks</Paragraph>
</Text>
</Frame>
```

## Supported syntax inventory

Generated from the renderer metadata. This inventory lists accepted names, not arbitrary browser CSS support.

**Elements:** `Frame`, `Text`, `Span`, `Paragraph`, `Rectangle`, `Ellipse`, `Line`, `Star`, `Polygon`, `Vector`, `Group`, `Section`, `Component`, `ComponentSet`, `Instance`, `View`, `Rect`, `Icon`, `Sticky`, `Shape`, `Connector`, `Button.Root`, `Toggle.Root`, `Switch.Root`, `Switch.Thumb`, `Checkbox.Root`, `Checkbox.Indicator`, `RadioGroup.Root`, `RadioGroup.Item`, `RadioGroup.Indicator`, `ToggleGroup.Root`, `ToggleGroup.Item`, `Slider.Root`, `Slider.Track`, `Slider.Range`, `Slider.Thumb`, `Progress.Root`, `Progress.Track`, `Progress.Indicator`, `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`, `Collapsible.Root`, `Collapsible.Trigger`, `Collapsible.Content`, `Accordion.Root`, `Accordion.Item`, `Accordion.Header`, `Accordion.Trigger`, `Accordion.Content`, `NumberField.Root`, `NumberField.Input`, `NumberField.Increment`, `NumberField.Decrement`, `TextField.Root`, `TextField.Input`, `Textarea.Root`, `Textarea.Input`.

**Helpers:** `solid`, `gradient`, `linearGradient`, `radialGradient`, `angularGradient`, `diamondGradient`, `shader`, `dropShadow`, `innerShadow`, `layerBlur`, `backgroundBlur`, `foregroundBlur`, `designVar`, `defineVars`, `ref`.

**Properties:** `name`, `key`, `ref`, `flex`, `flow`, `dir`, `gap`, `wrap`, `rowGap`, `columnGap`, `justify`, `justifyContent`, `items`, `align`, `alignItems`, `grow`, `w`, `h`, `width`, `height`, `minW`, `maxW`, `minH`, `maxH`, `x`, `y`, `top`, `left`, `position`, `constraints`, `p`, `padding`, `px`, `py`, `pt`, `pr`, `pb`, `pl`, `bg`, `fill`, `fills`, `background`, `backgroundColor`, `stroke`, `border`, `borderColor`, `strokeWidth`, `borderWidth`, `strokeAlign`, `strokeDash`, `strokeCap`, `strokeJoin`, `dashPattern`, `strokes`, `strokeWeights`, `rounded`, `borderRadius`, `roundedTL`, `roundedTR`, `roundedBL`, `roundedBR`, `cornerRadius`, `cornerSmoothing`, `opacity`, `blendMode`, `rotate`, `rotation`, `flipX`, `flipY`, `overflow`, `mask`, `visible`, `locked`, `shadow`, `blur`, `effects`, `size`, `fontSize`, `font`, `fontFamily`, `weight`, `fontWeight`, `italic`, `color`, `text`, `characters`, `content`, `value`, `title`, `textAlign`, `textAlignHorizontal`, `textHorizontalAlignment`, `textAlignVertical`, `textVerticalAlignment`, `textAutoResize`, `lineHeight`, `letterSpacing`, `textDecoration`, `textDecorationStyle`, `textDecorationColor`, `textDecorationThickness`, `textUnderlineOffset`, `textDecorationSkipInk`, `textCase`, `paragraphSpacing`, `paragraphIndent`, `hangingList`, `list`, `level`, `spacing`, `listSpacing`, `indent`, `maxLines`, `truncate`, `grid`, `columns`, `rows`, `colStart`, `rowStart`, `col`, `row`, `colSpan`, `rowSpan`, `points`, `pointCount`, `innerRadius`, `startAngle`, `endAngle`, `label`, `style`, `bind`, `component`, `componentId`, `properties`, `propertyRefs`, `of`, `modelValue`, `open`, `disabled`, `filled`, `states`, `min`, `max`, `step`, `defaultValue`.