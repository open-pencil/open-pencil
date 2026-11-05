/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#moj_import <shadr_world.glsl>

bool shadr_ui_here(sampler2D mainDepth, sampler2D translucentDepth, sampler2D itemDepth, vec2 uv) {
    return shadr_is_ui(texture(mainDepth, uv).r)
        || shadr_is_ui(texture(translucentDepth, uv).r)
        || shadr_is_ui(texture(itemDepth, uv).r);
}
