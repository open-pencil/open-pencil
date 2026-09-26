# OpenPencil design authoring

This reference describes scene creation, not React DOM output. Use the `render` tool for JSX strings, or import `Frame`, `Text`, `renderTree`, and other authoring exports from `@open-pencil/core/design-jsx` in library code. Library exports are not automatically globals in agent `eval`; use only the bindings exposed by that execution environment.

## Composition and layout

- `flex="row"` / `flex="col"` enables auto-layout. Use it for content; reserve explicit `x`/`y` or `position="absolute"` for intentional overlays and artwork. Without layout, children share the origin unless positioned.
- `w` / `h` accept pixels, `"hug"` (content-sized), or `"fill"` (available space in a supported layout parent). Use Hug for notes, cards, and long pages instead of guessing heights. Fixed viewport sizes and artwork geometry are intentional exceptions.
- `gap` controls spacing. `p`, `px`, `py`, and `pt`/`pr`/`pb`/`pl` control padding; longhands override shorthands. There is no margin shorthand.
- `justify="start"|"end"|"center"|"between"` controls the primary axis; `items="start"|"end"|"center"|"stretch"` controls the cross axis. Distribution needs available space: `between` cannot create extra room in a Hug container.
- `grow` distributes available space. Avoid circular Hug/Fill dependencies and redundant fixed widths on growing children. Keep Fill sizing through intermediate containers that should stretch.
- For wrapping text in a column, prefer `w="fill"`; fixed-width text can use `textAutoResize="height"`. `maxLines` / `truncate` are intentional truncation, not fixes for accidental overflow.
- `wrap` and `rowGap` enable wrapped flex rows. `grid`, `columns`, and `rows` enable grid (for example `columns="1fr 200px 1fr"`). Grid children use `colStart`, `rowStart`, `colSpan`, and `rowSpan`. The current grid `gap` shorthand takes precedence over `columnGap` and `rowGap`.
- `flow="auto"|"ltr"|"rtl"` controls container flow; text `dir` controls writing direction. Preserve these separately.
- Use measured node bounds and the existing `arrange` tool for independent artboards. Prefer layout constraints to calculating child coordinates; ordinary JavaScript arithmetic is appropriate when real geometry calculations are needed.

## Paint, text, and artwork

- `bg` / `fill`, `stroke`, and text `color` accept colors and supported variable references. Set colors explicitly for predictable contrast. `fills` accepts structured paints; gradient helpers include `linearGradient`, `radialGradient`, `angularGradient`, and `diamondGradient`.
- `rounded` and `roundedTL`/`roundedTR`/`roundedBL`/`roundedBR` control corners. `strokeWidth`, `opacity`, `rotate`, and `blendMode` control appearance. `overflow="hidden"` clips content; do not hide accidental text overflow to make a broken layout appear correct.
- `effects` accepts structured effects such as `dropShadow`, `innerShadow`, and `layerBlur`. `shadow="offsetX offsetY blur #color"` and `blur` are convenient shorthands. Effect helpers take `blur` or `radius` for the radius; when a JSX string is rendered, an option a paint or effect helper does not support is reported as a warning.
- Text content belongs inside `Text`. Use `size`, `font`, `weight`, `lineHeight`, `letterSpacing`, `textAlign`, `textDecoration`, and `textCase`. Verify fonts actually load before judging dimensions; do not assume every font is available.
- `Icon` uses an Iconify name, size, and color. Prefer icons to emoji when reliable vector output is needed. Image fills belong on appropriate leaf shapes, not containers whose children must remain visible.
- Design JSX props are the portable authoring interface. Some CSS-style aliases are supported, but this is not a browser CSS engine; do not assume arbitrary HTML, classes, or styles work.

## Variables and components

- Create document variables before referencing them with `designVar('id-or-name')`. `defineVars` groups references; it does not create variable collections.
- COLOR references work in paint props. FLOAT references work in `w`, `h`, `gap`, padding, corner radii, `strokeWidth`, `opacity`, text `size`/`fontSize`, `lineHeight`, and `letterSpacing`. Grid `columnGap`/`rowGap` and wrapped flex `rowGap` also support FLOAT references; grid `gap` overrides both axis-specific gaps. Use numbers or FLOAT references for these scalar props, not CSS unit strings.
- References preserve real graph bindings, not just copied values. Set the intended collection mode on the parent before creating scalar-bound content: initial scalar layout resolves that inherited mode. This does not guarantee automatic scalar layout recomputation after a later mode switch. Verify resulting geometry as well as paint when changing modes. Missing or incorrectly typed scalar variables are errors.
- `bind` maps supported scene-field paths to variable IDs or references when no shorthand exists. Use semantic tokens consistently rather than declaring unused collections.
- A reusable JavaScript function shares source code, not component identity. Use `Component`, `ComponentSet`, and `Instance` for editable main components and linked instances.
- `Instance` resolves an existing component through `of`, `component`, or `componentId`. Component-set children named `variant=Primary`, for example, define variants that can be selected when instantiating the set.
- `Component` and `ComponentSet` accept `properties`, an array of native property definitions (`id`, `name`, `type`, `defaultValue`). `Instance` accepts `properties`, an ID-to-value assignment object. Ordinary nodes do not accept `properties`.
- Child `propertyRefs` connect fields to stable property IDs, for example `[{ propertyId: 'message', field: 'TEXT' }]`. Supported fields are `TEXT`, `VISIBLE`, and `INSTANCE_SWAP`; text and swap references require text and instance nodes respectively. References do not depend on layer names.
- Instance assignments use the native string values (including `'true'` / `'false'` for BOOLEAN properties and component IDs for swaps). For example `Instance({ of: noteId, properties: { message: 'Updated review' } })`. Assignments persist through component synchronization; unknown IDs and invalid values fail rather than silently creating inert overrides. Select variants through component-set variant props, not through instance property assignments.
- Reuse existing local or library components before recreating them. Keep meaningful text, visibility, and swap properties exposed rather than hand-editing cloned child nodes.
- Explicit instance `w` / `h` replace the inherited sizing mode on that axis; omitted dimensions retain the main component's sizing. Authored overrides survive component synchronization. Distinguish those placement constraints from the main component's default size, and verify actual bounds in narrower parents. Do not compensate for a sizing mismatch with guessed heights, clipping, or manually positioned siblings.

## Verification

Inspect structure and actual rendered output. Node counts and `describe` diagnostics do not establish visual fidelity. Check wrapping with longer content, narrower containers, component edits, and relevant modes. Resolve overflow and contrast problems at their source. Reuse IDs returned by creation tools rather than repeatedly searching for the same nodes.

The examples below are executed by the authoring-reference tests. Create the named variables before running a variable-bound example.
