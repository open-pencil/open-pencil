import * as v from 'valibot'

import { PRINT_PRODUCT_IDS } from './products'

export const printProductInputSchema = v.pipe(
  v.picklist(PRINT_PRODUCT_IDS),
  v.description('Print product id from list_print_products, e.g. business-card-gulf, tuck-box')
)

const mm = (what: string) =>
  v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(5000), v.description(`${what}, in mm`)))

export const printSizeInputSchema = v.optional(
  v.pipe(
    v.strictObject({
      width: mm('Width (box: front panel width)'),
      height: mm('Height (box: box height)'),
      depth: mm('Box depth (side panel width)'),
      radius: mm('Corner radius')
    }),
    v.description('Custom dimensions for products that allow them (see list_print_products)')
  )
)
