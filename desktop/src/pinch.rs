use gtk::{gdk, glib::Propagation, prelude::WidgetExt};
use tauri::{Emitter, EventTarget, Manager, WebviewWindow};

/// A touchpad pinch, in the terms of WebKit's gesture events: `scale` is relative to the
/// gesture's start, as GDK reports it, and the position is in the webview's CSS pixels.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Pinch {
    phase: &'static str,
    scale: f64,
    client_x: f64,
    client_y: f64,
}

/// The gesture event a GDK pinch phase stands for.
fn gesture_phase(phase: i32) -> Option<&'static str> {
    match phase {
        gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_BEGIN => Some("gesturestart"),
        gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_UPDATE => Some("gesturechange"),
        gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_END | gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_CANCEL => {
            Some("gestureend")
        }
        _ => None,
    }
}

/// WebKitGTK handles touchpad pinches in GTK, not as cancelable DOM gestures. Consume
/// them before its bubble-phase zoom controller so they never magnify the webview, and hand
/// them to the page as the gesture events WebKit sends on macOS.
pub fn install(window: &WebviewWindow) -> tauri::Result<()> {
    let app = window.app_handle().clone();
    let target = EventTarget::webview_window(window.label());
    window.with_webview(move |webview| {
        webview.inner().connect_event(move |_, event| {
            let Some(pinch) = event.downcast_ref::<gdk::EventTouchpadPinch>() else {
                return Propagation::Proceed;
            };
            // gtk-rs 0.18's is_phase() returns a bool rather than the GDK phase enum.
            let phase = gesture_phase(i32::from(pinch.as_ref().phase));
            let scale = pinch.scale();
            if let Some(phase) = phase.filter(|_| scale.is_finite() && scale > 0.0) {
                let (client_x, client_y) = pinch.position();
                let payload = Pinch {
                    phase,
                    scale,
                    client_x,
                    client_y,
                };
                let _ = app.emit_to(target.clone(), "canvas-pinch", payload);
            }
            Propagation::Stop
        });
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_each_pinch_phase_to_a_gesture_event() {
        let phases = [
            (gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_BEGIN, Some("gesturestart")),
            (gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_UPDATE, Some("gesturechange")),
            (gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_END, Some("gestureend")),
            (gdk::ffi::GDK_TOUCHPAD_GESTURE_PHASE_CANCEL, Some("gestureend")),
            (-1, None),
        ];
        for (phase, event) in phases {
            assert_eq!(gesture_phase(phase), event);
        }
    }
}
