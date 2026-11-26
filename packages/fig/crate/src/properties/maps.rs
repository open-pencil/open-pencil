//! Variable maps merged layer by layer rather than replaced
//! (`packages/fig/src/node-change/variable/bindings.ts` and `variable/maps.ts`).

use crate::kiwi::Value;

fn entries<'v, 'a>(node: &'v Value<'a>, map: &str) -> &'v [Value<'a>] {
    match node.get(map).and_then(|map| map.get("entries")) {
        Some(Value::Array(entries)) => entries,
        _ => &[],
    }
}

/// A layer's variable bindings: its legacy map's entries, then its parameter map's, one per
/// bound field, the later winning in the earlier one's place (`variableConsumptionEntries`).
pub(super) fn consumption<'v, 'a>(node: &'v Value<'a>) -> Vec<&'v Value<'a>> {
    let mut unkeyed = Vec::new();
    let mut keyed: Vec<(&Value, &Value)> = Vec::new();
    let all = entries(node, "variableConsumptionMap")
        .iter()
        .chain(entries(node, "parameterConsumptionMap"));
    for entry in all {
        match entry
            .get("variableField")
            .filter(|field| field.as_str().is_some())
        {
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
pub fn merge_consumption<'a>(base: &Value<'a>, patch: &Value<'a>) -> Option<Value<'a>> {
    let incoming = consumption(patch);
    if incoming.is_empty() {
        return None;
    }
    let mut merged: Vec<Value<'a>> = Vec::new();
    for entry in consumption(base).into_iter().chain(incoming) {
        let field = entry
            .get("variableField")
            .filter(|field| field.as_str().is_some());
        let existing = field.and_then(|field| {
            merged
                .iter()
                .position(|previous| previous.get("variableField") == Some(field))
        });
        match existing {
            Some(at) => merged[at] = entry.clone(),
            None => merged.push(entry.clone()),
        }
    }
    Some(Value::Fields(vec![("entries", Value::Array(merged))]))
}

/// The mode map a claim leaves: the modes below it with its own over them per collection, a
/// claim without a mode clearing its collection, and entries naming no local collection kept
/// after the rest (`mergeVariableModeMaps`).
pub fn merge_modes<'a>(base: &Value<'a>, patch: &Value<'a>) -> Option<Value<'a>> {
    patch.get("variableModeBySetMap")?;
    let mut unresolved: Vec<Value<'a>> = Vec::new();
    let mut by_collection: Vec<(Value<'a>, Value<'a>)> = Vec::new();
    let all = entries(base, "variableModeBySetMap")
        .iter()
        .chain(entries(patch, "variableModeBySetMap"));
    for entry in all {
        let Some(collection) = entry
            .get("variableSetID")
            .and_then(|set| set.get("guid"))
            .cloned()
        else {
            unresolved.push(entry.clone());
            continue;
        };
        let at = by_collection.iter().position(|(key, _)| *key == collection);
        match (at, entry.get("variableModeID").is_some()) {
            (Some(at), true) => by_collection[at].1 = entry.clone(),
            (None, true) => by_collection.push((collection, entry.clone())),
            (Some(at), false) => _ = by_collection.remove(at),
            (None, false) => {}
        }
    }
    let mut merged: Vec<Value<'a>> = by_collection.into_iter().map(|(_, entry)| entry).collect();
    merged.extend(unresolved);
    Some(Value::Fields(vec![("entries", Value::Array(merged))]))
}
