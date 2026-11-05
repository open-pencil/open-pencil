/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#moj_import <shadr_header.glsl>

#define SHADR_MODE_HEADER 16.0

bool shadr_header_place() {
    if (Position.y > SHADR_HEADER_BAND) return false;
    int id = gl_VertexID & 3;
    vec2 corner = vec2((id == 2 || id == 3) ? 1.0 : 0.0, (id == 1 || id == 2) ? 1.0 : 0.0);
    vec2 pixel = corner * vec2(float(SHADR_HEADER_PIXELS) + 8.0, 4.0);
    vec2 ndc = pixel / ScreenSize * 2.0 - 1.0;
    shadrMode = SHADR_MODE_HEADER;
    gl_Position = vec4(ndc, shadr_depth(0.9999), 1.0);
    return true;
}
