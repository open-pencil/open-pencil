//! Component property records as the reader prepares them before layering
//! (`normalizeComponentPropertyRecords` in `packages/fig/src/document/property-records.ts`).

use crate::kiwi::Value;

/// The layer fields a component property can bind.
const BOUND_FIELDS: &[&str] = &[
    "VISIBLE",
    "TEXT_DATA",
    "OVERRIDDEN_SYMBOL_ID",
    "SLOT_CONTENT_ID",
];

/// Gives a record, or an override or style entry inside it, its property references from its
/// parameter map alone, and each definition a plain default from its typed one. Figma draws
/// nothing from a legacy `componentPropRefs` entry, so the references are the map's.
pub fn normalize(node: &mut Value) {
    if let Some(Value::Array(definitions)) = node.get_mut("componentPropDefs") {
        for definition in definitions {
            if definition.get("initialValue").is_some() {
                continue;
            }
            let Some(value) = definition
                .get("varValue")
                .and_then(|typed| typed.get("value"))
            else {
                continue;
            };
            let initial = match value.get("symbolIdValue").and_then(|id| id.get("guid")) {
                Some(guid) => Value::Fields(vec![("guidValue", guid.clone())]),
                None => value.clone(),
            };
            definition.set("initialValue", initial);
        }
    }
    let mut references = Vec::new();
    if let Some(Value::Array(entries)) = node
        .get("parameterConsumptionMap")
        .and_then(|map| map.get("entries"))
    {
        for entry in entries {
            let data = entry.get("variableData");
            let is_reference = data
                .and_then(|data| data.get("dataType"))
                .and_then(Value::as_str)
                == Some("PROP_REF");
            let definition = data
                .and_then(|data| data.get("value"))
                .and_then(|value| value.get("propRefValue"))
                .and_then(|reference| reference.get("defId"));
            let field = entry.get("variableField");
            let bound = field
                .and_then(Value::as_str)
                .is_some_and(|field| BOUND_FIELDS.contains(&field));
            if let (true, Some(definition), Some(field), true) =
                (is_reference, definition, field, bound)
            {
                references.push(Value::Fields(vec![
                    ("defID", definition.clone()),
                    ("componentPropNodeField", field.clone()),
                ]));
            }
        }
    }
    if let Value::Fields(fields) = node {
        fields.retain(|(name, _)| *name != "componentPropRefs");
    }
    if !references.is_empty() {
        node.set("componentPropRefs", Value::Array(references));
    }
    // A text's ranges, a vector's regions, and an instance's overrides are records of their own.
    let nested: [(&str, &str); 4] = [
        ("textData", "styleOverrideTable"),
        ("vectorData", "styleOverrideTable"),
        ("symbolData", "symbolOverrides"),
        ("", "derivedSymbolData"),
    ];
    for (outer, list) in nested {
        let holder = if outer.is_empty() {
            Some(&mut *node)
        } else {
            node.get_mut(outer)
        };
        if let Some(Value::Array(entries)) = holder.and_then(|holder| holder.get_mut(list)) {
            entries.iter_mut().for_each(normalize);
        }
    }
}

/// Completes a record's definitions that name a parent definition with the fields of the one
/// they copy, taken from the nearest of `ancestors`' definitions (`inheritFromAncestors` in
/// `document/property-inheritance.ts`). `ancestors` run outward, each already completed.
pub fn inherit<'a>(definitions: &mut Value<'a>, ancestors: &[Value<'a>]) {
    let Value::Array(definitions) = definitions else {
        return;
    };
    for definition in definitions {
        let Some(parent) = definition.get("parentPropDefId").cloned() else {
            continue;
        };
        for ancestor in ancestors {
            let Value::Array(candidates) = ancestor else {
                continue;
            };
            let mut matches = candidates
                .iter()
                .filter(|candidate| candidate.get("id") == Some(&parent));
            let found = match (matches.next(), matches.next()) {
                (None, _) => continue,
                (Some(found), None) => found,
                // An ambiguous parent names no definition; the reader refuses the file.
                (Some(_), Some(_)) => break,
            };
            let mut completed = found.clone();
            if let Value::Fields(own) = definition {
                for (name, value) in own.drain(..) {
                    completed.set(name, value);
                }
            }
            *definition = completed;
            break;
        }
    }
}
