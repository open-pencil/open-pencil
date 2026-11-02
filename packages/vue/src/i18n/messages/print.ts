import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Adapting a design to screens, social formats and print products. */
export const printMessageDefaults = {
  section: 'Adapt design',
  toScreens: 'Adapt to screens',
  toScreensHint: 'Mobile, tablet and desktop copies that reflow with auto layout',
  toSocial: 'Social media sizes',
  toSocialHint: 'Instagram, Story, X, LinkedIn and YouTube copies',
  product: 'Print product',
  toDieline: 'Convert to die-cut',
  toDielineHint: 'Print-ready sheet with bleed, safe area, cut and fold lines',
  done: params('Created {count}'),
  failed: params('Could not adapt the design: {error}'),
  productBusinessCardGulf: 'Business card 90×50 mm (Gulf)',
  productBusinessCardEu: 'Business card 85×55 mm (Europe)',
  productBusinessCardUs: 'Business card 3.5×2 in (US)',
  productBusinessCardRounded: 'Business card, rounded corners',
  productFlyerA6: 'Flyer A6',
  productFlyerA5: 'Flyer A5',
  productFlyerA4: 'Flyer A4',
  productFlyerDl: 'Flyer DL',
  productPosterA3: 'Poster A3',
  productPosterA2: 'Poster A2',
  productPosterA1: 'Poster A1',
  productPoster50x70: 'Poster 50×70 cm',
  productBrochureBifoldA4: 'Bi-fold brochure A4',
  productBrochureTrifoldA4: 'Tri-fold brochure A4',
  productGreetingCardA5: 'Folded card A5',
  productDoorHanger: 'Door hanger',
  productStickerCircle: 'Round sticker',
  productStickerRounded: 'Rounded sticker / label',
  productLetterhead: 'Letterhead A4',
  productEnvelopeDl: 'Envelope DL',
  productPresentationFolderA4: 'Presentation folder A4',
  productTuckBox: 'Tuck end box',
  productRollup85x200: 'Roll-up banner 85×200 cm'
} as const

export const printMessages = i18n('print', printMessageDefaults)
