/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
vec3 shadr_sun_world(float gameTime) {
    float d = fract(gameTime - 0.25);
    float t = (d * 2.0 + (0.5 - cos(d * 3.14159265) * 0.5)) / 3.0;
    float a = t * 6.28318531;
    return vec3(-sin(a), cos(a), 0.0);
}

vec3 shadr_celestial_world(float gameTime, out float dayFactor) {
    vec3 sun = shadr_sun_world(gameTime);
    dayFactor = clamp(sun.y * 4.0 + 0.5, 0.0, 1.0);
    return sun.y >= 0.0 ? sun : -sun;
}
