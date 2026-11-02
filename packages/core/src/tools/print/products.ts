import { circlePath, dieLine, rect, roundedRectPath, type DieLine, type Piece } from './geometry'

/** Box and custom-size dimensions, in millimetres. */
export interface PrintSize {
  width?: number
  height?: number
  /** Box depth (front to back). */
  depth?: number
  /** Corner radius for rounded cards, stickers and labels. */
  radius?: number
}

export type PrintCategory =
  | 'business-card'
  | 'flyer'
  | 'poster'
  | 'brochure'
  | 'card'
  | 'sticker'
  | 'stationery'
  | 'packaging'
  | 'large-format'

export interface PrintProduct {
  category: PrintCategory
  label: string
  /** Default size in mm; overridable through PrintSize where `sizes` lists the field. */
  defaults: Required<Pick<PrintSize, 'width' | 'height'>> & PrintSize
  sizes: readonly (keyof PrintSize)[]
  /** Extra artwork beyond the cut, in mm. */
  bleed: number
  /** Keep text and logos this far inside the cut, in mm. */
  safe: number
  /** Where a converted design goes: across the whole sheet, or on the front panel only. */
  artwork: 'sheet' | 'front'
  build: (size: Required<PrintSize>) => DieLine
}

function flat(width: number, height: number): DieLine {
  return dieLine([rect('front', 0, 0, width, height)])
}

function rounded(width: number, height: number, radius: number): DieLine {
  return {
    width,
    height,
    cuts: [roundedRectPath(0, 0, width, height, radius)],
    creases: [],
    panels: [{ name: 'front', x: 0, y: 0, width, height }]
  }
}

function panelsAcross(
  names: readonly string[],
  widths: readonly number[],
  height: number
): DieLine {
  let x = 0
  const pieces = names.map((name, i) => {
    const piece = rect(name, x, 0, widths[i], height)
    x += widths[i]
    return piece
  })
  return dieLine(pieces)
}

/**
 * Reverse tuck end carton, the common retail box. Panels run glue · back · side · front · side;
 * the top lid hinges on the back, the bottom lid on the front, dust flaps on the sides.
 */
export function tuckEndBox(length: number, width: number, depth: number): DieLine {
  const glue = Math.min(15, width * 0.8)
  const tuck = Math.min(15, width * 0.6)
  const dust = width * 0.75
  const xGlue = 0
  const xBack = glue
  const xSide1 = xBack + length
  const xFront = xSide1 + width
  const xSide2 = xFront + length
  const top = width + tuck // room above the body for the lid and its tuck
  const y0 = top
  const y1 = top + depth
  const pieces: Piece[] = [
    // Tapered glue flap on the far side of the back panel.
    {
      name: 'glue',
      points: [
        [xBack, y0],
        [xBack, y1],
        [xGlue, y1 - 5],
        [xGlue, y0 + 5]
      ]
    },
    rect('back', xBack, y0, length, depth),
    rect('side', xSide1, y0, width, depth),
    rect('front', xFront, y0, length, depth),
    rect('side-2', xSide2, y0, width, depth),
    // Top lid on the back panel, with its tapered tuck.
    rect('top-lid', xBack, y0 - width, length, width),
    {
      name: 'top-tuck',
      points: [
        [xBack, y0 - width],
        [xBack + length, y0 - width],
        [xBack + length - 4, y0 - width - tuck],
        [xBack + 4, y0 - width - tuck]
      ]
    },
    // Top dust flaps on both sides.
    {
      // Tapered away from the lid beside it, so the two are cut apart, not folded together.
      name: 'top-dust',
      points: [
        [xSide1, y0],
        [xSide1 + width, y0],
        [xSide1 + width, y0 - dust],
        [xSide1 + 3, y0 - dust]
      ]
    },
    {
      name: 'top-dust-2',
      points: [
        [xSide2, y0],
        [xSide2 + width, y0],
        [xSide2 + width - 3, y0 - dust],
        [xSide2, y0 - dust]
      ]
    },
    // Bottom lid on the front panel (reverse tuck), with its tuck.
    rect('bottom-lid', xFront, y1, length, width),
    {
      name: 'bottom-tuck',
      points: [
        [xFront, y1 + width],
        [xFront + length, y1 + width],
        [xFront + length - 4, y1 + width + tuck],
        [xFront + 4, y1 + width + tuck]
      ]
    },
    {
      name: 'bottom-dust',
      points: [
        [xSide1, y1],
        [xSide1 + width, y1],
        [xSide1 + width - 3, y1 + dust],
        [xSide1, y1 + dust]
      ]
    },
    {
      name: 'bottom-dust-2',
      points: [
        [xSide2, y1],
        [xSide2 + width, y1],
        [xSide2 + width, y1 + dust],
        [xSide2 + 3, y1 + dust]
      ]
    }
  ]
  return dieLine(pieces, [], ['back', 'side', 'front', 'side-2', 'top-lid', 'bottom-lid'])
}

/** DL-style envelope: the body with a top seal flap, two side flaps and a bottom flap. */
export function envelope(width: number, height: number): DieLine {
  const side = Math.min(20, width * 0.12)
  const flap = height * 0.45
  const bottom = height * 0.6
  const pieces: Piece[] = [
    rect('front', side, flap, width, height),
    {
      name: 'seal-flap',
      points: [
        [side, flap],
        [side + 15, 0],
        [side + width - 15, 0],
        [side + width, flap]
      ]
    },
    {
      name: 'side-flap',
      points: [
        [side, flap],
        [side, flap + height],
        [0, flap + height - 10],
        [0, flap + 10]
      ]
    },
    {
      name: 'side-flap-2',
      points: [
        [side + width, flap],
        [side + width + side, flap + 10],
        [side + width + side, flap + height - 10],
        [side + width, flap + height]
      ]
    },
    {
      name: 'bottom-flap',
      points: [
        [side, flap + height],
        [side + width, flap + height],
        [side + width - 10, flap + height + bottom],
        [side + 10, flap + height + bottom]
      ]
    }
  ]
  return dieLine(pieces, [], ['front'])
}

/** Door hanger: a tall card with a round hole and a slit to slip over the handle. */
export function doorHanger(width: number, height: number): DieLine {
  const r = Math.min(18, width * 0.22)
  const cx = width / 2
  const cy = r + 16
  return {
    width,
    height,
    cuts: [
      roundedRectPath(0, 0, width, height, 6),
      circlePath(cx, cy, r),
      `M${cx} ${cy - r} L${cx} 0`
    ],
    creases: [],
    panels: [{ name: 'front', x: 0, y: 0, width, height }]
  }
}

/** A4 presentation folder: two covers with a glued pocket flap folding up onto the inside. */
export function presentationFolder(width: number, height: number): DieLine {
  const pocket = 100
  const pieces: Piece[] = [
    rect('back', 0, 0, width, height),
    rect('front', width, 0, width, height),
    {
      name: 'pocket',
      points: [
        [0, height],
        [width * 2, height],
        [width * 2 - 15, height + pocket],
        [15, height + pocket]
      ]
    }
  ]
  return dieLine(pieces, [], ['back', 'front'])
}

export const PRINT_PRODUCTS = {
  'business-card-gulf': {
    category: 'business-card',
    label: 'Business card 90×50 mm (Gulf & Middle East)',
    defaults: { width: 90, height: 50 },
    sizes: [],
    bleed: 3,
    safe: 4,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'business-card-eu': {
    category: 'business-card',
    label: 'Business card 85×55 mm (Europe)',
    defaults: { width: 85, height: 55 },
    sizes: [],
    bleed: 3,
    safe: 4,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'business-card-us': {
    category: 'business-card',
    label: 'Business card 3.5×2 in (US)',
    defaults: { width: 88.9, height: 50.8 },
    sizes: [],
    bleed: 3,
    safe: 4,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'business-card-rounded': {
    category: 'business-card',
    label: 'Business card 90×50 mm, rounded corners (die-cut)',
    defaults: { width: 90, height: 50, radius: 4 },
    sizes: ['radius'],
    bleed: 3,
    safe: 4,
    artwork: 'sheet',
    build: (s) => rounded(s.width, s.height, s.radius)
  },
  'flyer-a6': {
    category: 'flyer',
    label: 'Flyer A6 105×148 mm',
    defaults: { width: 105, height: 148 },
    sizes: [],
    bleed: 3,
    safe: 5,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'flyer-a5': {
    category: 'flyer',
    label: 'Flyer A5 148×210 mm',
    defaults: { width: 148, height: 210 },
    sizes: [],
    bleed: 3,
    safe: 5,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'flyer-a4': {
    category: 'flyer',
    label: 'Flyer A4 210×297 mm',
    defaults: { width: 210, height: 297 },
    sizes: [],
    bleed: 3,
    safe: 5,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'flyer-dl': {
    category: 'flyer',
    label: 'Flyer DL 99×210 mm',
    defaults: { width: 99, height: 210 },
    sizes: [],
    bleed: 3,
    safe: 5,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'poster-a3': {
    category: 'poster',
    label: 'Poster A3 297×420 mm',
    defaults: { width: 297, height: 420 },
    sizes: [],
    bleed: 3,
    safe: 10,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'poster-a2': {
    category: 'poster',
    label: 'Poster A2 420×594 mm',
    defaults: { width: 420, height: 594 },
    sizes: [],
    bleed: 3,
    safe: 10,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'poster-a1': {
    category: 'poster',
    label: 'Poster A1 594×841 mm',
    defaults: { width: 594, height: 841 },
    sizes: [],
    bleed: 3,
    safe: 15,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'poster-50x70': {
    category: 'poster',
    label: 'Poster 50×70 cm',
    defaults: { width: 500, height: 700 },
    sizes: [],
    bleed: 3,
    safe: 15,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'brochure-bifold-a4': {
    category: 'brochure',
    label: 'Bi-fold brochure A4 → A5 (open 297×210 mm)',
    defaults: { width: 297, height: 210 },
    sizes: [],
    bleed: 3,
    safe: 5,
    artwork: 'sheet',
    build: (s) => panelsAcross(['back', 'front'], [s.width / 2, s.width / 2], s.height)
  },
  'brochure-trifold-a4': {
    category: 'brochure',
    label: 'Tri-fold brochure A4 → DL (open 297×210 mm, roll fold)',
    defaults: { width: 297, height: 210 },
    sizes: [],
    bleed: 3,
    safe: 5,
    artwork: 'sheet',
    // The panel folding in is 2 mm narrower so it tucks without buckling.
    build: (s) =>
      panelsAcross(
        ['inside-flap', 'back', 'front'],
        [s.width / 3 - 2, s.width / 3 + 1, s.width / 3 + 1],
        s.height
      )
  },
  'greeting-card-a5': {
    category: 'card',
    label: 'Folded card A5 → A6 (open 210×148 mm)',
    defaults: { width: 210, height: 148 },
    sizes: [],
    bleed: 3,
    safe: 5,
    artwork: 'sheet',
    build: (s) => panelsAcross(['back', 'front'], [s.width / 2, s.width / 2], s.height)
  },
  'door-hanger': {
    category: 'card',
    label: 'Door hanger 90×250 mm (die-cut hole)',
    defaults: { width: 90, height: 250 },
    sizes: ['width', 'height'],
    bleed: 3,
    safe: 5,
    artwork: 'sheet',
    build: (s) => doorHanger(s.width, s.height)
  },
  'sticker-circle': {
    category: 'sticker',
    label: 'Round sticker (die-cut), 50 mm',
    defaults: { width: 50, height: 50 },
    sizes: ['width'],
    bleed: 2,
    safe: 3,
    artwork: 'sheet',
    build: (s) => rounded(s.width, s.width, s.width / 2)
  },
  'sticker-rounded': {
    category: 'sticker',
    label: 'Rounded-rectangle sticker / label (die-cut)',
    defaults: { width: 80, height: 50, radius: 5 },
    sizes: ['width', 'height', 'radius'],
    bleed: 2,
    safe: 3,
    artwork: 'sheet',
    build: (s) => rounded(s.width, s.height, s.radius)
  },
  letterhead: {
    category: 'stationery',
    label: 'Letterhead A4 210×297 mm',
    defaults: { width: 210, height: 297 },
    sizes: [],
    bleed: 3,
    safe: 10,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  },
  'envelope-dl': {
    category: 'stationery',
    label: 'Envelope DL 220×110 mm (die-line with flaps)',
    defaults: { width: 220, height: 110 },
    sizes: ['width', 'height'],
    bleed: 3,
    safe: 5,
    artwork: 'front',
    build: (s) => envelope(s.width, s.height)
  },
  'presentation-folder-a4': {
    category: 'stationery',
    label: 'Presentation folder for A4 (with pocket)',
    defaults: { width: 220, height: 310 },
    sizes: [],
    bleed: 3,
    safe: 5,
    artwork: 'front',
    build: (s) => presentationFolder(s.width, s.height)
  },
  'tuck-box': {
    category: 'packaging',
    label: 'Reverse tuck end box (length × width × depth)',
    defaults: { width: 60, height: 100, depth: 30 },
    sizes: ['width', 'height', 'depth'],
    bleed: 3,
    safe: 3,
    artwork: 'front',
    // width = front panel width (length), depth = side panel width, height = box height.
    build: (s) => tuckEndBox(s.width, s.depth, s.height)
  },
  'rollup-85x200': {
    category: 'large-format',
    label: 'Roll-up banner 85×200 cm',
    defaults: { width: 850, height: 2000 },
    sizes: [],
    bleed: 5,
    safe: 30,
    artwork: 'sheet',
    build: (s) => flat(s.width, s.height)
  }
} as const satisfies Record<string, PrintProduct>

export type PrintProductId = keyof typeof PRINT_PRODUCTS
export const PRINT_PRODUCT_IDS = Object.keys(PRINT_PRODUCTS) as [
  PrintProductId,
  ...PrintProductId[]
]

/** The product's die-line at its default size with any allowed overrides. */
export function buildPrintProduct(id: PrintProductId, size: PrintSize = {}): DieLine {
  const product: PrintProduct = PRINT_PRODUCTS[id]
  const merged: Required<PrintSize> = {
    width: product.defaults.width,
    height: product.defaults.height,
    depth: product.defaults.depth ?? 0,
    radius: product.defaults.radius ?? 0
  }
  for (const field of product.sizes) {
    const value = size[field]
    if (value !== undefined) {
      if (!(value > 0)) throw new Error(`${field} must be a positive number of millimetres`)
      merged[field] = value
    }
  }
  return product.build(merged)
}
