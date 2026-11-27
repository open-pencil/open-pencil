//! Component property records as the reader prepares them before layering
//! (`packages/fig/src/document/property-records.ts` and `document/property-inheritance.ts`).

use crate::model::{
    ComponentPropDef, ComponentPropNodeField, ComponentPropRef, NodeChange, VariableDataType,
    VariableField,
};

/// The layer field a component property binds through a parameter map entry for `field`.
fn bound_field(field: &VariableField) -> Option<ComponentPropNodeField> {
    Some(match field {
        VariableField::Visible => ComponentPropNodeField::Visible,
        VariableField::TextData => ComponentPropNodeField::TextData,
        VariableField::OverriddenSymbolId => ComponentPropNodeField::OverriddenSymbolId,
        VariableField::SlotContentId => ComponentPropNodeField::SlotContentId,
        _ => return None,
    })
}

/// Gives a record, and the records inside it, its property references from its parameter map
/// alone: Figma draws nothing from a legacy `componentPropRefs` entry, so they are the map's
/// (`normalizeComponentPropertyRecords`).
pub fn normalize(node: &mut NodeChange) {
    let references: Vec<ComponentPropRef> = node
        .parameter_consumption_map
        .as_deref()
        .and_then(|map| map.entries.as_deref())
        .unwrap_or_default()
        .iter()
        .filter_map(|entry| {
            let data = entry.variable_data.as_deref()?;
            if data.data_type != Some(VariableDataType::PropRef) {
                return None;
            }
            let definition = data
                .value
                .as_deref()?
                .prop_ref_value
                .as_deref()?
                .def_id
                .clone()?;
            Some(ComponentPropRef {
                def_id: Some(definition),
                component_prop_node_field: Some(bound_field(entry.variable_field.as_ref()?)?),
                ..ComponentPropRef::default()
            })
        })
        .collect();
    node.component_prop_refs = (!references.is_empty()).then_some(references);
    for entry in nested(node) {
        normalize(entry);
    }
}

/// A text's ranges, a vector's regions, and an instance's overrides and derived entries: records
/// of their own inside a record.
pub fn nested(node: &mut NodeChange) -> impl Iterator<Item = &mut NodeChange> {
    let ranges = node
        .text_data
        .as_deref_mut()
        .and_then(|text| text.style_override_table.as_mut());
    let regions = node
        .vector_data
        .as_deref_mut()
        .and_then(|vector| vector.style_override_table.as_mut());
    let overrides = node
        .symbol_data
        .as_deref_mut()
        .and_then(|data| data.symbol_overrides.as_mut());
    let derived = node.derived_symbol_data.as_mut();
    [ranges, regions, overrides, derived]
        .into_iter()
        .flatten()
        .flatten()
}

/// Completes a record's definitions that name a parent definition with the fields of the one
/// they copy, taken from the nearest of `ancestors`' definitions (`inheritFromAncestors`).
/// `ancestors` run outward, each already completed.
pub fn inherit(definitions: &mut [ComponentPropDef], ancestors: &[Vec<ComponentPropDef>]) {
    for definition in definitions {
        let Some(parent) = definition.parent_prop_def_id.clone() else {
            continue;
        };
        for candidates in ancestors {
            let mut matches = candidates
                .iter()
                .filter(|candidate| candidate.id.as_ref() == Some(&parent));
            let found = match (matches.next(), matches.next()) {
                (None, _) => continue,
                (Some(found), None) => found,
                // An ambiguous parent names no definition; the reader refuses the file.
                (Some(_), Some(_)) => break,
            };
            let mut completed = found.clone();
            completed.overlay(core::mem::take(definition));
            *definition = completed;
            break;
        }
    }
}
