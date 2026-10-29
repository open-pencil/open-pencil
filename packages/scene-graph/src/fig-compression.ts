/**
 * How tightly a document's `.fig` data is compressed when it is written: `fast` matches Figma's
 * own saves, `smaller` and `smallest` trade save time for size. Figma opens all three.
 */
export const FIG_COMPRESSIONS = ['fast', 'smaller', 'smallest'] as const

export type FigCompression = (typeof FIG_COMPRESSIONS)[number]

export const DEFAULT_FIG_COMPRESSION: FigCompression = 'fast'
