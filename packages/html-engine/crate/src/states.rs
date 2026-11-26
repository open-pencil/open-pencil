//! The states a static page asks to be shown in, such as `data-force-state="hover focus-visible"`,
//! set on its elements as a browser sets them for a pointer or the keyboard, so the page's own
//! `:hover` or `:focus-visible` rules match as written.

use std::collections::HashMap;

use blitz_dom::{BaseDocument, LocalName};
use blitz_traits::node_id::NodeId;
use style_dom::ElementState;

/// The attribute that names the states an element is shown in.
const ATTRIBUTE: &str = "data-force-state";

/// What each state sets on the element itself, and on every element that contains it.
fn bits(state: &str) -> Option<(ElementState, ElementState)> {
    Some(match state {
        "hover" => (ElementState::HOVER, ElementState::HOVER),
        "active" => (ElementState::ACTIVE, ElementState::ACTIVE),
        "focus" => (
            ElementState::FOCUS | ElementState::FOCUS_WITHIN,
            ElementState::FOCUS_WITHIN,
        ),
        // Focus a browser shows a ring for, as keyboard focus is.
        "focus-visible" => (
            ElementState::FOCUS | ElementState::FOCUSRING | ElementState::FOCUS_WITHIN,
            ElementState::FOCUS_WITHIN,
        ),
        _ => return None,
    })
}

/// The states this module sets, and so recomputes.
const FORCED: ElementState = ElementState::HOVER
    .union(ElementState::ACTIVE)
    .union(ElementState::FOCUS)
    .union(ElementState::FOCUSRING)
    .union(ElementState::FOCUS_WITHIN);

/// Sets on each element the states it and what it holds name, and clears those no element names
/// any more, as after a restyle removes the root's attribute.
pub fn force(doc: &mut BaseDocument) {
    let mut wanted: HashMap<NodeId, ElementState> = HashMap::new();
    let mut elements = Vec::new();
    collect(
        doc,
        doc.root_node().id,
        &mut Vec::new(),
        &mut wanted,
        &mut elements,
    );
    for id in elements {
        let want = wanted.get(&id).copied().unwrap_or_else(ElementState::empty);
        let Some(current) = doc.get_node(id).and_then(|node| node.element_data()) else {
            continue;
        };
        let changed = (current.element_state & FORCED) ^ want;
        if changed.is_empty() {
            continue;
        }
        doc.snapshot_node_and(id, changed, |node| {
            if let Some(data) = node.element_data_mut() {
                data.element_state.remove(FORCED);
                data.element_state.insert(want);
            }
        });
    }
}

fn collect(
    doc: &BaseDocument,
    id: NodeId,
    ancestors: &mut Vec<NodeId>,
    wanted: &mut HashMap<NodeId, ElementState>,
    elements: &mut Vec<NodeId>,
) {
    let Some(node) = doc.get_node(id) else {
        return;
    };
    if node.element_data().is_some() {
        elements.push(id);
    }
    // An attribute's value is a list of tokens split at ASCII whitespace.
    let named = node.attr(LocalName::from(ATTRIBUTE));
    for (own, contained) in named
        .into_iter()
        .flat_map(str::split_ascii_whitespace)
        .filter_map(bits)
    {
        *wanted.entry(id).or_insert_with(ElementState::empty) |= own;
        for &ancestor in ancestors.iter() {
            *wanted.entry(ancestor).or_insert_with(ElementState::empty) |= contained;
        }
    }
    ancestors.push(id);
    for &child in &node.children {
        collect(doc, child, ancestors, wanted, elements);
    }
    ancestors.pop();
}
