/**
 * GitHub refuses a release whose notes are longer, in characters. Both the changelog check and the
 * release's notes hold sections to it.
 */
export const RELEASE_NOTES_LIMIT = 125_000
