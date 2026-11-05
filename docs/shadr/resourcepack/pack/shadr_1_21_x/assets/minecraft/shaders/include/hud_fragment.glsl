/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#moj_import <shadr_profile.glsl>

#define SHADR_FIELD_RANGE 4.0

#define SHADR_BLUR_KEY vec3(0.0, 0.047058824, 0.011764706)

in float shadrMode;

float shadr_mode() {
    return floor(shadrMode + 0.5);
}

bool shadr_has_mode(float bit) {
    return mod(floor(shadr_mode() / bit), 2.0) >= 1.0;
}

bool shadr_is_field() {
    return shadr_has_mode(2.0);
}

bool shadr_is_blur_panel() {
#if SHADR_BLUR_PANELS
    return shadr_has_mode(4.0);
#else
    return false;
#endif
}

bool shadr_is_stream() {
#if SHADR_MAP_STREAM
    return shadr_has_mode(8.0);
#else
    return false;
#endif
}

float shadr_median(vec3 field) {
    return max(min(field.r, field.g), min(max(field.r, field.g), field.b));
}

vec3 shadr_sample_field(sampler2D atlas, vec2 uv, vec2 atlasSize) {
    vec2 texel = uv * atlasSize - 0.5;
    vec2 f = fract(texel);
    vec2 base = floor(texel) + 0.5;

    vec3 s00 = textureLod(atlas, (base + vec2(0.0, 0.0)) / atlasSize, 0.0).rgb;
    vec3 s10 = textureLod(atlas, (base + vec2(1.0, 0.0)) / atlasSize, 0.0).rgb;
    vec3 s01 = textureLod(atlas, (base + vec2(0.0, 1.0)) / atlasSize, 0.0).rgb;
    vec3 s11 = textureLod(atlas, (base + vec2(1.0, 1.0)) / atlasSize, 0.0).rgb;

    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
}

float shadr_field_alpha(vec3 field, float texelsPerPixel) {
    float distance = (shadr_median(field) - 0.5) * SHADR_FIELD_RANGE;
    return clamp(distance / max(texelsPerPixel, 0.0001) + 0.5, 0.0, 1.0);
}

float shadr_texels_per_pixel(vec2 uvDerivative, vec2 atlasSize) {
    return max(max(uvDerivative.x * atlasSize.x, uvDerivative.y * atlasSize.y), 0.0001);
}
