// Generated from bootstrap@5.3.9 `scss/_variables.scss`: its colors, the 100 to 900 shades it
// mixes from each with white and black (`tint-color`, `shade-color`), and its spacers.

/** The Bootstrap release these values come from. */
export const BOOTSTRAP_VERSION = '5.3.9'

/** The shades every color has, lightest first; 500 is the color itself. */
export const BOOTSTRAP_SHADES = [
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900'
] as const

/** Each color's shades as hex, in the order of {@link BOOTSTRAP_SHADES}. */
export const BOOTSTRAP_PALETTES: Record<string, readonly string[]> = {
  blue: [
    '#CFE2FF',
    '#9EC5FE',
    '#6EA8FE',
    '#3D8BFD',
    '#0D6EFD',
    '#0A58CA',
    '#084298',
    '#052C65',
    '#031633'
  ],
  indigo: [
    '#E0CFFC',
    '#C29FFA',
    '#A370F7',
    '#8540F5',
    '#6610F2',
    '#520DC2',
    '#3D0A91',
    '#290661',
    '#140330'
  ],
  purple: [
    '#E2D9F3',
    '#C5B3E6',
    '#A98EDA',
    '#8C68CD',
    '#6F42C1',
    '#59359A',
    '#432874',
    '#2C1A4D',
    '#160D27'
  ],
  pink: [
    '#F7D6E6',
    '#EFADCE',
    '#E685B5',
    '#DE5C9D',
    '#D63384',
    '#AB296A',
    '#801F4F',
    '#561435',
    '#2B0A1A'
  ],
  red: [
    '#F8D7DA',
    '#F1AEB5',
    '#EA868F',
    '#E35D6A',
    '#DC3545',
    '#B02A37',
    '#842029',
    '#58151C',
    '#2C0B0E'
  ],
  orange: [
    '#FFE5D0',
    '#FECBA1',
    '#FEB272',
    '#FD9843',
    '#FD7E14',
    '#CA6510',
    '#984C0C',
    '#653208',
    '#331904'
  ],
  yellow: [
    '#FFF3CD',
    '#FFE69C',
    '#FFDA6A',
    '#FFCD39',
    '#FFC107',
    '#CC9A06',
    '#997404',
    '#664D03',
    '#332701'
  ],
  green: [
    '#D1E7DD',
    '#A3CFBB',
    '#75B798',
    '#479F76',
    '#198754',
    '#146C43',
    '#0F5132',
    '#0A3622',
    '#051B11'
  ],
  teal: [
    '#D2F4EA',
    '#A6E9D5',
    '#79DFC1',
    '#4DD4AC',
    '#20C997',
    '#1AA179',
    '#13795B',
    '#0D503C',
    '#06281E'
  ],
  cyan: [
    '#CFF4FC',
    '#9EEAF9',
    '#6EDFF6',
    '#3DD5F3',
    '#0DCAF0',
    '#0AA2C0',
    '#087990',
    '#055160',
    '#032830'
  ],
  gray: [
    '#F8F9FA',
    '#E9ECEF',
    '#DEE2E6',
    '#CED4DA',
    '#ADB5BD',
    '#6C757D',
    '#495057',
    '#343A40',
    '#212529'
  ]
}

/** The theme colors, each the palette and shade it is in Bootstrap. */
export const BOOTSTRAP_THEME_COLORS: Record<string, readonly [string, string]> = {
  primary: ['blue', '500'],
  secondary: ['gray', '600'],
  success: ['green', '500'],
  info: ['cyan', '500'],
  warning: ['yellow', '500'],
  danger: ['red', '500'],
  light: ['gray', '100'],
  dark: ['gray', '900']
}

/** `$spacers`, each a multiple of `$spacer`, 1rem. */
export const BOOTSTRAP_SPACERS: Record<string, number> = {
  0: 0,
  1: 0.25,
  2: 0.5,
  3: 1,
  4: 1.5,
  5: 3
}
