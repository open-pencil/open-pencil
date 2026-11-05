/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#define SHADR_SHAPE_GRID 64.0

float shadr_rounded_box(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - (halfSize - radius);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec2 shadr_shape_uv(vec2 parameters, vec2 texCoord, vec2 atlasSize) {
    vec2 cell = floor(parameters * (SHADR_SHAPE_GRID - 1.0) + 0.5);
    vec2 within = fract(texCoord * atlasSize);
    return (cell + within) / SHADR_SHAPE_GRID;
}

float shadr_shape_alpha(vec2 uv, vec2 uvDerivative, vec2 atlasSize, float cornerFraction) {
    vec2 quadPixels = SHADR_SHAPE_GRID / max(uvDerivative * atlasSize, vec2(1e-6));
    vec2 halfPixels = quadPixels * 0.5;

    float radius = cornerFraction * min(halfPixels.x, halfPixels.y);
    float distance = shadr_rounded_box((uv - 0.5) * quadPixels, halfPixels, radius);

    return clamp(0.5 - distance, 0.0, 1.0);
}
