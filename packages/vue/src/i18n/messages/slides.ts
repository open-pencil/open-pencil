import { params } from '@nanostores/i18n'

/** A deck's filmstrip and the views of its slides. */
export const slideMessageDefaults = {
  slides: 'Slides',
  newSlide: 'New slide',
  noSlides: 'No slides yet',
  slideNumber: params('Slide {number}'),
  skippedSlide: 'Skipped slide',
  slideView: 'Slide view',
  gridView: 'Grid view',
  duplicate: 'Duplicate',
  skip: 'Skip slide',
  unskip: 'Include slide',
  moveToNewSection: 'Move to new section',
  delete: 'Delete',
  collapseSection: 'Collapse section',
  expandSection: 'Expand section',
  notes: 'Speaker notes',
  notesPlaceholder: 'Add speaker notes',
  notesPickSlide: 'Select one slide to see its speaker notes',
  slideSize: 'Slide size',
  sizeWide: '16:9',
  sizeStandard: '4:3',
  sizeSquare: 'Square',
  sizePortrait: 'Portrait',
  sizeCustom: 'Custom',
  scaleContent: 'Scale content'
} as const
