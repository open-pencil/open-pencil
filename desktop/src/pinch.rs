use std::cell::Cell;

use gtk::{gdk, glib::Propagation, prelude::WidgetExt};
use tauri::{Emitter, EventTarget, Manager, WebviewWindow};

// Chromium encodes a pinch as Ctrl+wheel with deltaY = -100 ln(relative scale).
// Using the same units keeps the editor's existing pinch sensitivity and zoom preference.
fn wheel_delta(previous_log_scale: &Cell<f64>, scale: f64) -> Option<f64> {
    if !scale.is_finite() || scale <= 0.0 {
        return None;
    }
    let log_scale = scale.ln();
    let delta = -100.0 * (log_scale - previous_log_scale.replace(log_scale));
    (delta != 0.0).then_some(delta)
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PinchWheel {
    client_x: f64,
    client_y: f64,
    delta_y: f64,
}

/// WebKitGTK handles touchpad pinches in GTK, not as cancelable DOM gestures. Consume
/// them before its bubble-phase zoom controller so they never magnify the webview.
pub fn install(window: &WebviewWindow) -> tauri::Result<()> {
    let app = window.app_handle().clone();
    let target = EventTarget::webview_window(window.label());
    window.with_webview(move |webview| {
        let previous_log_scale = Cell::new(0.0);
        webview.inner().connect_event(move |_, event| {
            let Some(pinch) = event.downcast_ref::<gdk::EventTouchpadPinch>() else {
                return Propagation::Proceed;
            };
            // gtk-rs 0.18's is_phase() returns a bool rather than the GDK phase enum.
            match i32::from(pinch.as_ref().phase) {
                gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_UPDATE => {
                    let (client_x, client_y) = pinch.position();
                    if let Some(delta_y) = wheel_delta(&previous_log_scale, pinch.scale()) {
                        let _ = app.emit_to(
                            target.clone(),
                            "canvas-pinch-wheel",
                            PinchWheel {
                                client_x,
                                client_y,
                                delta_y,
                            },
                        );
                    }
                }
                _ => previous_log_scale.set(0.0),
            }
            Propagation::Stop
        });
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sends_only_the_change_since_the_last_update() {
        let previous = Cell::new(0.0);
        let zoom_in = wheel_delta(&previous, 2.0).unwrap();
        assert!(zoom_in < 0.0);
        assert_eq!(wheel_delta(&previous, 2.0), None);
        assert_eq!(wheel_delta(&previous, 1.0), Some(-zoom_in));
    }

    #[test]
    fn invalid_scales_do_not_change_the_next_step() {
        let previous = Cell::new(0.0);
        assert_eq!(wheel_delta(&previous, f64::NAN), None);
        assert_eq!(wheel_delta(&previous, 0.0), None);
        assert_eq!(wheel_delta(&previous, 1.0), None);
    }
}
