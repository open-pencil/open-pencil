//! Sizes and positions replayed for a whole page: an instance placed at another size than its
//! component moves and resizes its layers by their own constraints and sizes
//! (`packages/fig/src/instance-overrides/resize.ts`), and a uniform scale multiplies them
//! (`scale/layout.ts`).

use serde::Deserialize;

use super::{Properties, keeps};
use crate::expand::{MODES, SCALED, SIZE, Source, Step};
use crate::model::{ConstraintType, Matrix, NodeField, StackMode, StackPositioning, Vector};

/// A layer's size and position, from its `size` and `transform`.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Geometry {
    pub size: Option<[f64; 2]>,
    /// `m00, m01, m02, m10, m11, m12`.
    pub transform: Option<[f64; 6]>,
}

/// The fields of an entry the replay reads; the rest are skipped in the bytes.
#[derive(Deserialize, Default)]
#[serde(default)]
struct Placed {
    size: Option<Vector>,
    transform: Option<Matrix>,
    #[serde(rename = "stackMode")]
    stack_mode: Option<StackMode>,
    #[serde(rename = "stackPositioning")]
    stack_positioning: Option<StackPositioning>,
    #[serde(rename = "horizontalConstraint")]
    horizontal: Option<ConstraintType>,
    #[serde(rename = "verticalConstraint")]
    vertical: Option<ConstraintType>,
}

/// What a resize reads of a layer besides its geometry.
#[derive(Clone, Copy, Default)]
struct Placement {
    auto_layout: bool,
    absolute: bool,
    horizontal: Option<ConstraintType>,
    vertical: Option<ConstraintType>,
}

/// A layer's position and size along one axis once its parent goes from `before` to `after`.
fn constrained(
    constraint: Option<ConstraintType>,
    position: f64,
    size: f64,
    before: f64,
    after: f64,
) -> (f64, f64) {
    let delta = after - before;
    match constraint {
        Some(ConstraintType::Scale) if before > 0.0 => {
            let factor = after / before;
            (position * factor, size * factor)
        }
        Some(ConstraintType::Max) => (position + delta, size),
        Some(ConstraintType::Center) => (position + delta / 2.0, size),
        Some(ConstraintType::Stretch) => (position, (size + delta).max(0.0)),
        _ => (position, size),
    }
}

const IDENTITY: [f64; 6] = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0];

fn matrix(m: &Matrix) -> [f64; 6] {
    [m.m00, m.m01, m.m02, m.m10, m.m11, m.m12]
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
                    if matches!(layer.source, Source::DefaultName(_)) {
                        continue;
                    }
                    let Some(span) = self.span(layer.source) else {
                        continue;
                    };
                    let at = layer.target as usize;
                    if matches!(layer.source, Source::Record(_))
                        && layer.only & (SCALED | SIZE | MODES) == 0
                    {
                        before[at] = geometry[at].size;
                    }
                    let placed: Placed = self.decode(span)?;
                    let (shape, place) = (&mut geometry[at], &mut placement[at]);
                    let kept = |field| keeps(&layer, field);
                    if let Some(size) = placed.size.filter(|_| kept(NodeField::Size)) {
                        shape.size = Some([size.x, size.y]);
                    }
                    if let Some(transform) = placed.transform.filter(|_| kept(NodeField::Transform))
                    {
                        shape.transform = Some(matrix(&transform));
                    }
                    if let Some(mode) = placed.stack_mode.filter(|_| kept(NodeField::StackMode)) {
                        place.auto_layout = !matches!(mode, StackMode::None | StackMode::Unlisted);
                    }
                    if let Some(mode) = placed
                        .stack_positioning
                        .filter(|_| kept(NodeField::StackPositioning))
                    {
                        place.absolute = mode == StackPositioning::Absolute;
                    }
                    if let Some(constraint) = placed
                        .horizontal
                        .filter(|_| kept(NodeField::HorizontalConstraint))
                    {
                        place.horizontal = Some(constraint);
                    }
                    if let Some(constraint) = placed
                        .vertical
                        .filter(|_| kept(NodeField::VerticalConstraint))
                    {
                        place.vertical = Some(constraint);
                    }
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
                    let placed: Placed = self.decode(self.index.records[record as usize].span)?;
                    let Some(after) = placed.size else {
                        continue;
                    };
                    // An invalid scale is none, as expansion treats it.
                    let scale = f64::from(self.index.records[record as usize].scale);
                    let scale = if scale.is_finite() && scale > 0.0 {
                        scale
                    } else {
                        1.0
                    };
                    let base = [base[0] * scale, base[1] * scale];
                    self.resize(&mut geometry, &placement, owner, base, [after.x, after.y]);
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
            let place = placement[at];
            let (x, width) =
                constrained(place.horizontal, transform[2], size[0], before[0], after[0]);
            let (y, height) =
                constrained(place.vertical, transform[5], size[1], before[1], after[1]);
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
