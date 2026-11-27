import { buildKit } from '@open-pencil/kit-tools'
import { SHADCN_KIT } from '@open-pencil/kit-tools/shadcn'
await Bun.write(
  '/private/tmp/claude-501/-Users-dannote-Development-open-pencil-app/3ed1c2f3-cee0-4f77-94a3-4afb795664b0/scratchpad/shadcn-kit.fig',
  await buildKit(SHADCN_KIT)
)
