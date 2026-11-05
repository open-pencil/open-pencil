/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#define SHADR_HUD_DEPTH_BASE 0.95
#define SHADR_LAYER_TO_DEPTH 0.000001

#define SHADR_BLUR_PANEL_LAYER -5000.0
#define SHADR_BLUR_PANEL_DEPTH (SHADR_HUD_DEPTH_BASE + SHADR_BLUR_PANEL_LAYER * SHADR_LAYER_TO_DEPTH)

#define SHADR_BLUR_KEY vec3(0.0, 0.047058824, 0.011764706)

#define SHADR_BLUR_KEY_TOLERANCE 0.006

/** The frost's own tint, mixed over the blurred backdrop. */
#define SHADR_BLUR_TINT vec3(0.06, 0.07, 0.09)

#define SHADR_BLUR_TINT_STRENGTH 0.28

bool shadr_is_blur_panel(vec3 colour) {
    return all(lessThan(abs(colour - SHADR_BLUR_KEY), vec3(SHADR_BLUR_KEY_TOLERANCE)));
}
