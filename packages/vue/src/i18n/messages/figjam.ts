import { i18n } from '#vue/i18n/create'

/** FigJam's text sizes, typefaces and board palette, shared by sticky notes and shapes. */
export const figJamMessageDefaults = {
  textSize: 'Text size',
  textSmall: 'Small',
  textMedium: 'Medium',
  textLarge: 'Large',
  textExtraLarge: 'Extra large',
  textHuge: 'Huge',
  typeface: 'Typeface',
  typefaceSimple: 'Simple',
  typefaceBookish: 'Bookish',
  typefaceTechnical: 'Technical',
  typefaceScribbled: 'Scribbled',
  colorBlack: 'Black',
  colorDarkGray: 'Dark gray',
  colorRed: 'Red',
  colorOrange: 'Orange',
  colorYellow: 'Yellow',
  colorGreen: 'Green',
  colorTeal: 'Teal',
  colorBlue: 'Blue',
  colorViolet: 'Violet',
  colorPink: 'Pink',
  colorWhite: 'White',
  colorGray: 'Gray',
  colorLightGray: 'Light gray',
  colorLightRed: 'Light red',
  colorLightOrange: 'Light orange',
  colorLightYellow: 'Light yellow',
  colorLightGreen: 'Light green',
  colorLightTeal: 'Light teal',
  colorLightBlue: 'Light blue',
  colorLightViolet: 'Light violet',
  colorLightPink: 'Light pink'
} as const

export const figJamMessages = i18n('figjam', figJamMessageDefaults)
