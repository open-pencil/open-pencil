//! The states a static page asks to be shown in, such as `data-force-state="hover focus-visible"`,
//! set on its elements as a browser sets them for a pointer or the keyboard, so the page's own
//! `:hover` or `:focus-visible` rules match as written.

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

/// Sets the states each element names on it and on what contains it.
pub fn force(doc: &mut BaseDocument) {
    let mut forced = Vec::new();
    collect(doc, doc.root_node().id, &mut Vec::new(), &mut forced);
    for (id, state) in forced {
        doc.snapshot_node_and(id, state, |node| {
            if let Some(data) = node.element_data_mut() {
                data.element_state.insert(state);
            }
        });
    }
}

fn collect(
    doc: &BaseDocument,
    id: NodeId,
    ancestors: &mut Vec<NodeId>,
    forced: &mut Vec<(NodeId, ElementState)>,
) {
    let Some(node) = doc.get_node(id) else {
        return;
    };
    // An attribute's value is a list of tokens split at ASCII whitespace.
    let named = node.attr(LocalName::from(ATTRIBUTE));
    for (own, contained) in named
        .into_iter()
        .flat_map(str::split_ascii_whitespace)
        .filter_map(bits)
    {
        forced.push((id, own));
        forced.extend(ancestors.iter().map(|&ancestor| (ancestor, contained)));
    }
    ancestors.push(id);
    for &child in &node.children {
        collect(doc, child, ancestors, forced);
    }
    ancestors.pop();
}
