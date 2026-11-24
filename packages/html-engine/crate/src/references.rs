//! Which custom properties each element's styles come from: the declaration that wins the
//! cascade for a property, when it is written with `var()`, with the custom properties the root
//! element declares left as references and every other one replaced by what it was set to.

use std::collections::hash_map::Entry;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

use blitz_dom::{BaseDocument, Node};
use blitz_traits::node_id::NodeId;
use cssparser::{ParseError, Parser, Token};
use serde_json::{Map, Value};
use style::Atom;
use style::properties::{
    CSSWideKeyword, ComputedValues, CustomDeclarationValue, LonghandId, PropertyDeclaration,
    PropertyDeclarationBlock,
};
use style::shared_lock::SharedRwLockReadGuard;
use style_traits::ToCss as _;

/// The only text besides a reference worth inheriting: it stands for the element's `color`.
const CURRENT_COLOR: &str = "currentcolor";

/// What an element passes on to its children.
#[derive(Default, Clone)]
pub struct Scope {
    /// Winning declarations of inherited properties, expanded.
    inherited: Rc<HashMap<LonghandId, String>>,
    /// Custom properties as declared, expanded, by name without the dashes.
    custom: Rc<HashMap<Atom, String>>,
}

/// The custom properties the root element declares: what references are left pointing at.
pub struct Root {
    computed: HashMap<Atom, String>,
    declared: HashMap<Atom, String>,
}

impl Root {
    pub fn of(doc: &BaseDocument, guard: &SharedRwLockReadGuard) -> Option<Self> {
        let styles = doc.try_root_element()?.primary_styles()?;
        let declared = winners(&styles, guard).custom;
        let computed = computed_custom(&styles)
            .into_iter()
            .filter(|(name, _)| declared.contains_key(name))
            .collect();
        Some(Self { computed, declared })
    }

    /// Each property as the root declares it, such as `var(--primary)`, by its full name.
    pub fn to_json(&self) -> Value {
        let out: Map<String, Value> = self
            .declared
            .iter()
            .filter(|(name, _)| self.computed.contains_key(*name))
            .map(|(name, text)| (format!("--{name}"), text.trim().into()))
            .collect();
        Value::Object(out)
    }
}

fn computed_custom(styles: &ComputedValues) -> HashMap<Atom, String> {
    let custom = styles.custom_properties();
    let count = custom.inherited.len() + custom.non_inherited.len();
    (0..count)
        .filter_map(|index| custom.property_at(index))
        .filter_map(|(name, value)| {
            let value = value.as_ref()?;
            Some((name.clone(), value.to_css_string().trim().to_owned()))
        })
        .collect()
}

/// What the cascade picked for an element: a longhand's text when it is written with `var()` or
/// is `currentcolor`, and none when something else won; and custom properties as declared.
#[derive(Default)]
struct Winners {
    longhands: HashMap<LonghandId, Option<String>>,
    custom: HashMap<Atom, String>,
    /// Longhands and custom properties that take the parent's value.
    inherits: HashSet<LonghandId>,
}

fn winners(styles: &ComputedValues, guard: &SharedRwLockReadGuard) -> Winners {
    let mut found = Winners::default();
    let mut decided_custom: HashSet<Atom> = HashSet::new();
    // From the rule that wins to those it overrides; within a block, the later declaration wins.
    for rule in styles.rules().self_and_ancestors() {
        let Some(source) = rule.style_source() else {
            continue;
        };
        let important = rule.importance().important();
        let block = source.read(guard);
        for (declaration, importance) in block.declaration_importance_iter().rev() {
            if importance.important() != important {
                continue;
            }
            match declaration {
                PropertyDeclaration::Custom(custom) => {
                    if !decided_custom.insert(custom.name.clone()) {
                        continue;
                    }
                    match &custom.value {
                        CustomDeclarationValue::Unparsed(value) => {
                            found.custom.insert(custom.name.clone(), value.css.clone());
                        }
                        CustomDeclarationValue::Parsed(value) => {
                            found
                                .custom
                                .insert(custom.name.clone(), value.to_css_string());
                        }
                        CustomDeclarationValue::CSSWideKeyword(_) => {}
                    }
                }
                PropertyDeclaration::WithVariables(_) => {
                    if let Some(id) = declaration.id().as_longhand() {
                        found
                            .longhands
                            .entry(id.to_physical(styles.writing_mode))
                            .or_insert_with(|| variable_text(block, declaration, id));
                    }
                }
                PropertyDeclaration::CSSWideKeyword(wide) => {
                    if let Some(id) = declaration.id().as_longhand() {
                        let id = id.to_physical(styles.writing_mode);
                        let inherits = match wide.keyword {
                            CSSWideKeyword::Inherit => true,
                            CSSWideKeyword::Unset => id.inherited(),
                            _ => false,
                        };
                        if let Entry::Vacant(entry) = found.longhands.entry(id) {
                            entry.insert(None);
                            if inherits {
                                found.inherits.insert(id);
                            }
                        }
                    }
                }
                _ => {
                    if let Some(id) = declaration.id().as_longhand() {
                        let id = id.to_physical(styles.writing_mode);
                        found.longhands.entry(id).or_insert_with(|| {
                            let mut text = String::new();
                            let _ = declaration.to_css(&mut text);
                            text.eq_ignore_ascii_case(CURRENT_COLOR)
                                .then(|| CURRENT_COLOR.to_owned())
                        });
                    }
                }
            }
        }
    }
    found
}

/// A declaration's text as written; one that comes from a shorthand has the shorthand's.
fn variable_text(
    block: &PropertyDeclarationBlock,
    declaration: &PropertyDeclaration,
    id: LonghandId,
) -> Option<String> {
    let mut text = String::new();
    let _ = declaration.to_css(&mut text);
    if !text.is_empty() {
        return Some(text);
    }
    id.shorthands().find_map(|shorthand| {
        let mut text = String::new();
        let _ = block.shorthand_to_css(shorthand, &mut text);
        (!text.is_empty()).then_some(text)
    })
}

/// Replaces `var()` in a value: one that names a custom property the element takes from the root
/// unchanged stays, one set nearer by becomes what it was set to, and one set nowhere its fallback.
struct Expander<'a> {
    doc: &'a BaseDocument,
    node: NodeId,
    root: &'a Root,
    /// The element's custom properties' computed values.
    computed: HashMap<Atom, String>,
    /// Those the element declares itself, as written.
    own: &'a HashMap<Atom, String>,
    inherited: &'a HashMap<Atom, String>,
}

impl Expander<'_> {
    fn expand(&self, text: &str, visiting: &mut Vec<Atom>) -> Option<String> {
        let mut out = String::new();
        self.write(&mut Parser::new(text), &mut out, visiting)
            .then(|| out.trim().to_owned())
    }

    fn write(&self, input: &mut Parser<'_>, out: &mut String, visiting: &mut Vec<Atom>) -> bool {
        while let Ok(token) = input.next_including_whitespace_and_comments() {
            let token = token.clone();
            let closing = match &token {
                Token::Function(name) if name.eq_ignore_ascii_case("var") => {
                    let replaced = input.parse_nested_block(|block| {
                        let name = block.expect_ident().map_err(ParseError::<()>::from)?;
                        let name = Atom::from(name.strip_prefix("--").unwrap_or_default());
                        let comma = block.try_parse(|rest| rest.expect_comma()).is_ok();
                        let start = block.position();
                        while block.next_including_whitespace_and_comments().is_ok() {}
                        let fallback = comma.then(|| block.slice_from(start).to_owned());
                        Ok((name, fallback))
                    });
                    let Ok((name, fallback)) = replaced else {
                        return false;
                    };
                    let Some(text) = self.variable(&name, fallback.as_deref(), visiting) else {
                        return false;
                    };
                    out.push_str(&text);
                    continue;
                }
                Token::Function(_) | Token::ParenthesisBlock => ")",
                Token::SquareBracketBlock => "]",
                Token::CurlyBracketBlock => "}",
                Token::Comment(_) => continue,
                _ => {
                    let _ = cssparser::ToCss::to_css(&token, out);
                    continue;
                }
            };
            let _ = cssparser::ToCss::to_css(&token, out);
            let mut complete = true;
            let _ = input.parse_nested_block(|block| {
                complete = self.write(block, out, visiting);
                Ok::<(), ParseError<()>>(())
            });
            if !complete {
                return false;
            }
            out.push_str(closing);
        }
        true
    }

    fn variable(
        &self,
        name: &Atom,
        fallback: Option<&str>,
        visiting: &mut Vec<Atom>,
    ) -> Option<String> {
        let Some(value) = self.computed.get(name) else {
            // One registered with `@property` has its initial value.
            let initial = self
                .doc
                .resolved_style_value(self.node, &format!("--{name}"));
            return match (initial.trim(), fallback) {
                ("", fallback) => self.expand(fallback?, visiting),
                (initial, _) => Some(initial.to_owned()),
            };
        };
        if self.root.computed.get(name) == Some(value) {
            return Some(format!("var(--{name})"));
        }
        if visiting.contains(name) {
            return None;
        }
        if let Some(declared) = self.own.get(name) {
            visiting.push(name.clone());
            let expanded = self.expand(declared, visiting);
            visiting.pop();
            return expanded;
        }
        Some(self.inherited.get(name).unwrap_or(value).clone())
    }
}

/// The element's properties whose values come from the root's custom properties, by name, as
/// written once expanded; and what its children inherit.
pub fn of(
    doc: &BaseDocument,
    node: &Node,
    root: &Root,
    scope: &Scope,
    guard: &SharedRwLockReadGuard,
    properties: &[&str],
) -> (Value, Scope) {
    let Some(styles) = node.primary_styles() else {
        return (Value::Object(Map::new()), scope.clone());
    };
    let won = winners(&styles, guard);
    let expander = Expander {
        doc,
        node: node.id,
        root,
        computed: computed_custom(&styles),
        own: &won.custom,
        inherited: &scope.custom,
    };
    let mut inherited = (*scope.inherited).clone();
    let mut texts: HashMap<LonghandId, String> = HashMap::new();
    for (id, text) in &won.longhands {
        if won.inherits.contains(id) {
            if let Some(text) = scope.inherited.get(id) {
                texts.insert(*id, text.clone());
            }
            continue;
        }
        let text = text
            .as_deref()
            .and_then(|text| expander.expand(text, &mut Vec::new()))
            .filter(|text| text.contains("var(") || text.eq_ignore_ascii_case(CURRENT_COLOR));
        if id.inherited() {
            inherited.remove(id);
        }
        if let Some(text) = text {
            texts.insert(*id, text);
        }
    }
    for (id, text) in &texts {
        if id.inherited() {
            inherited.insert(*id, text.clone());
        }
    }
    // `color: currentcolor` is the parent's color.
    if inherited.get(&LonghandId::Color).map(String::as_str) == Some(CURRENT_COLOR) {
        match scope.inherited.get(&LonghandId::Color) {
            Some(text) => inherited.insert(LonghandId::Color, text.clone()),
            None => inherited.remove(&LonghandId::Color),
        };
    }
    let color = inherited.get(&LonghandId::Color);

    let mut out = Map::new();
    for property in properties {
        let Some(id) = longhand(property) else {
            continue;
        };
        let text = match texts.get(&id) {
            Some(text) => Some(text),
            None if id.inherited() => inherited.get(&id),
            None if CURRENT_BY_DEFAULT.contains(&id) && !won.longhands.contains_key(&id) => color,
            None => None,
        };
        let text = match text.map(String::as_str) {
            Some(CURRENT_COLOR) => color.map(String::as_str),
            other => other,
        };
        if let Some(text) = text {
            out.insert((*property).to_owned(), text.into());
        }
    }

    let passed_on: HashMap<Atom, String> = {
        let mut custom = (*scope.custom).clone();
        for name in won.custom.keys() {
            custom.remove(name);
            // A registered property may not inherit.
            if styles.custom_properties().inherited.get(name).is_none() {
                continue;
            }
            if let Some(text) = expander.expand(&won.custom[name], &mut vec![name.clone()]) {
                custom.insert(name.clone(), text);
            }
        }
        custom
    };
    let passed = Scope {
        inherited: Rc::new(inherited),
        custom: Rc::new(passed_on),
    };
    (Value::Object(out), passed)
}

/// Colors that are the element's `color` until something sets them.
const CURRENT_BY_DEFAULT: &[LonghandId] = &[
    LonghandId::BorderTopColor,
    LonghandId::BorderRightColor,
    LonghandId::BorderBottomColor,
    LonghandId::BorderLeftColor,
    LonghandId::OutlineColor,
    LonghandId::TextDecorationColor,
];

fn longhand(property: &str) -> Option<LonghandId> {
    use style::properties::PropertyId;
    let id = PropertyId::parse_enabled_for_all_content(property).ok()?;
    id.longhand_id()
}
