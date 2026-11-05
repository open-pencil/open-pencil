/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#moj_import <shadr_profile.glsl>

#define SHADR_NEAR 0.05

#define SHADR_UI_DEPTH 0.94

#define SHADR_PI 3.14159265359

#define SHADR_LUMA vec3(0.2126, 0.7152, 0.0722)

#if SHADR_REVERSED_DEPTH
bool shadr_is_ui(float depth) { return depth >= SHADR_UI_DEPTH; }
bool shadr_is_sky(float depth) { return depth <= 0.0000001; }
float shadr_linear_depth(float depth) {
    return depth <= 0.0000001 ? 1.0e6 : SHADR_NEAR / depth;
}
#else
bool shadr_is_ui(float depth) { return false; }
bool shadr_is_sky(float depth) { return depth >= 0.9999999; }
float shadr_linear_depth(float depth) {
    return depth >= 0.9999999 ? 1.0e6 : SHADR_NEAR / max(1.0 - depth, 0.0000001);
}
#endif

vec2 shadr_half_extent(float fovDegrees, vec2 size) {
    float tanHalf = tan(radians(fovDegrees) * 0.5);
    return vec2(tanHalf * (size.x / max(size.y, 1.0)), tanHalf);
}

vec3 shadr_view_pos(vec2 uv, float depth, vec2 halfExtent) {
    float z = shadr_linear_depth(depth);
    vec2 ndc = uv * 2.0 - 1.0;
    return vec3(ndc * halfExtent * z, -z);
}

vec3 shadr_normal_from_depth(sampler2D depthSampler, vec2 uv, vec2 texel, vec2 halfExtent) {
    float centre = texture(depthSampler, uv).r;
    vec3 p = shadr_view_pos(uv, centre, halfExtent);

    float rightD = texture(depthSampler, uv + vec2(texel.x, 0.0)).r;
    float leftD = texture(depthSampler, uv - vec2(texel.x, 0.0)).r;
    float upD = texture(depthSampler, uv + vec2(0.0, texel.y)).r;
    float downD = texture(depthSampler, uv - vec2(0.0, texel.y)).r;

    vec3 dx = abs(shadr_linear_depth(rightD) - shadr_linear_depth(centre)) <
              abs(shadr_linear_depth(centre) - shadr_linear_depth(leftD))
        ? shadr_view_pos(uv + vec2(texel.x, 0.0), rightD, halfExtent) - p
        : p - shadr_view_pos(uv - vec2(texel.x, 0.0), leftD, halfExtent);

    vec3 dy = abs(shadr_linear_depth(upD) - shadr_linear_depth(centre)) <
              abs(shadr_linear_depth(centre) - shadr_linear_depth(downD))
        ? shadr_view_pos(uv + vec2(0.0, texel.y), upD, halfExtent) - p
        : p - shadr_view_pos(uv - vec2(0.0, texel.y), downD, halfExtent);

    return normalize(cross(dx, dy));
}

vec2 shadr_project(vec3 viewPos, vec2 halfExtent) {
    vec2 ndc = viewPos.xy / max(-viewPos.z, 0.0001) / halfExtent;
    return ndc * 0.5 + 0.5;
}

float shadr_luma(vec3 colour) { return dot(colour, SHADR_LUMA); }

float shadr_hash12(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

vec3 shadr_tonemap_reinhard(vec3 c) { return c / (1.0 + c); }

vec3 shadr_tonemap_aces(vec3 c) {
    const float a = 2.51, b = 0.03, y = 2.43, d = 0.59, e = 0.14;
    return clamp((c * (a * c + b)) / (c * (y * c + d) + e), 0.0, 1.0);
}

vec3 shadr_tonemap_filmic(vec3 c) {
    vec3 x = max(vec3(0.0), c - 0.004);
    return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
}

vec3 shadr_hable_partial(vec3 x) {
    const float a = 0.15, b = 0.50, c = 0.10, d = 0.20, e = 0.02, f = 0.30;
    return ((x * (a * x + c * b) + d * e) / (x * (a * x + b) + d * f)) - e / f;
}

vec3 shadr_tonemap_hable(vec3 c) {
    vec3 white = shadr_hable_partial(vec3(11.2));
    return clamp(shadr_hable_partial(c * 2.0) / white, 0.0, 1.0);
}

vec3 shadr_tonemap(vec3 c, int mode) {
    if (mode == 1) return shadr_tonemap_reinhard(c);
    if (mode == 2) return shadr_tonemap_aces(c);
    if (mode == 3) return shadr_tonemap_filmic(c);
    if (mode == 4) return shadr_tonemap_hable(c);
    return clamp(c, 0.0, 1.0);
}
