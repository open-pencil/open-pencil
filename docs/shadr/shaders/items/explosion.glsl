/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
// @description A looping fireball, hot core to smoke
// @preview ff7a29

#define EX_SECONDS 2.4

vec4 shadr_main(vec2 uv, float time, vec4 tint) {
    float aspect = shadr_aspect(uv);
    vec2 p = shadr_centered(uv, vec2(aspect, 1.0));

    float t = shadr_phase(time, EX_SECONDS);

    float front = 0.18 + t * 0.78;
    float r = length(p);

    float churn = shadr_fbm(p * 3.4 + vec2(0.0, -t * 2.2));
    float edge = r + (churn - 0.5) * 0.34 * (0.35 + t);

    float body = shadr_aa((front - edge) * 6.0);
    if (body < 0.001) return vec4(0.0);

    float heat = clamp(1.0 - edge / max(front, 1e-3), 0.0, 1.0);
    heat *= 1.0 - t * 0.75;

    vec3 smoke = vec3(0.09, 0.08, 0.09);
    vec3 ember = shadr_hsv(vec3(0.06 - heat * 0.05, 0.85, 0.30 + heat * 0.7));
    vec3 core = mix(tint.rgb, vec3(1.0, 0.95, 0.82), heat * heat);

    vec3 colour = mix(smoke, ember, smoothstep(0.05, 0.45, heat));
    colour = mix(colour, core, smoothstep(0.55, 1.0, heat));

    float fade = 1.0 - smoothstep(0.7, 1.0, t);
    return shadr_resolve(colour, body * fade * tint.a);
}
