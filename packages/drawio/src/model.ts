/** A point or offset, in the coordinates of the cell's parent. */
export interface DrawioPoint {
  x: number
  y: number
}

/**
 * A cell's `mxGeometry`. A vertex has a box in its parent's coordinates. An edge has its bend
 * `points` and, when an end is not attached, `sourcePoint` and `targetPoint`. A `relative` vertex
 * whose parent is an edge, as draw.io stores an edge label it moved, sits `x` of the way along the
 * edge, from -1 at its source to 1 at its target, `y` across it, and `offset` from there.
 */
export interface DrawioGeometry {
  x: number
  y: number
  width: number
  height: number
  relative: boolean
  points: DrawioPoint[]
  sourcePoint: DrawioPoint | null
  targetPoint: DrawioPoint | null
  offset: DrawioPoint | null
}

/**
 * A `style` string: the names of stylesheet styles it starts from, such as `ellipse` or `text`,
 * and its `key=value` pairs, both in the order written.
 */
export interface DrawioStyle {
  names: string[]
  values: Partial<Record<string, string>>
}

/** A shape or a connecting edge, in the order draw.io draws them. */
export interface DrawioCell {
  id: string
  /** The cell or layer it belongs to. */
  parent: string
  kind: 'vertex' | 'edge'
  /** The label: HTML when the style says `html=1`, plain text otherwise. */
  value: string
  style: DrawioStyle
  geometry: DrawioGeometry
  visible: boolean
  source: string | null
  target: string | null
  /**
   * Attributes of the `UserObject` or `object` that wraps the cell, such as `tooltip` and `link`,
   * and placeholders it fills in.
   */
  attributes: Record<string, string>
}

/** One of a page's layers, bottom first: the cells whose parent it is draw on it. */
export interface DrawioLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
}

export interface DrawioPage {
  id: string
  name: string
  /** The model's own attributes, such as `grid` and `background`. */
  attributes: Record<string, string>
  /** The id of the cell at the root of the model, which the layers belong to. */
  rootId: string
  layers: DrawioLayer[]
  cells: DrawioCell[]
}

/** A draw.io file: its pages, and the names of those that could not be read. */
export interface DrawioFile {
  pages: DrawioPage[]
  unreadable: string[]
}
