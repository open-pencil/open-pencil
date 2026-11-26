//! References to library variables, collections, and styles, which name a record by its key and
//! version rather than its GUID. The reader gives each the GUID of the record it names
//! (`document/bindings/references.ts` and `document/resource-reference.ts` in `packages/fig/src/`),
//! and looks styles up the same way (`node-change/style/lookup.ts`).

use std::collections::HashMap;

use crate::index::Index;
use crate::kiwi::Value;

/// The fields a record names a style in (`STYLE_REFERENCE_FIELDS`).
pub const STYLE_REFERENCE_FIELDS: &[&str] = &[
    "styleIdForFill",
    "styleIdForStrokeFill",
    "styleIdForText",
    "styleIdForEffect",
    "styleIdForGrid",
];

/// An effect's fields that bind its properties to variables (`EFFECT_VARIABLE_FIELDS`).
const EFFECT_VARIABLE_FIELDS: &[&str] = &["colorVar", "radiusVar", "spreadVar", "xVar", "yVar"];

/// How deeply a variable expression may nest (`MAX_EXPRESSION_DEPTH`).
const MAX_EXPRESSION_DEPTH: u32 = 64;

/// A key's records by version (empty for none): one record, or `None` where two share a version.
type Versions<'a> = Vec<(&'a [u8], Option<u32>)>;

/// The records a file publishes under a library key.
pub struct Assets<'a> {
    /// Records by key, then by version; the reader refuses a version two records share.
    versions: HashMap<&'a [u8], Versions<'a>>,
    /// The last record with each key, and each key and version, as styles are looked up.
    by_key: HashMap<&'a [u8], u32>,
    by_key_version: HashMap<(&'a [u8], &'a [u8]), u32>,
}

impl<'a> Assets<'a> {
    pub fn new(index: &Index, message: &'a [u8]) -> Assets<'a> {
        let mut assets = Assets {
            versions: HashMap::new(),
            by_key: HashMap::new(),
            by_key_version: HashMap::new(),
        };
        for (at, record) in index.records.iter().enumerate() {
            let Some(key) = record.key else {
                continue;
            };
            let at = at as u32;
            let key = &message[key.range()];
            let version = record.version.map(|version| &message[version.range()]);
            let versions = assets.versions.entry(key).or_default();
            let exact = version.unwrap_or_default();
            match versions.iter_mut().find(|(known, _)| *known == exact) {
                Some((_, found)) if *found != Some(at) => *found = None,
                Some(_) => {}
                None => versions.push((exact, Some(at))),
            }
            assets.by_key.insert(key, at);
            if let Some(version) = version {
                assets.by_key_version.insert((key, version), at);
            }
        }
        assets
    }

    /// The record an asset reference names, for a binding (`createResourceResolver`): its exact
    /// version, else the one without a version, else the only one.
    fn resolve(&self, asset: &Value) -> Option<u32> {
        let versions = self.versions.get(text(asset.get("key")?)?)?;
        let version = asset.get("version").and_then(text).unwrap_or_default();
        let find = |wanted: &[u8]| {
            versions
                .iter()
                .find(|(known, _)| *known == wanted)
                .and_then(|(_, record)| *record)
        };
        if !version.is_empty() {
            return find(version);
        }
        let only = match versions.as_slice() {
            [(_, record)] => *record,
            _ => None,
        };
        find(b"").or(only)
    }

    /// The record a style reference names by key (`referencedStyle`): its exact version, else the
    /// last record with its key.
    pub fn style(&self, asset: &Value) -> Option<u32> {
        let key = text(asset.get("key")?)?;
        let version = asset
            .get("version")
            .and_then(text)
            .filter(|version| !version.is_empty());
        version
            .and_then(|version| self.by_key_version.get(&(key, version)))
            .or_else(|| self.by_key.get(key))
            .copied()
    }
}

fn text<'v>(value: &'v Value) -> Option<&'v [u8]> {
    match value {
        Value::String(text) => Some(text.as_bytes()),
        _ => None,
    }
}

/// A `GUID` value.
pub fn guid_value<'a>(guid: u64) -> Value<'a> {
    Value::Fields(vec![
        ("sessionID", Value::Uint((guid >> 32) as u32)),
        ("localID", Value::Uint(guid as u32)),
    ])
}

/// Gives every library reference a record holds, in its own fields and in its text's ranges, its
/// vector's regions, and its overrides, the GUID of the record it names, where the file has it.
pub fn resolve<'a>(node: &mut Value<'a>, assets: &Assets, index: &Index) {
    let mut give = |reference: &mut Value<'a>| {
        if reference.get("guid").is_some() {
            return;
        }
        let Some(record) = reference
            .get("assetRef")
            .and_then(|asset| assets.resolve(asset))
        else {
            return;
        };
        reference.set("guid", guid_value(index.records[record as usize].guid));
    };
    for at in visible_bindings(node) {
        if let Some(data) = binding_at(node, at).and_then(|entry| entry.get_mut("variableData")) {
            visit_aliases(data, &mut give, 0);
        }
    }
    for paints in ["fillPaints", "strokePaints"] {
        if let Some(Value::Array(paints)) = node.get_mut(paints) {
            for paint in paints {
                if let Some(alias) = alias_of(paint.get_mut("colorVar")) {
                    give(alias);
                }
            }
        }
    }
    if let Some(Value::Array(effects)) = node.get_mut("effects") {
        for effect in effects {
            for field in EFFECT_VARIABLE_FIELDS {
                if let Some(alias) = alias_of(effect.get_mut(field)) {
                    give(alias);
                }
            }
        }
    }
    if let Some(Value::Array(entries)) = node
        .get_mut("variableModeBySetMap")
        .and_then(|map| map.get_mut("entries"))
    {
        for entry in entries {
            if let Some(set) = entry.get_mut("variableSetID") {
                give(set);
            }
        }
    }
    for field in STYLE_REFERENCE_FIELDS {
        if let Some(reference) = node.get_mut(field) {
            give(reference);
        }
    }
    for entry in nested(node) {
        resolve(entry, assets, index);
    }
}

/// A text's ranges, a vector's regions, and an instance's overrides and derived entries: records
/// of their own inside a record.
pub fn nested<'v, 'a>(node: &'v mut Value<'a>) -> impl Iterator<Item = &'v mut Value<'a>> {
    let mut lists: Vec<&'v mut Vec<Value<'a>>> = Vec::new();
    if let Value::Fields(fields) = node {
        for (name, value) in fields.iter_mut() {
            let list = match (*name, value) {
                ("textData" | "vectorData", holder) => holder.get_mut("styleOverrideTable"),
                ("symbolData", holder) => holder.get_mut("symbolOverrides"),
                ("derivedSymbolData", list) => Some(list),
                _ => None,
            };
            if let Some(Value::Array(list)) = list {
                lists.push(list);
            }
        }
    }
    lists.into_iter().flatten()
}

fn alias_of<'v, 'a>(typed: Option<&'v mut Value<'a>>) -> Option<&'v mut Value<'a>> {
    typed?.get_mut("value")?.get_mut("alias")
}

/// The aliases of a variable binding, its own and those of an expression's arguments.
fn visit_aliases<'a>(data: &mut Value<'a>, give: &mut impl FnMut(&mut Value<'a>), depth: u32) {
    if depth > MAX_EXPRESSION_DEPTH {
        return;
    }
    let Some(value) = data.get_mut("value") else {
        return;
    };
    if let Some(alias) = value.get_mut("alias") {
        give(alias);
    }
    if let Some(Value::Array(arguments)) = value
        .get_mut("expressionValue")
        .and_then(|expression| expression.get_mut("expressionArguments"))
    {
        for argument in arguments {
            visit_aliases(argument, give, depth + 1);
        }
    }
}

/// Where a binding sits: in the legacy map or the parameter map, and at which entry.
#[derive(Clone, Copy)]
struct BindingAt {
    parameters: bool,
    entry: usize,
}

const MAPS: [(&str, bool); 2] = [
    ("variableConsumptionMap", false),
    ("parameterConsumptionMap", true),
];

fn binding_at<'v, 'a>(node: &'v mut Value<'a>, at: BindingAt) -> Option<&'v mut Value<'a>> {
    let map = if at.parameters {
        "parameterConsumptionMap"
    } else {
        "variableConsumptionMap"
    };
    match node.get_mut(map)?.get_mut("entries")? {
        Value::Array(entries) => entries.get_mut(at.entry),
        _ => None,
    }
}

/// The bindings a record shows: each of its legacy map's and parameter map's entries, except one
/// a later entry for the same field replaces (`variableConsumptionEntries`).
fn visible_bindings(node: &Value) -> Vec<BindingAt> {
    let mut unkeyed = Vec::new();
    let mut keyed: Vec<(&Value, BindingAt)> = Vec::new();
    for (map, parameters) in MAPS {
        let Some(Value::Array(entries)) = node.get(map).and_then(|map| map.get("entries")) else {
            continue;
        };
        for (entry, value) in entries.iter().enumerate() {
            let at = BindingAt { parameters, entry };
            match value
                .get("variableField")
                .filter(|field| field.as_str().is_some())
            {
                Some(field) => match keyed.iter_mut().find(|(key, _)| *key == field) {
                    Some((_, existing)) => *existing = at,
                    None => keyed.push((field, at)),
                },
                None => unkeyed.push(at),
            }
        }
    }
    unkeyed.extend(keyed.into_iter().map(|(_, at)| at));
    unkeyed
}
