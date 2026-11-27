//! A page's instances expanded into occurrences, following
//! `packages/fig/src/instance-overrides/interpret.ts`: an instance expands its component's
//! subtree, swaps and property assignments are routed down to the instance they configure before
//! it expands, and property layers and saved derived data are placed onto the built subtree
//! afterwards. An occurrence refers to its source record and is never a copy of it: what owners
//! do to it is kept as steps, each naming the entry whose fields it applies, which stay in the
//! message until [`crate::properties`] reads them.

use crate::index::{GuidMap, Index, NO_GUID, NONE, Run, SLOT_CONTENT, STATE_GROUP, Value};
use crate::kiwi::Span;

/// The occurrence expanded a component.
pub const INSTANCE: u32 = 1;
/// The occurrence's component is missing or would contain itself, so it has no children.
pub const DANGLING: u32 = 2;
/// The occurrence placed slot content.
pub const SLOT: u32 = 4;
/// A swap replaced the component the instance record names.
pub const SWAPPED: u32 = 8;

/// One layer of the expanded page.
#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct Occurrence {
    /// The record it places.
    pub record: u32,
    pub parent: u32,
    pub first_child: u32,
    pub last_child: u32,
    pub next_sibling: u32,
    pub flags: u32,
    /// The component record it expanded, or `NONE`.
    pub component: u32,
    /// The GUID of the component it expands once bindings and swaps chose it, also where the
    /// file lacks that component, or `NO_GUID`.
    pub expands: u64,
    /// One past the last occurrence below it.
    pub end: u32,
}

/// The entry whose fields a layer applies.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    /// A record: the one the occurrence places, or a component it expanded.
    Record(u32),
    /// A property layer, by its index into the index's overrides.
    Override(u32),
    /// Saved derived data, by its index into the index's derived entries.
    Derived(u32),
    /// The values the occurrence's component properties bind, by index into `bound`.
    Bound(u32),
    /// The name a swapped instance takes from its replacement: the variant set's, by its
    /// record, or with `NONE` the name the replacement already gave it.
    DefaultName(u32),
    /// An instance's complete assignment list: its record's, then those its owners address to
    /// it, by index into `assignment_lists`.
    Assignments(u32),
}

/// Leaves out a component's identity and how it sits in its parent, which an instance of it
/// does not take (`UNINHERITED_COMPONENT_FIELDS` in `instance-overrides/fields.ts`).
pub const INHERITED: u8 = 1;
/// Leaves out the paint of a component a swap replaced.
pub const SWAPPED_PAINT: u8 = 2;
/// Only the distances a uniform scale multiplies, which an instance record keeps placed.
pub const SCALED: u8 = 4;
/// Only the size the file keeps for an instance.
pub const SIZE: u8 = 8;
/// Only an instance's variable modes, which it claims on its own root as an owner claims a
/// layer's fields (`ownLayers` in `instance-overrides/layers.ts`).
pub const MODES: u8 = 16;

/// An entry's fields applied to an occurrence.
#[derive(Debug, Clone, Copy)]
pub struct Layer {
    pub target: u32,
    /// The record the target stands for where the layer lands: a component it expanded, while
    /// that component's own layers apply, else its own.
    pub record: u32,
    /// The depth of the owner that applied it: deeper owners are inner ones.
    pub rank: u32,
    pub source: Source,
    /// Which of the entry's fields apply: every one, or those the flags above keep.
    pub only: u8,
}

/// What owners do to the expanded page, in the order they do it.
#[derive(Debug, Clone, Copy)]
pub enum Step {
    Layer(Layer),
    /// An instance placed at a uniform scale multiplies the distances of everything it expanded.
    Scale {
        owner: u32,
        factor: f64,
    },
    /// An instance placed at another size than its component moves and resizes its layers by
    /// their constraints, from the component's size to the size its record keeps.
    Resize {
        owner: u32,
        record: u32,
    },
}

/// Values an occurrence takes from the component properties its record binds, each with the rank
/// of the owner whose assignment set it, or `NONE` for a definition's default.
#[derive(Debug, Clone, Copy, Default)]
pub struct Bound {
    pub visible: Option<(bool, u32)>,
    /// The characters, as the span of their bytes in the message.
    pub text: Option<(Span, u32)>,
}

/// What the expansion could not resolve.
#[derive(Debug, Default, Clone, Copy)]
pub struct Unresolved {
    /// Property layers whose path names no single occurrence.
    pub properties: u32,
    /// Derived entries whose path names no single occurrence.
    pub derived: u32,
    /// Swaps and assignments whose path names no single record.
    pub structural: u32,
    /// Instances left out because their component would contain itself.
    pub loops: u32,
    pub missing_components: u32,
    /// Swaps addressed to a layer that is not an instance.
    pub swaps_on_non_instances: u32,
}

/// A swap or assignment, addressed relative to the expansion that receives it.
#[derive(Clone, Copy)]
struct Structural {
    rank: u32,
    owner: u32,
    path: Run,
    swap: u64,
    assignments: Run,
    /// The entry that holds the assignments.
    entry: Source,
}

#[derive(Clone, Copy)]
struct Binding {
    definition: u64,
    value: Value,
    /// The rank of the owner whose assignment set it; `NONE` for a default.
    rank: u32,
}

/// A component being expanded, for the loop rule.
struct Entered {
    component: u64,
    rank: u32,
    chosen_at: u32,
}

struct Group {
    assignments: Run,
    rank: u32,
    owner: u32,
    /// The entry that holds the assignments.
    entry: Source,
}

pub struct Expansion<'a> {
    index: &'a Index,
    /// The page expanded, whose slot content frames are not its layers; `NONE` for a component
    /// or an instance.
    page: u32,
    pub occurrences: Vec<Occurrence>,
    pub steps: Vec<Step>,
    pub bound: Vec<Bound>,
    /// The entries whose `componentPropAssignments` make up an instance's assignment list, in
    /// order: `Source::Record` or `Source::Override`.
    pub assignment_lists: Vec<Vec<Source>>,
    pub unresolved: Unresolved,
    entered: Vec<Entered>,
}

impl<'a> Expansion<'a> {
    /// The index the expansion's records belong to.
    pub fn index(&self) -> &'a Index {
        self.index
    }

    /// Expands a page: its layers, leaving out the slot content frames kept on it.
    pub fn page(index: &'a Index, page: u32) -> Expansion<'a> {
        Expansion::from(index, page, page)
    }

    /// Expands a component or an instance on its own, as the reader's `interpretComponent` and
    /// `interpretInstance` do.
    pub fn record(index: &'a Index, record: u32) -> Expansion<'a> {
        Expansion::from(index, record, NONE)
    }

    fn from(index: &'a Index, root: u32, page: u32) -> Expansion<'a> {
        let mut expansion = Expansion {
            index,
            page,
            occurrences: Vec::new(),
            steps: Vec::new(),
            bound: Vec::new(),
            assignment_lists: Vec::new(),
            unresolved: Unresolved::default(),
            entered: Vec::new(),
        };
        expansion.expand(root, &[], Vec::new(), 0, None, NONE, None);
        expansion
    }

    fn layer(&mut self, target: u32, record: u32, rank: u32, source: Source, only: u8) {
        self.steps.push(Step::Layer(Layer {
            target,
            record,
            rank,
            source,
            only,
        }));
    }

    fn push(&mut self, record: u32, parent: u32) -> u32 {
        let at = self.occurrences.len() as u32;
        self.occurrences.push(Occurrence {
            record,
            parent,
            first_child: NONE,
            last_child: NONE,
            next_sibling: NONE,
            flags: 0,
            component: NONE,
            expands: NO_GUID,
            end: 0,
        });
        if parent != NONE {
            let last = self.occurrences[parent as usize].last_child;
            if last == NONE {
                self.occurrences[parent as usize].first_child = at;
            } else {
                self.occurrences[last as usize].next_sibling = at;
            }
            self.occurrences[parent as usize].last_child = at;
        }
        at
    }

    /// A component and its override key both address the root of an instance's expansion.
    fn component_keys(&self, guid: u64, keys: &mut Vec<u64>) {
        if guid == NO_GUID {
            return;
        }
        if !keys.contains(&guid) {
            keys.push(guid);
        }
        if let Some(component) = self.index.find(guid) {
            let key = self.index.records[component as usize].override_key;
            if key != NO_GUID && !keys.contains(&key) {
                keys.push(key);
            }
        }
    }

    /// The override key of the component an instance finally expands, following components that
    /// are themselves instances: the reader's `mainComponentOverrideKey`, which also addresses the
    /// root.
    fn final_override_key(&self, component: u64) -> Option<u64> {
        let mut record = self.index.find(component)?;
        // A chain of instances ends at a component; a damaged one may loop.
        for _ in 0..64 {
            let current = &self.index.records[record as usize];
            if current.ty != self.index.ids.instance {
                break;
            }
            match self.index.find(current.component) {
                Some(inner) => record = inner,
                None => break,
            }
        }
        let key = self.index.records[record as usize].override_key;
        (key != NO_GUID).then_some(key)
    }

    /// Whether expanding `component`, chosen by the owner at `chosen_at`, would put it inside
    /// itself: it is being expanded already, and nothing chosen since came from further out.
    fn closes_loop(&self, component: u64, chosen_at: u32) -> bool {
        let Some(at) = self
            .entered
            .iter()
            .rposition(|entry| entry.component == component)
        else {
            return false;
        };
        let rank = self.entered[at].rank;
        chosen_at >= rank
            && self.entered[at + 1..]
                .iter()
                .all(|later| later.chosen_at >= rank)
    }

    /// Expands one record. Returns false for an instance left out because its component would
    /// contain itself. With `merge`, the record is a component standing in as an instance's
    /// base, whose children become that occurrence's children.
    #[allow(clippy::too_many_arguments)]
    fn expand(
        &mut self,
        record: u32,
        bindings: &[Binding],
        layers: Vec<Structural>,
        rank: u32,
        chosen_at: Option<u32>,
        parent: u32,
        merge: Option<u32>,
    ) -> bool {
        let index = self.index;
        let r = &index.records[record as usize];
        let ids = &index.ids;

        // The component and slot content the enclosing scope's properties bind.
        let mut component = r.component;
        let mut component_chosen_at: Option<u32> = None;
        let mut slot = NO_GUID;
        let mut bound = Bound::default();
        for reference in &index.references[r.references.range()] {
            let Some(binding) = bindings
                .iter()
                .find(|binding| binding.definition == reference.definition)
            else {
                continue;
            };
            if reference.field == ids.field_symbol && binding.value.component != NO_GUID {
                component = binding.value.component;
                if binding.rank != NONE {
                    component_chosen_at = Some(binding.rank);
                }
            } else if reference.field == ids.field_slot && binding.value.slot != NO_GUID {
                slot = binding.value.slot;
            } else if reference.field == ids.field_visible
                && let Some(visible) = binding.value.boolean
            {
                bound.visible = Some((visible, binding.rank));
            } else if reference.field == ids.field_text
                && let Some(text) = binding.value.text
            {
                bound.text = Some((text, binding.rank));
            }
        }
        if index.find(slot).is_none() {
            slot = NO_GUID;
        }

        let entered = r.ty == ids.symbol || chosen_at.is_some();
        if entered {
            self.entered.push(Entered {
                component: r.guid,
                rank,
                chosen_at: chosen_at.unwrap_or(rank),
            });
        }

        // The record's own structural layers, then those routed to it; inner owners first.
        let mut structural: Vec<Structural> = Vec::new();
        for at in r.overrides.range() {
            let entry = &index.overrides[at];
            if entry.path.length != 0 && (entry.swap != NO_GUID || entry.assignments.length != 0) {
                structural.push(Structural {
                    rank,
                    owner: record,
                    path: entry.path,
                    swap: entry.swap,
                    assignments: entry.assignments,
                    entry: Source::Override(at as u32),
                });
            }
        }
        structural.extend(layers);
        structural.sort_by_key(|layer| core::cmp::Reverse(layer.rank));

        // Layers addressed to the root choose the component and complete the assignments.
        let mut effective = component;
        let mut keys: Vec<u64> = Vec::new();
        self.component_keys(r.component, &mut keys);
        self.component_keys(effective, &mut keys);
        let mut groups = vec![Group {
            assignments: r.assignments,
            rank,
            owner: record,
            entry: Source::Record(record),
        }];
        let mut descendant: Vec<Structural> = Vec::new();
        let mut swapped_at: Option<u32> = None;
        // Whether an outer decision replaced a component on the way to the one it expands.
        let mut replaced = component != r.component && r.component != NO_GUID;
        for layer in structural {
            let to_root =
                layer.path.length == 0 || keys.contains(&index.guids[layer.path.start as usize]);
            if !to_root || layer.path.length > 1 {
                descendant.push(if to_root {
                    Structural {
                        path: layer.path.tail(),
                        ..layer
                    }
                } else {
                    layer
                });
                continue;
            }
            if layer.swap != NO_GUID {
                if effective == NO_GUID {
                    self.unresolved.swaps_on_non_instances += 1;
                } else {
                    replaced |= effective != layer.swap;
                    effective = layer.swap;
                    swapped_at = Some(layer.rank);
                    self.component_keys(effective, &mut keys);
                }
            }
            if layer.assignments.length != 0 {
                groups.push(Group {
                    assignments: layer.assignments,
                    rank: layer.rank,
                    owner: layer.owner,
                    entry: layer.entry,
                });
            }
        }

        let choice_rank = swapped_at.or(component_chosen_at).unwrap_or(rank);
        if effective != NO_GUID && self.closes_loop(effective, choice_rank) {
            self.unresolved.loops += 1;
            if entered {
                self.entered.pop();
            }
            return false;
        }

        let me = merge.unwrap_or_else(|| self.push(record, parent));
        if merge.is_none() {
            self.occurrences[me as usize].expands = effective;
        }
        let mut dangling = false;
        let mut has_base = false;
        if effective != NO_GUID {
            let expanded = match index.find(effective) {
                Some(base) => {
                    let mut routed: Vec<Structural> = groups
                        .iter()
                        .filter(|group| group.assignments.length != 0)
                        .map(|group| Structural {
                            rank: group.rank,
                            owner: group.owner,
                            path: Run::default(),
                            swap: NO_GUID,
                            assignments: group.assignments,
                            entry: group.entry,
                        })
                        .collect();
                    routed.extend(descendant);
                    self.expand(
                        base,
                        &[],
                        routed,
                        rank + 1,
                        Some(choice_rank),
                        NONE,
                        Some(me),
                    )
                }
                None => {
                    self.unresolved.missing_components += 1;
                    false
                }
            };
            if expanded {
                has_base = true;
                if merge.is_none() {
                    self.occurrences[me as usize].component = index.find(effective).unwrap_or(NONE);
                    if r.component != effective && r.ty == ids.instance {
                        self.occurrences[me as usize].flags |= SWAPPED;
                    }
                }
                self.occurrences[me as usize].flags |= INSTANCE;
            } else {
                dangling = true;
                self.occurrences[me as usize].flags |= DANGLING;
            }
        } else if slot != NO_GUID {
            self.occurrences[me as usize].flags |= SLOT;
            let content = index.find(slot).unwrap_or(NONE);
            self.expand_children(content, &[], descendant, rank, me);
        } else if r.ty == ids.symbol {
            // A component definition starts a binding scope: its defaults, then assignments.
            let mut scope: Vec<Binding> = index.definitions[r.definitions.range()]
                .iter()
                .filter(|definition| definition.id != NO_GUID)
                .filter_map(|definition| {
                    Some(Binding {
                        definition: definition.id,
                        value: definition.initial?,
                        rank: NONE,
                    })
                })
                .collect();
            for group in &groups {
                for assignment in &index.assignments[group.assignments.range()] {
                    let Some(value) = assignment.value else {
                        continue;
                    };
                    if assignment.definition == NO_GUID {
                        continue;
                    }
                    let binding = Binding {
                        definition: assignment.definition,
                        value,
                        rank: group.rank,
                    };
                    match scope
                        .iter_mut()
                        .find(|entry| entry.definition == assignment.definition)
                    {
                        Some(entry) => *entry = binding,
                        None => scope.push(binding),
                    }
                }
            }
            self.expand_children(record, &scope, descendant, rank, me);
        } else {
            self.expand_children(record, bindings, descendant, rank, me);
        }

        // The record is the top layer of its own root; a component standing in as a base gives
        // the instance only what an instance takes from its component.
        let inherited = if merge.is_some() { INHERITED } else { 0 };
        let swapped_root = has_base && r.component != effective && r.ty == ids.instance;
        self.layer(
            me,
            record,
            rank,
            Source::Record(record),
            inherited | if swapped_root { SWAPPED_PAINT } else { 0 },
        );
        if merge.is_none() && (bound.visible.is_some() || bound.text.is_some()) {
            self.bound.push(bound);
            self.layer(
                me,
                record,
                rank,
                Source::Bound(self.bound.len() as u32 - 1),
                0,
            );
        }
        if merge.is_none() && r.ty == ids.instance {
            self.assignment_lists
                .push(groups.iter().map(|group| group.entry).collect());
            let list = self.assignment_lists.len() as u32 - 1;
            self.layer(me, record, rank, Source::Assignments(list), 0);
        }
        // A swapped instance without a name of its own takes its replacement's default name.
        if has_base && replaced {
            // A variant takes its set's name; an instance standing in as a component keeps its own.
            let base = index.find(effective).unwrap_or(NONE);
            let set = index.find(index.records[base as usize].parent);
            let named = set.filter(|&set| {
                index.records[base as usize].ty != ids.instance
                    && index.records[set as usize].flags & STATE_GROUP != 0
            });
            self.layer(
                me,
                record,
                rank,
                Source::DefaultName(named.unwrap_or(NONE)),
                0,
            );
        }

        // Property layers and saved derived data, placed onto the built subtree.
        let mut root_keys: Vec<u64> = Vec::new();
        self.component_keys(effective, &mut root_keys);
        self.component_keys(r.component, &mut root_keys);
        if let Some(key) = self.final_override_key(effective)
            && !root_keys.contains(&key)
        {
            root_keys.push(key);
        }
        // The modes an instance record sets are its claim on its own root.
        if r.ty == ids.instance && r.component != NO_GUID {
            self.layer(me, record, rank, Source::Record(record), inherited | MODES);
        }
        for at in r.overrides.range() {
            let entry = &index.overrides[at];
            if !entry.has_properties || entry.path.length == 0 {
                continue;
            }
            let path = &index.guids[entry.path.range()];
            // A dangling instance keeps only layers addressed to itself.
            if dangling && !(path.len() == 1 && root_keys.contains(&path[0])) {
                continue;
            }
            match self.resolve(me, path, &root_keys) {
                // What a component's own layers set on its root is part of the component.
                Some(target) if target == me => {
                    self.layer(me, record, rank, Source::Override(at as u32), inherited);
                }
                Some(target) => {
                    let lands_on = self.occurrences[target as usize].record;
                    self.layer(target, lands_on, rank, Source::Override(at as u32), 0);
                }
                None => self.unresolved.properties += 1,
            }
        }
        // Expansion is in component space; the record's own distances are already placed.
        if r.scale != 1.0 && r.scale.is_finite() && r.scale > 0.0 {
            self.steps.push(Step::Scale {
                owner: me,
                factor: f64::from(r.scale),
            });
            self.layer(me, record, rank, Source::Record(record), inherited | SCALED);
        }
        if has_base {
            self.steps.push(Step::Resize { owner: me, record });
        }
        // The size the file keeps for an instance is its own content laid out.
        if r.ty == ids.instance {
            self.layer(me, record, rank, Source::Record(record), inherited | SIZE);
        }
        if !dangling {
            for at in r.derived.range() {
                let path = &index.guids[index.derived[at].path.range()];
                match self.resolve(me, path, &root_keys) {
                    // The placed root's bounds belong to the record itself.
                    Some(target) if target == me => {}
                    Some(target) => {
                        let lands_on = self.occurrences[target as usize].record;
                        self.layer(target, lands_on, rank, Source::Derived(at as u32), 0);
                    }
                    None => self.unresolved.derived += 1,
                }
            }
        }

        if merge.is_none() {
            self.occurrences[me as usize].end = self.occurrences.len() as u32;
        }
        if entered {
            self.entered.pop();
        }
        true
    }

    /// Expands a record's children, each with the structural layers routed to it.
    fn expand_children(
        &mut self,
        parent: u32,
        bindings: &[Binding],
        layers: Vec<Structural>,
        rank: u32,
        me: u32,
    ) {
        if parent == NONE {
            return;
        }
        let index = self.index;
        let mut routed: GuidMap<u32, Vec<Structural>> = GuidMap::default();
        for layer in layers {
            let segment = index.guids[layer.path.start as usize];
            match self.find_static(parent, segment) {
                Some((top, direct)) => {
                    let next = if direct {
                        Structural {
                            path: layer.path.tail(),
                            ..layer
                        }
                    } else {
                        layer
                    };
                    routed.entry(top).or_default().push(next);
                }
                None => self.unresolved.structural += 1,
            }
        }
        let at_page = parent == self.page;
        for &child in index.children(parent) {
            // Slot content is placed through the instance assigning it, never as a page's layer.
            if at_page && index.records[child as usize].flags & SLOT_CONTENT != 0 {
                continue;
            }
            let own = routed.remove(&child).unwrap_or_default();
            self.expand(child, bindings, own, rank + 1, None, me, None);
        }
    }

    fn matches(&self, record: u32, guid: u64) -> bool {
        let record = &self.index.records[record as usize];
        guid != NO_GUID && (record.guid == guid || record.override_key == guid)
    }

    /// Finds a path segment among a record's static descendants, through ordinary containers but
    /// never into an instance. Returns the child holding the single match, and whether that child
    /// is the match.
    fn find_static(&self, parent: u32, guid: u64) -> Option<(u32, bool)> {
        let index = self.index;
        let mut found = None;
        let mut count = 0;
        let mut stack: Vec<(u32, u32)> = index
            .children(parent)
            .iter()
            .rev()
            .map(|&top| (top, top))
            .collect();
        while let Some((node, top)) = stack.pop() {
            if self.matches(node, guid) {
                count += 1;
                found = Some((top, node == top));
                continue;
            }
            if index.records[node as usize].component != NO_GUID {
                continue;
            }
            stack.extend(index.children(node).iter().rev().map(|&child| (child, top)));
        }
        if count == 1 { found } else { None }
    }

    /// Resolves a property layer's path from its owner to the occurrence it addresses.
    fn resolve(&self, owner: u32, path: &[u64], root_keys: &[u64]) -> Option<u32> {
        let mut target = owner;
        for (at, &guid) in path.iter().enumerate() {
            if at == 0 && root_keys.contains(&guid) {
                continue;
            }
            target = self.find_segment(target, guid)?;
        }
        Some(target)
    }

    /// Finds a segment among an occurrence's descendants, never inside a nested instance.
    fn find_segment(&self, root: u32, guid: u64) -> Option<u32> {
        let mut found = None;
        let mut count = 0;
        let mut stack: Vec<u32> = self.children_of(root).collect();
        while let Some(node) = stack.pop() {
            let occurrence = &self.occurrences[node as usize];
            if self.matches(occurrence.record, guid) {
                count += 1;
                found = Some(node);
                continue;
            }
            if occurrence.flags & INSTANCE != 0 {
                continue;
            }
            stack.extend(self.children_of(node));
        }
        if count == 1 { found } else { None }
    }

    /// An occurrence's children in order.
    pub fn children_of(&self, occurrence: u32) -> impl Iterator<Item = u32> + '_ {
        let mut child = self.occurrences[occurrence as usize].first_child;
        core::iter::from_fn(move || {
            let current = child;
            if current == NONE {
                return None;
            }
            child = self.occurrences[current as usize].next_sibling;
            Some(current)
        })
    }
}
