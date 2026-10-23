/// Avoid registering Linux menu accelerators that GTK can consume while text is being edited.
/// Accelerators with a modifier other than Shift remain available to the native menu.
pub(super) fn should_attach_native_accelerator(accelerator: &str, is_linux: bool) -> bool {
    !is_linux
        || accelerator
            .split('+')
            .rev()
            .skip(1)
            .any(|modifier| !modifier.trim().eq_ignore_ascii_case("shift"))
}

#[cfg(test)]
mod tests {
    use super::should_attach_native_accelerator;

    #[test]
    fn linux_skips_single_key_and_shift_only_accelerators() {
        for accelerator in [
            "N",
            "Backspace",
            "PageUp",
            "PageDown",
            "]",
            "[",
            "Shift+N",
            "Shift+R",
            "Shift+1",
        ] {
            assert!(
                !should_attach_native_accelerator(accelerator, true),
                "unexpected native accelerator: {accelerator}"
            );
        }
    }

    #[test]
    fn linux_keeps_accelerators_with_a_non_shift_modifier() {
        for accelerator in ["CmdOrCtrl+N", "CmdOrCtrl+Shift+N", "Alt+D", "Alt+Shift+U"] {
            assert!(
                should_attach_native_accelerator(accelerator, true),
                "missing native accelerator: {accelerator}"
            );
        }
    }

    #[test]
    fn other_platforms_keep_all_accelerators() {
        for accelerator in ["N", "Backspace", "Shift+N", "CmdOrCtrl+Shift+N"] {
            assert!(
                should_attach_native_accelerator(accelerator, false),
                "missing native accelerator: {accelerator}"
            );
        }
    }
}
