// @ts-nocheck
// Copied by `bun run generate:mermaid-sources` from mermaid@12.2.0
// (https://raw.githubusercontent.com/mermaid-js/mermaid/1fb7869866dd619168d840291c9c54b4f129758b/packages/mermaid/src/diagram-api/comments.ts)
// Copyright (c) 2014 - 2022 Knut Sveidqvist. MIT License; see MERMAID-LICENSE.txt.
// Do not edit: change the pinned release in tools/generate/mermaid-sources and regenerate.
/**
 * Remove all lines starting with `%%` from the text that don't contain a `%%{`
 * @param text - The text to remove comments from
 * @returns cleaned text
 */
export const cleanupComments = (text: string): string => {
  return text.replace(/^\s*%%(?!{)[^\n]+\n?/gm, '').trimStart();
};
