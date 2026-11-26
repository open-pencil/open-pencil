//! Sizes and positions replayed for a whole page: an instance placed at another size than its
//! component moves and resizes its layers by their own constraints and sizes
//! (`packages/fig/src/instance-overrides/resize.ts`), and a uniform scale multiplies them
//! (`scale/layout.ts`).

use super::{Properties, keeps};
use crate::expand::{MODES, SCALED, SIZE, Source, Step};
use crate::kiwi::Value;

/// A layer's size and position, from its `size` and `transform`.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Geometry {
    pub size: Option<[f64; 2]>,
    /// `m00, m01, m02, m10, m11, m12`.
    pub transform: Option<[f64; 6]>,
}

/// What a resize reads of a layer besides its geometry.
#[derive(Clone, Copy, Default)]
struct Placement {
    auto_layout: bool,
    absolute: bool,
    horizontal: Option<Constraint>,
    vertical: Option<Constraint>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Constraint {
    Min,
    Center,
    Max,
    Stretch,
    Scale,
}

impl Constraint {
    fn named(name: &str) -> Option<Constraint> {
        Some(match name {
            "MIN" => Constraint::Min,
            "CENTER" => Constraint::Center,
            "MAX" => Constraint::Max,
            "STRETCH" => Constraint::Stretch,
            "SCALE" => Constraint::Scale,
            _ => return None,
        })
    }

    /// A layer's position and size along one axis once its parent goes from `before` to `after`.
    fn apply(
        constraint: Option<Self>,
        position: f64,
        size: f64,
        before: f64,
        after: f64,
    ) -> (f64, f64) {
        let delta = after - before;
        match constraint {
            Some(Constraint::Scale) if before > 0.0 => {
                let factor = after / before;
                (position * factor, size * factor)
            }
            Some(Constraint::Max) => (position + delta, size),
            Some(Constraint::Center) => (position + delta / 2.0, size),
            Some(Constraint::Stretch) => (position, (size + delta).max(0.0)),
            _ => (position, size),
        }
    }
}

const IDENTITY: [f64; 6] = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0];

fn vector(value: &Value) -> Option<[f64; 2]> {
    Some([value.get("x")?.as_f64()?, value.get("y")?.as_f64()?])
}

fn matrix(value: &Value) -> Option<[f64; 6]> {
    let at = |name| value.get(name).and_then(Value::as_f64);
    Some([
        at("m00")?,
        at("m01")?,
        at("m02")?,
        at("m10")?,
        at("m11")?,
        at("m12")?,
    ])
}

impl Properties<'_> {
    /// Sizes and positions after every step, for every occurrence.
    pub(super) fn replay_geometry(&self) -> crate::Result<Vec<Geometry>> {
        let occurrences = &self.expansion.occurrences;
        let mut geometry = vec![Geometry::default(); occurrences.len()];
        let mut placement = vec![Placement::default(); occurrences.len()];
        // The size each occurrence had before its latest record layer: its component's size.
        let mut before: Vec<Option<[f64; 2]>> = vec![None; occurrences.len()];
        for step in &self.expansion.steps {
            match *step {
                Step::Layer(layer) => {
                    let Some(span) = self.span(layer.source) else {
                        continue;
                    };
                    if matches!(layer.source, Source::DefaultName(_)) {
                        continue;
                    }
                    let at = layer.target as usize;
                    if matches!(layer.source, Source::Record(_))
                        && layer.only & (SCALED | SIZE | MODES) == 0
                    {
                        before[at] = geometry[at].size;
                    }
                    let (shape, place) = (&mut geometry[at], &mut placement[at]);
                    self.fields(span, |name, reader| {
                        if !keeps(&layer, name) {
                            return Ok(false);
                        }
                        match name {
                            "size" => shape.size = vector(&self.decode(reader, name)?),
                            "transform" => shape.transform = matrix(&self.decode(reader, name)?),
                            "stackMode" => {
                                let mode = self.decode(reader, name)?;
                                place.auto_layout =
                                    mode.as_str().is_some_and(|mode| mode != "NONE");
                            }
                            "stackPositioning" => {
                                let mode = self.decode(reader, name)?;
                                place.absolute = mode.as_str() == Some("ABSOLUTE");
                            }
                            "horizontalConstraint" => {
                                let value = self.decode(reader, name)?;
                                place.horizontal = value.as_str().and_then(Constraint::named);
                            }
                            "verticalConstraint" => {
                                let value = self.decode(reader, name)?;
                                place.vertical = value.as_str().and_then(Constraint::named);
                            }
                            _ => return Ok(false),
                        }
                        Ok(true)
                    })?;
                }
                Step::Scale { owner, factor } => {
                    let end = occurrences[owner as usize].end as usize;
                    for shape in &mut geometry[owner as usize..end] {
                        if let Some(size) = &mut shape.size {
                            size[0] *= factor;
                            size[1] *= factor;
                        }
                        if let Some(transform) = &mut shape.transform {
                            transform[2] *= factor;
                            transform[5] *= factor;
                        }
                    }
                }
                Step::Resize { owner, record } => {
                    let Some(base) = before[owner as usize] else {
                        continue;
                    };
                    let size = self.record_field(record, "size")?;
                    let Some(after) = size.as_ref().and_then(vector) else {
                        continue;
                    };
                    let scale = f64::from(self.index.records[record as usize].scale);
                    let base = [base[0] * scale, base[1] * scale];
                    self.resize(&mut geometry, &placement, owner, base, after);
                }
            }
        }
        Ok(geometry)
    }

    /// Freeform resize: an instance's layers follow their constraints, each layer's own layers
    /// following it in turn (`resizeFreeformOccurrence`).
    fn resize(
        &self,
        geometry: &mut [Geometry],
        placement: &[Placement],
        root: u32,
        before: [f64; 2],
        after: [f64; 2],
    ) {
        if before == after {
            return;
        }
        let auto_layout = placement[root as usize].auto_layout;
        let children: Vec<u32> = self.expansion.children_of(root).collect();
        for child in children {
            let at = child as usize;
            if auto_layout && !placement[at].absolute {
                continue;
            }
            let Some(size) = geometry[at].size else {
                continue;
            };
            let transform = geometry[at].transform.unwrap_or(IDENTITY);
            let (x, width) = Constraint::apply(
                placement[at].horizontal,
                transform[2],
                size[0],
                before[0],
                after[0],
            );
            let (y, height) = Constraint::apply(
                placement[at].vertical,
                transform[5],
                size[1],
                before[1],
                after[1],
            );
            let resized = [width, height];
            self.resize(geometry, placement, child, size, resized);
            geometry[at].size = Some(resized);
            let mut moved = transform;
            moved[2] = x;
            moved[5] = y;
            geometry[at].transform = Some(moved);
        }
    }
}
