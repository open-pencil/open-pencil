/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#moj_import <shadr_world.glsl>

float shadr_vnoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = shadr_hash12(cell);
    float b = shadr_hash12(cell + vec2(1.0, 0.0));
    float c = shadr_hash12(cell + vec2(0.0, 1.0));
    float d = shadr_hash12(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float shadr_wave_height(vec2 p, float t) {
    float h = 0.0;
    h += sin(dot(p, vec2(0.16, 0.12)) * 6.0 + t * 1.9) * 0.45;
    h += sin(dot(p, vec2(-0.11, 0.17)) * 8.5 + t * 2.3) * 0.30;
    h += sin(dot(p, vec2(0.05, -0.21)) * 11.0 + t * 1.4) * 0.25;
    h += (shadr_vnoise(p * 0.9 + t * 0.15) - 0.5) * 0.8;
    return h;
}

vec3 shadr_wave_normal(vec2 worldXz, float t, float strength, float scale) {
    vec2 p = worldXz * scale;
    float e = 0.35;
    float hx = shadr_wave_height(p + vec2(e, 0.0), t) - shadr_wave_height(p - vec2(e, 0.0), t);
    float hz = shadr_wave_height(p + vec2(0.0, e), t) - shadr_wave_height(p - vec2(0.0, e), t);
    return normalize(vec3(-hx * strength, 2.0 * e, -hz * strength));
}

bool shadr_water_fingerprint(vec3 normalWorld, vec3 surfaceWorld) {
    if (normalWorld.y < 0.6) return false;
    float f = fract(surfaceWorld.y);
    return f > 0.76 && f < 0.95;
}

float shadr_caustic(vec2 worldXz, float t) {
    float n1 = shadr_vnoise(worldXz * 1.7 + vec2(t * 0.70, t * 0.40));
    float n2 = shadr_vnoise(worldXz * 2.2 - vec2(t * 0.55, t * 0.62) + 7.31);
    float ridge = 1.0 - abs(n1 + n2 - 1.0);
    return pow(clamp(ridge, 0.0, 1.0), 6.0);
}

float shadr_foam_noise(vec2 worldXz, float t) {
    return 0.55 + 0.45 * shadr_vnoise(worldXz * 3.1 + vec2(t * 0.5, t * 0.35));
}
