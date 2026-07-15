export type ComponentUI<Theme extends { slots: Record<string, unknown> }> = Partial<{
  [Slot in keyof Theme['slots']]: string
}>
