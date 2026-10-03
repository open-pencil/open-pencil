// Headless only: `./stylesheet` loads this module lazily where the browser's parser is missing.
import { parse } from '@acemir/cssom'

import { createTokenValidator } from './validate'

export const tokenValidator = createTokenValidator(parse)
