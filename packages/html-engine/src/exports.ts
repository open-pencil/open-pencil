/**
 * The module's exports: strings and bytes cross as (pointer, length), and results land in one
 * output buffer whose length the call returns. The build keeps these and its memory, and removes
 * every other export with the code only it reaches (`scripts/wasm.ts`).
 */
export const EXPORTS = [
  'alloc',
  'dealloc',
  'output_ptr',
  'fonts_reset',
  'font_decode',
  'font_add',
  'font_generic',
  'open',
  'pump',
  'provide',
  'fail',
  'restyle',
  'capture'
] as const
