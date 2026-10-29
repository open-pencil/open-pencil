/** What decides which props bind a variable on a layer. */
export interface BindingContext {
  text: boolean
  grid: boolean
  wrap: boolean
}

/** A prop a variable binds through, and the fields it sets. */
export interface BoundProp {
  prop: string
  fields: readonly string[]
}

export const PADDING_FIELDS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']

/**
 * The number props a FLOAT variable binds, in the order rendering reads them: shorthands before
 * their longhands, as `propsToOverrides` gives them precedence, so a literal longhand also
 * overrides a bound shorthand on that edge.
 */
export function scalarProps({ text, grid, wrap }: BindingContext): BoundProp[] {
  const props: BoundProp[] = [
    { prop: 'w', fields: ['width'] },
    { prop: 'h', fields: ['height'] },
    { prop: 'p', fields: PADDING_FIELDS },
    { prop: 'px', fields: ['paddingLeft', 'paddingRight'] },
    { prop: 'py', fields: ['paddingTop', 'paddingBottom'] },
    { prop: 'pt', fields: ['paddingTop'] },
    { prop: 'pr', fields: ['paddingRight'] },
    { prop: 'pb', fields: ['paddingBottom'] },
    { prop: 'pl', fields: ['paddingLeft'] },
    { prop: 'rounded', fields: ['cornerRadius'] },
    { prop: 'roundedTL', fields: ['topLeftRadius'] },
    { prop: 'roundedTR', fields: ['topRightRadius'] },
    { prop: 'roundedBL', fields: ['bottomLeftRadius'] },
    { prop: 'roundedBR', fields: ['bottomRightRadius'] },
    { prop: 'strokeWidth', fields: ['strokeWeight'] },
    { prop: 'opacity', fields: ['opacity'] }
  ]
  if (grid) {
    // Grid authoring gives `gap` precedence over the axis-specific props.
    props.push(
      { prop: 'columnGap', fields: ['gridColumnGap'] },
      { prop: 'rowGap', fields: ['gridRowGap'] },
      { prop: 'gap', fields: ['gridColumnGap', 'gridRowGap'] }
    )
  } else {
    props.push({ prop: 'gap', fields: ['itemSpacing'] })
    if (wrap) props.push({ prop: 'rowGap', fields: ['counterAxisSpacing'] })
  }
  if (text) {
    props.push(
      { prop: 'fontSize', fields: ['fontSize'] },
      // `size` is the short name, so it wins over `fontSize`, as it does for a literal.
      { prop: 'size', fields: ['fontSize'] },
      { prop: 'lineHeight', fields: ['lineHeight'] },
      { prop: 'letterSpacing', fields: ['letterSpacing'] }
    )
  }
  return props
}

/** The paint props a COLOR variable binds: the first fill's colour, or the first stroke's. */
export function paintProps({ text }: Pick<BindingContext, 'text'>): BoundProp[] {
  const fill = ['fills/0/color']
  const stroke = ['strokes/0/color']
  return [
    { prop: 'bg', fields: fill },
    { prop: 'fill', fields: fill },
    { prop: 'background', fields: fill },
    { prop: 'backgroundColor', fields: fill },
    ...(text ? [{ prop: 'color', fields: fill }] : []),
    { prop: 'stroke', fields: stroke },
    { prop: 'border', fields: stroke },
    { prop: 'borderColor', fields: stroke }
  ]
}
