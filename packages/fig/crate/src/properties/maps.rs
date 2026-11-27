//! Variable maps merged layer by layer rather than replaced
//! (`packages/fig/src/node-change/variable/bindings.ts` and `variable/maps.ts`).

use crate::model::{
    GUID, NodeChange, VariableDataMap, VariableDataMapEntry, VariableField, VariableModeBySetMap,
    VariableModeBySetMapEntry,
};

fn entries(map: Option<&VariableDataMap>) -> &[VariableDataMapEntry] {
    map.and_then(|map| map.entries.as_deref())
        .unwrap_or_default()
}

/// The field a binding binds, or `None` for one the file's schema does not name.
fn field_of(entry: &VariableDataMapEntry) -> Option<&VariableField> {
    entry
        .variable_field
        .as_ref()
        .filter(|field| !matches!(field, VariableField::Unlisted(name) if name.is_empty()))
}

/// A layer's variable bindings: its legacy map's entries, then its parameter map's, one per
/// bound field, the later winning in the earlier one's place (`variableConsumptionEntries`).
pub fn consumption(node: &NodeChange) -> Vec<&VariableDataMapEntry> {
    let mut unkeyed = Vec::new();
    let mut keyed: Vec<(&VariableField, &VariableDataMapEntry)> = Vec::new();
    let all = entries(node.variable_consumption_map.as_deref())
        .iter()
        .chain(entries(node.parameter_consumption_map.as_deref()));
    for entry in all {
        match field_of(entry) {
            Some(field) => match keyed.iter_mut().find(|(key, _)| *key == field) {
                Some((_, existing)) => *existing = entry,
                None => keyed.push((field, entry)),
            },
            None => unkeyed.push(entry),
        }
    }
    unkeyed.extend(keyed.into_iter().map(|(_, entry)| entry));
    unkeyed
}

/// The parameter map a layer leaves on what it lands on: the bindings below it with its own
/// over them, field by field, or `None` when it binds nothing (`mergeVariableConsumptionMaps`).
pub fn merge_consumption(base: &NodeChange, patch: &NodeChange) -> Option<VariableDataMap> {
    let incoming = consumption(patch);
    if incoming.is_empty() {
        return None;
    }
    let mut merged: Vec<VariableDataMapEntry> = Vec::new();
    for entry in consumption(base).into_iter().chain(incoming) {
        let existing = field_of(entry).and_then(|field| {
            merged
                .iter()
                .position(|previous| field_of(previous) == Some(field))
        });
        match existing {
            Some(at) => merged[at] = entry.clone(),
            None => merged.push(entry.clone()),
        }
    }
    Some(VariableDataMap {
        entries: Some(merged),
    })
}

/// The mode map a claim leaves: the modes below it with its own over them per collection, a
/// claim without a mode clearing its collection, and entries naming no local collection kept
/// after the rest (`mergeVariableModeMaps`).
pub fn merge_modes(base: &NodeChange, patch: &NodeChange) -> Option<VariableModeBySetMap> {
    let incoming = patch.variable_mode_by_set_map.as_deref()?;
    let listed = |map: Option<&VariableModeBySetMap>| {
        map.and_then(|map| map.entries.clone()).unwrap_or_default()
    };
    let mut unresolved: Vec<VariableModeBySetMapEntry> = Vec::new();
    let mut by_collection: Vec<(GUID, VariableModeBySetMapEntry)> = Vec::new();
    let all = listed(base.variable_mode_by_set_map.as_deref())
        .into_iter()
        .chain(listed(Some(incoming)));
    for entry in all {
        let Some(collection) = entry
            .variable_set_id
            .as_ref()
            .and_then(|set| set.guid.clone())
        else {
            unresolved.push(entry);
            continue;
        };
        let at = by_collection.iter().position(|(key, _)| *key == collection);
        match (at, entry.variable_mode_id.is_some()) {
            (Some(at), true) => by_collection[at].1 = entry,
            (None, true) => by_collection.push((collection, entry)),
            (Some(at), false) => _ = by_collection.remove(at),
            (None, false) => {}
        }
    }
    let mut merged: Vec<VariableModeBySetMapEntry> =
        by_collection.into_iter().map(|(_, entry)| entry).collect();
    merged.extend(unresolved);
    Some(VariableModeBySetMap {
        entries: Some(merged),
    })
}
