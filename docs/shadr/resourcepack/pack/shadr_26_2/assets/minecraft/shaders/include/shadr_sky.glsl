/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#define SHADR_PI  3.14159265359
#define SHADR_TAU 6.28318530718

float shadr_sky_hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

float shadr_air_mass(float cosZenith) {
    float z = clamp(cosZenith, -1.0, 1.0);
    float deg = degrees(acos(z));
    return 1.0 / max(z + 0.15 * pow(max(93.885 - deg, 1.0e-3), -1.253), 1.0e-4);
}

float shadr_dither(vec2 fragCoord) {
    return (fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
}
