// @ts-nocheck
// Copied by `bun run generate:mermaid-sources` from mermaid@12.2.0
// (https://raw.githubusercontent.com/mermaid-js/mermaid/1fb7869866dd619168d840291c9c54b4f129758b/packages/mermaid/src/preprocess.ts)
// (https://raw.githubusercontent.com/mermaid-js/mermaid/1fb7869866dd619168d840291c9c54b4f129758b/packages/mermaid/src/utils.ts)
// Copyright (c) 2014 - 2022 Knut Sveidqvist. MIT License; see MERMAID-LICENSE.txt.
// Do not edit: change the pinned release in tools/generate/mermaid-sources and regenerate.
import { directiveRegex } from './regexes'

export const cleanupText = (code: string) => {
  return (
    code
      // parser problems on CRLF ignore all CR and leave LF;;
      .replace(/\r\n?/g, '\n')
      // clean up html tags so that all attributes use single quotes, parser throws error on double quotes
      .replace(
        /<(\w+)([^>]*)>/g,
        (match, tag, attributes) => '<' + tag + attributes.replace(/="([^"]*)"/g, "='$1'") + '>'
      )
  );
};

export const removeDirectives = function (text: string): string {
  return text.replace(directiveRegex, '');
};

/**
 * @param  text - text to be encoded
 * @returns
 */
export const encodeEntities = function (text: string): string {
  let txt = text;

  txt = txt.replace(/style.*:\S*#.*;/g, function (s): string {
    return s.substring(0, s.length - 1);
  });
  txt = txt.replace(/classDef.*:\S*#.*;/g, function (s): string {
    return s.substring(0, s.length - 1);
  });

  txt = txt.replace(/#\w+;/g, function (s) {
    const innerTxt = s.substring(1, s.length - 1);

    const isInt = /^\+?\d+$/.test(innerTxt);
    if (isInt) {
      return 'ﬂ°°' + innerTxt + '¶ß';
    } else {
      return 'ﬂ°' + innerTxt + '¶ß';
    }
  });

  return txt;
};

/**
 * Partially reverts encoding done via {@link encodeEntities}
 *
 * @param  text - text to be decoded
 * @returns
 */
export const decodeEntities = function (text: string): string {
  return text.replace(/ﬂ°°/g, '&#').replace(/ﬂ°/g, '&').replace(/¶ß/g, ';');
};
