// @ts-nocheck
// Copied by `bun run sources:shadcn` from a project shadcn@4.23.1 set up with Radix primitives, the nova style, the neutral theme, and lucide icons
// (src/components/ui/label.tsx). Copyright (c) 2023 shadcn. MIT License; see LICENSE.md.
// Do not edit: change the pinned CLI or the components in tools/generate/kits and regenerate.
import * as React from "react"
import { cn } from "cn"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
