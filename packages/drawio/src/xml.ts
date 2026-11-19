import { DOMParser, type Element } from '@xmldom/xmldom'

/** The root element of `source`, or null when it is not well-formed XML. */
export function parseXML(source: string): Element | null {
  try {
    const parsed = new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') throw new Error(message)
      }
    }).parseFromString(source, 'text/xml')
    return parsed.documentElement
  } catch {
    return null
  }
}

/** The element children of `element`, named `name` when given. */
export function childElements(element: Element, name?: string): Element[] {
  const found: Element[] = []
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === node.ELEMENT_NODE && (!name || (node as Element).localName === name)) {
      found.push(node as Element)
    }
  }
  return found
}

/** All of an element's attributes but those in `except`. */
export function attributesOf(
  element: Element,
  except: ReadonlySet<string>
): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const attribute of Array.from(element.attributes)) {
    if (!except.has(attribute.name)) attributes[attribute.name] = attribute.value
  }
  return attributes
}
