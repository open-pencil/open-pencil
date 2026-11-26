//! An index over the message: one fixed-size entry per live record, and pools holding only what
//! instance expansion reads (override paths, swaps, property assignments, definitions, and
//! property references). Every other field stays in the message bytes.

use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};

use crate::kiwi::{Reader, Result, Schema, Span};

/// No record, occurrence, or entry.
pub const NONE: u32 = u32::MAX;
/// Figma's unset GUID is all ones, which also stands for "no GUID" here.
pub const NO_GUID: u64 = u64::MAX;

/// A GUID as Figma writes it, `session:local`.
pub fn guid_string(guid: u64) -> String {
    format!("{}:{}", guid >> 32, guid & u64::from(u32::MAX))
}

/// A multiplicative hash for GUIDs, which are already well spread.
#[derive(Default)]
pub struct GuidHasher(u64);

impl Hasher for GuidHasher {
    fn finish(&self) -> u64 {
        self.0
    }
    fn write(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.write_u64(u64::from(byte));
        }
    }
    fn write_u64(&mut self, value: u64) {
        self.0 = (self.0.rotate_left(5) ^ value).wrapping_mul(0x517c_c1b7_2722_0a95);
    }
    fn write_u32(&mut self, value: u32) {
        self.write_u64(u64::from(value));
    }
}

pub type GuidMap<K, V> = HashMap<K, V, BuildHasherDefault<GuidHasher>>;

/// A run of entries in one of the index's pools.
#[derive(Debug, Clone, Copy, Default)]
pub struct Run {
    pub start: u32,
    pub length: u32,
}

impl Run {
    fn between(start: usize, end: usize) -> Run {
        Run {
            start: start as u32,
            length: (end - start) as u32,
        }
    }

    pub fn range(self) -> core::ops::Range<usize> {
        self.start as usize..(self.start + self.length) as usize
    }

    /// The run without its first entry.
    pub fn tail(self) -> Run {
        Run {
            start: self.start + 1,
            length: self.length - 1,
        }
    }
}

/// A frame the document keeps as slot content, placed only through the instance assigning it.
pub const SLOT_CONTENT: u8 = 1;

/// One live record.
pub struct Record {
    pub guid: u64,
    pub parent: u64,
    /// The key a component's copies address this layer by in overrides.
    pub override_key: u64,
    /// The component an instance places (`symbolData.symbolID`), or `NO_GUID`.
    pub component: u64,
    /// The record's position among its siblings, compared as text.
    pub position: Span,
    /// The record's bytes in the message.
    pub span: Span,
    /// Its `NodeType` value.
    pub ty: u32,
    pub flags: u8,
    pub overrides: Run,
    pub assignments: Run,
    pub definitions: Run,
    pub references: Run,
    pub derived: Run,
    pub children: Run,
}

/// One `symbolOverrides` entry: where it applies and its structural part.
pub struct Override {
    pub path: Run,
    /// The component a swap puts in place, or `NO_GUID`.
    pub swap: u64,
    pub assignments: Run,
    /// Whether it sets any field besides the structural ones: a property layer.
    pub has_properties: bool,
    pub span: Span,
}

/// One `derivedSymbolData` entry: layout Figma saved for a layer inside an instance.
pub struct Derived {
    pub path: Run,
    pub span: Span,
}

/// What a component property value holds, as far as expansion reads it.
#[derive(Debug, Clone, Copy)]
pub struct Value {
    pub boolean: Option<bool>,
    /// A component a swap property names, or `NO_GUID`.
    pub component: u64,
    /// The slot content a slot property names, or `NO_GUID`.
    pub slot: u64,
    /// Whether the value carries text.
    pub has_text: bool,
}

impl Value {
    const EMPTY: Value = Value {
        boolean: None,
        component: NO_GUID,
        slot: NO_GUID,
        has_text: false,
    };

    fn is_set(&self) -> bool {
        self.boolean.is_some() || self.has_text || self.component != NO_GUID
    }

    /// An assignment's variable value as the reader takes it: one kind, a component first, then
    /// a boolean, then text, then slot content (`assignmentValue` in
    /// `packages/fig/src/instance-overrides/bindings/properties.ts`).
    fn one_kind(self) -> Value {
        if self.component != NO_GUID {
            Value {
                component: self.component,
                ..Value::EMPTY
            }
        } else if self.boolean.is_some() {
            Value {
                boolean: self.boolean,
                ..Value::EMPTY
            }
        } else if self.has_text {
            Value {
                has_text: true,
                ..Value::EMPTY
            }
        } else {
            Value {
                slot: self.slot,
                ..Value::EMPTY
            }
        }
    }

    /// A definition's typed default as the reader takes it: a component alone, or every other
    /// kind it holds (`normalizeDefaults` in `packages/fig/src/document/property-records.ts`).
    fn as_default(self) -> Value {
        if self.component != NO_GUID {
            Value {
                component: self.component,
                ..Value::EMPTY
            }
        } else {
            self
        }
    }
}

/// A component property assignment.
pub struct Assignment {
    pub definition: u64,
    pub value: Option<Value>,
}

/// A component property definition.
pub struct Definition {
    pub id: u64,
    /// The ancestor's definition this copies, whose value fills in for a missing one.
    pub parent: u64,
    pub initial: Option<Value>,
}

/// A layer field bound to a component property.
pub struct Reference {
    pub definition: u64,
    /// Its `VariableField` value.
    pub field: u32,
}

/// Definitions, fields, and enum values the index reads, found once in the file's schema.
pub struct Ids {
    message: usize,
    node_changes: usize,
    pub node_change: usize,
    nc_guid: usize,
    nc_parent: usize,
    nc_type: usize,
    nc_phase: usize,
    nc_override_key: usize,
    nc_symbol_data: usize,
    nc_assignments: usize,
    nc_definitions: usize,
    nc_parameters: usize,
    nc_derived: usize,
    nc_guid_path: usize,
    nc_swap: usize,
    nc_slot_content: usize,
    symbol_data: usize,
    sd_symbol: usize,
    sd_overrides: usize,
    guid_path: usize,
    gp_guids: usize,
    assignment: usize,
    cpa_definition: usize,
    cpa_value: usize,
    cpa_variable: usize,
    prop_value: usize,
    cpv_bool: usize,
    cpv_text: usize,
    cpv_guid: usize,
    variable_data: usize,
    vd_value: usize,
    vd_type: usize,
    any_value: usize,
    vav_bool: usize,
    vav_text: usize,
    vav_text_data: usize,
    vav_symbol: usize,
    vav_slot: usize,
    vav_prop_ref: usize,
    symbol_id: usize,
    symbol_id_guid: usize,
    slot_id: usize,
    slot_id_guid: usize,
    prop_ref: usize,
    prv_definition: usize,
    definition: usize,
    cpd_id: usize,
    cpd_initial: usize,
    cpd_parent: usize,
    cpd_variable: usize,
    map: usize,
    map_entries: usize,
    map_entry: usize,
    entry_data: usize,
    entry_field: usize,
    prop_ref_type: u32,
    removed: u32,
    pub instance: u32,
    pub symbol: u32,
    pub canvas: u32,
    variable: u32,
    variable_set: u32,
    pub field_symbol: u32,
    pub field_slot: u32,
}

/// Unwraps what a schema must have, naming what it lacks.
fn needed<T>(value: Option<T>, what: &'static str) -> core::result::Result<T, &'static str> {
    value.ok_or(what)
}

impl Ids {
    /// Every name this reads. A schema without one is not a Figma schema this reader knows.
    pub fn resolve(s: &Schema) -> core::result::Result<Ids, &'static str> {
        let def = |name: &'static str| needed(s.definition(name), name);
        let field =
            |definition: usize, name: &'static str| needed(s.field(Some(definition), name), name);
        let member = |definition: usize, name: &'static str| {
            needed(s.enum_value(Some(definition), name), name)
        };
        let message = def("Message")?;
        let node_change = def("NodeChange")?;
        let symbol_data = def("SymbolData")?;
        let guid_path = def("GUIDPath")?;
        let assignment = def("ComponentPropAssignment")?;
        let prop_value = def("ComponentPropValue")?;
        let variable_data = def("VariableData")?;
        let any_value = def("VariableAnyValue")?;
        let symbol_id = def("SymbolId")?;
        let slot_id = def("SlotContentId")?;
        let prop_ref = def("PropRefValue")?;
        let definition = def("ComponentPropDef")?;
        let map = def("VariableDataMap")?;
        let map_entry = def("VariableDataMapEntry")?;
        let node_type = def("NodeType")?;
        let variable_field = def("VariableField")?;
        Ok(Ids {
            message,
            node_changes: field(message, "nodeChanges")?,
            node_change,
            nc_guid: field(node_change, "guid")?,
            nc_parent: field(node_change, "parentIndex")?,
            nc_type: field(node_change, "type")?,
            nc_phase: field(node_change, "phase")?,
            nc_override_key: field(node_change, "overrideKey")?,
            nc_symbol_data: field(node_change, "symbolData")?,
            nc_assignments: field(node_change, "componentPropAssignments")?,
            nc_definitions: field(node_change, "componentPropDefs")?,
            nc_parameters: field(node_change, "parameterConsumptionMap")?,
            nc_derived: field(node_change, "derivedSymbolData")?,
            nc_guid_path: field(node_change, "guidPath")?,
            nc_swap: field(node_change, "overriddenSymbolID")?,
            nc_slot_content: field(node_change, "isSlotContent")?,
            symbol_data,
            sd_symbol: field(symbol_data, "symbolID")?,
            sd_overrides: field(symbol_data, "symbolOverrides")?,
            guid_path,
            gp_guids: field(guid_path, "guids")?,
            assignment,
            cpa_definition: field(assignment, "defID")?,
            cpa_value: field(assignment, "value")?,
            cpa_variable: field(assignment, "varValue")?,
            prop_value,
            cpv_bool: field(prop_value, "boolValue")?,
            cpv_text: field(prop_value, "textValue")?,
            cpv_guid: field(prop_value, "guidValue")?,
            variable_data,
            vd_value: field(variable_data, "value")?,
            vd_type: field(variable_data, "dataType")?,
            any_value,
            vav_bool: field(any_value, "boolValue")?,
            vav_text: field(any_value, "textValue")?,
            vav_text_data: field(any_value, "textDataValue")?,
            vav_symbol: field(any_value, "symbolIdValue")?,
            vav_slot: field(any_value, "slotContentIdValue")?,
            vav_prop_ref: field(any_value, "propRefValue")?,
            symbol_id,
            symbol_id_guid: field(symbol_id, "guid")?,
            slot_id,
            slot_id_guid: field(slot_id, "guid")?,
            prop_ref,
            prv_definition: field(prop_ref, "defId")?,
            definition,
            cpd_id: field(definition, "id")?,
            cpd_initial: field(definition, "initialValue")?,
            cpd_parent: field(definition, "parentPropDefId")?,
            cpd_variable: field(definition, "varValue")?,
            map,
            map_entries: field(map, "entries")?,
            map_entry,
            entry_data: field(map_entry, "variableData")?,
            entry_field: field(map_entry, "variableField")?,
            prop_ref_type: member(def("VariableDataType")?, "PROP_REF")?,
            removed: member(def("NodePhase")?, "REMOVED")?,
            instance: member(node_type, "INSTANCE")?,
            symbol: member(node_type, "SYMBOL")?,
            canvas: member(node_type, "CANVAS")?,
            variable: member(node_type, "VARIABLE")?,
            variable_set: member(node_type, "VARIABLE_SET")?,
            field_symbol: member(variable_field, "OVERRIDDEN_SYMBOL_ID")?,
            field_slot: member(variable_field, "SLOT_CONTENT_ID")?,
        })
    }
}

pub struct Index {
    pub ids: Ids,
    pub records: Vec<Record>,
    pub by_guid: GuidMap<u64, u32>,
    child_list: Vec<u32>,
    pub overrides: Vec<Override>,
    pub guids: Vec<u64>,
    pub assignments: Vec<Assignment>,
    pub definitions: Vec<Definition>,
    pub references: Vec<Reference>,
    pub derived: Vec<Derived>,
    /// Pages, in their saved order.
    pub pages: Vec<u32>,
    /// Records left out because an earlier record has their GUID.
    pub duplicates: u32,
}

#[derive(Default)]
struct Pools {
    overrides: Vec<Override>,
    guids: Vec<u64>,
    assignments: Vec<Assignment>,
    definitions: Vec<Definition>,
    references: Vec<Reference>,
    derived: Vec<Derived>,
}

impl Pools {
    fn lengths(&self) -> [usize; 6] {
        [
            self.overrides.len(),
            self.guids.len(),
            self.assignments.len(),
            self.definitions.len(),
            self.references.len(),
            self.derived.len(),
        ]
    }

    fn truncate(
        &mut self,
        [
            overrides,
            guids,
            assignments,
            definitions,
            references,
            derived,
        ]: [usize; 6],
    ) {
        self.overrides.truncate(overrides);
        self.guids.truncate(guids);
        self.assignments.truncate(assignments);
        self.definitions.truncate(definitions);
        self.references.truncate(references);
        self.derived.truncate(derived);
    }
}

/// What one record's walk found.
struct Parsed {
    guid: u64,
    parent: u64,
    position: Span,
    override_key: u64,
    component: u64,
    ty: u32,
    removed: bool,
    slot_content: bool,
    overrides: Run,
    assignments: Run,
    definitions: Run,
    references: Run,
    derived: Run,
}

/// Reads the records of one message with the schema's ids.
struct Walk<'a> {
    schema: &'a Schema,
    ids: &'a Ids,
    pools: Pools,
}

impl<'a> Walk<'a> {
    fn guid_path(&mut self, reader: &mut Reader) -> Result<Run> {
        let (s, ids) = (self.schema, self.ids);
        let guids = &mut self.pools.guids;
        let start = guids.len();
        reader.message(s, ids.guid_path, |reader, field| {
            if field != ids.gp_guids {
                return Ok(false);
            }
            reader.array(|reader| {
                guids.push(reader.guid()?);
                Ok(())
            })?;
            Ok(true)
        })?;
        Ok(Run::between(start, guids.len()))
    }

    /// A message holding one GUID field, such as `SymbolId`.
    fn guid_of(&self, reader: &mut Reader, definition: usize, guid_field: usize) -> Result<u64> {
        let mut guid = NO_GUID;
        reader.message(self.schema, definition, |reader, field| {
            if field != guid_field {
                return Ok(false);
            }
            guid = reader.guid()?;
            Ok(true)
        })?;
        Ok(guid)
    }

    fn prop_value(&self, reader: &mut Reader) -> Result<Value> {
        let ids = self.ids;
        let mut value = Value::EMPTY;
        reader.message(self.schema, ids.prop_value, |reader, field| {
            if field == ids.cpv_bool {
                value.boolean = Some(reader.bool()?);
            } else if field == ids.cpv_guid {
                value.component = reader.guid()?;
            } else if field == ids.cpv_text {
                value.has_text = true;
                return Ok(false);
            } else {
                return Ok(false);
            }
            Ok(true)
        })?;
        Ok(value)
    }

    /// Every kind of value a variable-form assignment or default holds.
    fn variable_value(&self, reader: &mut Reader) -> Result<Option<Value>> {
        let ids = self.ids;
        let mut found = Value::EMPTY;
        reader.message(self.schema, ids.variable_data, |reader, field| {
            if field != ids.vd_value {
                return Ok(false);
            }
            reader.message(self.schema, ids.any_value, |reader, field| {
                if field == ids.vav_bool {
                    found.boolean = Some(reader.bool()?);
                } else if field == ids.vav_symbol {
                    found.component = self.guid_of(reader, ids.symbol_id, ids.symbol_id_guid)?;
                } else if field == ids.vav_slot {
                    found.slot = self.guid_of(reader, ids.slot_id, ids.slot_id_guid)?;
                } else if field == ids.vav_text || field == ids.vav_text_data {
                    found.has_text = true;
                    return Ok(false);
                } else {
                    return Ok(false);
                }
                Ok(true)
            })?;
            Ok(true)
        })?;
        let empty = found.boolean.is_none()
            && !found.has_text
            && found.component == NO_GUID
            && found.slot == NO_GUID;
        Ok(if empty { None } else { Some(found) })
    }

    fn assignments(&mut self, reader: &mut Reader) -> Result<Run> {
        let ids = self.ids;
        let start = self.pools.assignments.len();
        reader.array(|reader| {
            let mut definition = NO_GUID;
            let mut direct: Option<Value> = None;
            let mut variable: Option<Value> = None;
            reader.message(self.schema, ids.assignment, |reader, field| {
                if field == ids.cpa_definition {
                    definition = reader.guid()?;
                } else if field == ids.cpa_value {
                    direct = Some(self.prop_value(reader)?);
                } else if field == ids.cpa_variable {
                    variable = self.variable_value(reader)?.map(Value::one_kind);
                } else {
                    return Ok(false);
                }
                Ok(true)
            })?;
            let value = direct.filter(Value::is_set).or(variable);
            self.pools
                .assignments
                .push(Assignment { definition, value });
            Ok(())
        })?;
        Ok(Run::between(start, self.pools.assignments.len()))
    }

    fn definitions(&mut self, reader: &mut Reader) -> Result<Run> {
        let ids = self.ids;
        let start = self.pools.definitions.len();
        reader.array(|reader| {
            let mut definition = Definition {
                id: NO_GUID,
                parent: NO_GUID,
                initial: None,
            };
            let mut variable: Option<Value> = None;
            reader.message(self.schema, ids.definition, |reader, field| {
                if field == ids.cpd_id {
                    definition.id = reader.guid()?;
                } else if field == ids.cpd_initial {
                    definition.initial = Some(self.prop_value(reader)?);
                } else if field == ids.cpd_parent {
                    definition.parent = reader.guid()?;
                } else if field == ids.cpd_variable {
                    variable = self.variable_value(reader)?.map(Value::as_default);
                } else {
                    return Ok(false);
                }
                Ok(true)
            })?;
            // A typed default stands in where the definition has no plain one.
            definition.initial = definition.initial.or(variable);
            self.pools.definitions.push(definition);
            Ok(())
        })?;
        Ok(Run::between(start, self.pools.definitions.len()))
    }

    /// The property references in a parameter map; a layer binds to component properties through
    /// this map alone.
    fn references(&mut self, reader: &mut Reader) -> Result<Run> {
        let (s, ids) = (self.schema, self.ids);
        let start = self.pools.references.len();
        reader.message(s, ids.map, |reader, field| {
            if field != ids.map_entries {
                return Ok(false);
            }
            reader.array(|reader| {
                let mut reference = Reference {
                    definition: NO_GUID,
                    field: NONE,
                };
                let mut is_prop_ref = false;
                reader.message(s, ids.map_entry, |reader, field| {
                    if field == ids.entry_field {
                        reference.field = reader.varuint()?;
                    } else if field == ids.entry_data {
                        reader.message(s, ids.variable_data, |reader, field| {
                            if field == ids.vd_type {
                                is_prop_ref = reader.varuint()? == ids.prop_ref_type;
                            } else if field == ids.vd_value {
                                reader.message(s, ids.any_value, |reader, field| {
                                    if field != ids.vav_prop_ref {
                                        return Ok(false);
                                    }
                                    reference.definition =
                                        self.guid_of(reader, ids.prop_ref, ids.prv_definition)?;
                                    Ok(true)
                                })?;
                            } else {
                                return Ok(false);
                            }
                            Ok(true)
                        })?;
                    } else {
                        return Ok(false);
                    }
                    Ok(true)
                })?;
                if is_prop_ref && reference.definition != NO_GUID {
                    self.pools.references.push(reference);
                }
                Ok(())
            })?;
            Ok(true)
        })?;
        Ok(Run::between(start, self.pools.references.len()))
    }

    /// An entry of `symbolOverrides` or `derivedSymbolData`: its path, its structural fields,
    /// and whether it sets anything else.
    fn override_entry(&mut self, reader: &mut Reader) -> Result<Override> {
        let ids = self.ids;
        let start = reader.position;
        let mut entry = Override {
            path: Run::default(),
            swap: NO_GUID,
            assignments: Run::default(),
            has_properties: false,
            span: Span::default(),
        };
        reader.message(self.schema, ids.node_change, |reader, field| {
            if field == ids.nc_guid_path {
                entry.path = self.guid_path(reader)?;
            } else if field == ids.nc_swap {
                entry.swap = reader.guid()?;
            } else if field == ids.nc_assignments {
                entry.assignments = self.assignments(reader)?;
            } else {
                entry.has_properties = true;
                return Ok(false);
            }
            Ok(true)
        })?;
        entry.span = Span {
            start: start as u32,
            length: (reader.position - start) as u32,
        };
        Ok(entry)
    }

    fn record(&mut self, reader: &mut Reader) -> Result<Parsed> {
        let ids = self.ids;
        let mut out = Parsed {
            guid: NO_GUID,
            parent: NO_GUID,
            position: Span::default(),
            override_key: NO_GUID,
            component: NO_GUID,
            ty: NONE,
            removed: false,
            slot_content: false,
            overrides: Run::default(),
            assignments: Run::default(),
            definitions: Run::default(),
            references: Run::default(),
            derived: Run::default(),
        };
        reader.message(self.schema, ids.node_change, |reader, field| {
            if field == ids.nc_guid {
                out.guid = reader.guid()?;
            } else if field == ids.nc_parent {
                // ParentIndex { guid, position }
                out.parent = reader.guid()?;
                out.position = reader.span()?;
            } else if field == ids.nc_type {
                out.ty = reader.varuint()?;
            } else if field == ids.nc_phase {
                out.removed = reader.varuint()? == ids.removed;
            } else if field == ids.nc_override_key {
                out.override_key = reader.guid()?;
            } else if field == ids.nc_slot_content {
                out.slot_content = reader.bool()?;
            } else if field == ids.nc_symbol_data {
                reader.message(self.schema, ids.symbol_data, |reader, field| {
                    if field == ids.sd_symbol {
                        out.component = reader.guid()?;
                    } else if field == ids.sd_overrides {
                        let mut entries = Vec::new();
                        reader.array(|reader| {
                            entries.push(self.override_entry(reader)?);
                            Ok(())
                        })?;
                        let start = self.pools.overrides.len();
                        self.pools.overrides.extend(entries);
                        out.overrides = Run::between(start, self.pools.overrides.len());
                    } else {
                        return Ok(false);
                    }
                    Ok(true)
                })?;
            } else if field == ids.nc_assignments {
                out.assignments = self.assignments(reader)?;
            } else if field == ids.nc_definitions {
                out.definitions = self.definitions(reader)?;
            } else if field == ids.nc_parameters {
                out.references = self.references(reader)?;
            } else if field == ids.nc_derived {
                let mut entries = Vec::new();
                reader.array(|reader| {
                    let entry = self.override_entry(reader)?;
                    entries.push(Derived {
                        path: entry.path,
                        span: entry.span,
                    });
                    Ok(())
                })?;
                let start = self.pools.derived.len();
                self.pools.derived.extend(entries);
                out.derived = Run::between(start, self.pools.derived.len());
            } else {
                return Ok(false);
            }
            Ok(true)
        })?;
        Ok(out)
    }
}

/// Whether a record is its own ancestor, which would make expanding it endless.
fn has_parent_cycle(records: &[Record], by_guid: &GuidMap<u64, u32>) -> bool {
    // 0 not seen, 1 on the chain being walked, 2 known to reach a root.
    let mut state = vec![0u8; records.len()];
    let mut chain: Vec<u32> = Vec::new();
    for start in 0..records.len() as u32 {
        let mut at = Some(start);
        while let Some(record) = at {
            match state[record as usize] {
                1 => return true,
                2 => break,
                _ => {}
            }
            state[record as usize] = 1;
            chain.push(record);
            at = by_guid.get(&records[record as usize].parent).copied();
        }
        for record in chain.drain(..) {
            state[record as usize] = 2;
        }
    }
    false
}

impl Index {
    pub fn build(schema: &Schema, message: &[u8]) -> crate::Result<Index> {
        let ids = Ids::resolve(schema).map_err(crate::Error::Schema)?;
        let mut walk = Walk {
            schema,
            ids: &ids,
            pools: Pools::default(),
        };
        let mut records: Vec<Record> = Vec::new();
        let mut by_guid: GuidMap<u64, u32> = GuidMap::default();
        let mut duplicates = 0;
        let mut reader = Reader::new(message);
        reader
            .message(schema, ids.message, |reader, field| {
                if field != ids.node_changes {
                    return Ok(false);
                }
                reader.array(|reader| {
                    let start = reader.position;
                    let pooled = walk.pools.lengths();
                    let parsed = walk.record(reader)?;
                    // A record left out keeps nothing in the pools.
                    if parsed.removed || parsed.guid == NO_GUID {
                        walk.pools.truncate(pooled);
                        return Ok(());
                    }
                    if by_guid.contains_key(&parsed.guid) {
                        walk.pools.truncate(pooled);
                        duplicates += 1;
                        return Ok(());
                    }
                    by_guid.insert(parsed.guid, records.len() as u32);
                    records.push(Record {
                        guid: parsed.guid,
                        parent: parsed.parent,
                        override_key: parsed.override_key,
                        component: parsed.component,
                        position: parsed.position,
                        span: Span {
                            start: start as u32,
                            length: (reader.position - start) as u32,
                        },
                        ty: parsed.ty,
                        flags: if parsed.slot_content { SLOT_CONTENT } else { 0 },
                        overrides: parsed.overrides,
                        assignments: parsed.assignments,
                        definitions: parsed.definitions,
                        references: parsed.references,
                        derived: parsed.derived,
                        children: Run::default(),
                    });
                    Ok(())
                })?;
                Ok(true)
            })
            .map_err(|_| crate::Error::Message)?;
        let pools = walk.pools;
        let position =
            |records: &[Record], record: u32| &message[records[record as usize].position.range()];

        // Children in saved order: positions compared as text, ties in record order. Variables
        // and their collections are resources, not layers.
        let mut links: Vec<(u32, u32)> = Vec::with_capacity(records.len());
        for (index, record) in records.iter().enumerate() {
            if record.ty == ids.variable || record.ty == ids.variable_set {
                continue;
            }
            if let Some(&parent) = by_guid.get(&record.parent) {
                links.push((parent, index as u32));
            }
        }
        links.sort_by(|a, b| {
            a.0.cmp(&b.0)
                .then_with(|| position(&records, a.1).cmp(position(&records, b.1)))
                .then(a.1.cmp(&b.1))
        });
        let child_list: Vec<u32> = links.iter().map(|link| link.1).collect();
        let mut at = 0;
        while at < links.len() {
            let start = at;
            while at < links.len() && links[at].0 == links[start].0 {
                at += 1;
            }
            records[links[start].0 as usize].children = Run::between(start, at);
        }
        if has_parent_cycle(&records, &by_guid) {
            return Err(crate::Error::ParentCycle);
        }

        let mut pages: Vec<u32> = (0..records.len() as u32)
            .filter(|&record| records[record as usize].ty == ids.canvas)
            .collect();
        pages.sort_by(|&a, &b| {
            position(&records, a)
                .cmp(position(&records, b))
                .then(a.cmp(&b))
        });

        let mut index = Index {
            ids,
            records,
            by_guid,
            child_list,
            overrides: pools.overrides,
            guids: pools.guids,
            assignments: pools.assignments,
            definitions: pools.definitions,
            references: pools.references,
            derived: pools.derived,
            pages,
            duplicates,
        };
        index.inherit_definition_values();
        Ok(index)
    }

    /// A definition that copies an ancestor's takes that one's value where it has none.
    fn inherit_definition_values(&mut self) {
        let mut inherited: Vec<(usize, Value)> = Vec::new();
        for record in &self.records {
            for at in record.definitions.range() {
                let definition = &self.definitions[at];
                if definition.initial.is_some() || definition.parent == NO_GUID {
                    continue;
                }
                let mut wanted = definition.parent;
                let mut ancestor = self.find(record.parent);
                // Ancestry can loop in a damaged file; no real document nests this deep.
                let mut steps = 0;
                while let Some(holder) = ancestor {
                    steps += 1;
                    if steps > 10_000 {
                        break;
                    }
                    let holder = &self.records[holder as usize];
                    let found = self.definitions[holder.definitions.range()]
                        .iter()
                        .find(|candidate| candidate.id == wanted);
                    if let Some(found) = found {
                        if let Some(value) = found.initial {
                            inherited.push((at, value));
                            break;
                        }
                        if found.parent == NO_GUID {
                            break;
                        }
                        wanted = found.parent;
                    }
                    ancestor = self.find(holder.parent);
                }
            }
        }
        for (at, value) in inherited {
            self.definitions[at].initial = Some(value);
        }
    }

    pub fn children(&self, record: u32) -> &[u32] {
        &self.child_list[self.records[record as usize].children.range()]
    }

    pub fn find(&self, guid: u64) -> Option<u32> {
        if guid == NO_GUID {
            None
        } else {
            self.by_guid.get(&guid).copied()
        }
    }
}
