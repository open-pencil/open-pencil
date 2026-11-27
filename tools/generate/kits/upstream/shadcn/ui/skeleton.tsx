// @ts-nocheck
// Copied by `bun run sources:shadcn` from a project shadcn@4.23.1 set up with Radix primitives, the nova style, the neutral theme, and lucide icons
// (src/components/ui/skeleton.tsx). Copyright (c) 2023 shadcn. MIT License; see LICENSE.md.
// Do not edit: change the pinned CLI or the components in tools/generate/kits and regenerate.
import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
