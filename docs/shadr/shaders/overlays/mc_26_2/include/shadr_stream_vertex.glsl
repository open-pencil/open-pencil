/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#moj_import <shadr_stream.glsl>

int shadr_stream_header(sampler2D source, int index) {
    return shadr_map_word(texelFetch(source, ivec2(index, 0), 0));
}

bool shadr_stream_is_map(sampler2D source) {
    return textureSize(source, 0) == ivec2(SHADR_MAP_EDGE, SHADR_MAP_EDGE);
}

bool shadr_stream_place(sampler2D source, vec2 uv) {
    shadrMode = 0.0;
    if (!shadr_stream_is_map(source)) {
        return false;
    }

#ifndef SHADR_STREAM_TRUST_ANY_MAP
    int low = shadr_stream_header(source, SHADR_STREAM_W_MAGIC_LOW);
    int high = shadr_stream_header(source, SHADR_STREAM_W_MAGIC_HIGH);
    int version = shadr_stream_header(source, SHADR_STREAM_W_VERSION);
    if (low != SHADR_STREAM_MAGIC_LOW || high != SHADR_STREAM_MAGIC_HIGH || version != SHADR_STREAM_VERSION) {
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
        return true;
    }
#endif

    int flags = shadr_stream_header(source, SHADR_STREAM_W_FLAGS);
    int slot = shadr_stream_header(source, SHADR_STREAM_W_SLOT);
    int columns = shadr_stream_header(source, SHADR_STREAM_W_SLOT_COLUMNS);
    int rows = shadr_stream_header(source, SHADR_STREAM_W_SLOT_ROWS);
#ifdef SHADR_STREAM_TRUST_ANY_MAP
    if (columns <= 0 || rows <= 0 || slot >= columns * rows) {
        slot = 0;
        columns = 1;
        rows = 1;
    }
#else
    if ((flags & SHADR_STREAM_FLAG_ACTIVE) == 0 || columns <= 0 || rows <= 0 || slot >= columns * rows) {
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
        return true;
    }
#endif

    vec2 designOrigin = vec2(
        float(shadr_stream_join(
            shadr_stream_header(source, SHADR_STREAM_W_REGION_X_LOW),
            shadr_stream_header(source, SHADR_STREAM_W_REGION_X_HIGH))),
        float(shadr_stream_join(
            shadr_stream_header(source, SHADR_STREAM_W_REGION_Y_LOW),
            shadr_stream_header(source, SHADR_STREAM_W_REGION_Y_HIGH)))
    );

    ivec2 regionOrigin = shadr_stream_region_origin(ScreenSize, designOrigin, columns, rows);
    ivec2 slotOrigin = shadr_stream_slot_origin(regionOrigin, slot, columns);
    vec2 pixel = vec2(slotOrigin) + vec2(uv.x, 1.0 - uv.y) * float(SHADR_MAP_EDGE);
    vec2 ndc = pixel / ScreenSize * 2.0 - 1.0;

    shadrMode = SHADR_MODE_STREAM;
    gl_Position = vec4(ndc, shadr_depth(SHADR_STREAM_DEPTH), 1.0);
    return true;
}
