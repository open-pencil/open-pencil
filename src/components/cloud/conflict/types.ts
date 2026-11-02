export type ConflictChoice = 'keep-both' | 'use-cloud' | 'use-mine'

/** One side of a conflict; `by` is unknown for the server's side, which records no author. */
export type ConflictVersion = { previewURL?: string | null; savedAgo: string; by?: string }
