// @ts-nocheck
// Copied by `bun run sources:shadcn` from a project shadcn@4.23.1 set up with Radix primitives, the nova style, the neutral theme, and lucide icons
// (src/components/ui/progress.tsx). Copyright (c) 2023 shadcn. MIT License; see LICENSE.md.
// Do not edit: change the pinned CLI or the components in tools/generate/kits and regenerate.
"use client"

import * as React from "react"
import { cn } from "cn"
import { Progress as ProgressPrimitive } from "radix-ui"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
