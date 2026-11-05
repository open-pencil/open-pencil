/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
// @description A volumetric portal you can look into
// @preview 9d4cf0

#define PT_STEPS 56
#define PT_DEPTH 3.2
#define PT_APERTURE 0.86
#define PT_BORE 0.62
#define PT_TAPER 0.22

mat3 pt_frame() {
    vec3 ex = normalize(shadrQuadRight);
    vec3 ey = normalize(shadrQuadUp);
    return mat3(ex, ey, normalize(cross(ex, ey)));
}

float pt_density(vec3 q, float time) {
    float bore = PT_BORE * (1.0 - PT_TAPER * q.z);
    float twist = q.z * 1.15 - shadr_phase(time, 16.0) * SHADR_TAU;
    vec2 swirl = shadr_rotate(q.xy, twist);

    float wisp = shadr_fbm(vec2(
        atan(swirl.y, swirl.x) * 1.9,
        q.z * 1.5 - shadr_phase(time, 7.0) * 6.0
    ));

    float wall = abs(length(swirl) - bore - (wisp - 0.5) * 0.3);
    float shell = exp(-wall * 6.5);
    float spine = exp(-length(q.xy) * 3.4) * 0.35;

    float mouth = smoothstep(0.0, 0.5, q.z);
    float tail = 1.0 - smoothstep(PT_DEPTH * 0.6, PT_DEPTH, q.z);
    return (shell + spine) * mouth * tail;
}

vec4 shadr_main(vec2 uv, float time, vec4 tint) {
    vec2 p = shadr_centered(uv, vec2(shadr_aspect(uv), 1.0));

    float aperture = shadr_aa((length(p) - PT_APERTURE) * 2.4);
    float rim = exp(-abs(length(p) - PT_APERTURE) * 20.0);
    if (aperture < 0.001) return vec4(0.0);

    mat3 frame = pt_frame();
    float radius = max(shadr_quad_radius(), 1e-4);

    vec3 ro = (shadr_ray_origin() * frame) / radius;
    vec3 rd = normalize(shadr_ray_dir() * frame);

    float side = rd.z < 0.0 ? -1.0 : 1.0;
    ro.z *= side;
    rd.z *= side;

    float forward = max(rd.z, 1e-3);
    float entry = max(-ro.z / forward, 0.0);
    float stride = PT_DEPTH / (float(PT_STEPS) * max(rd.z, 0.35));

    vec3 glow = vec3(0.0);
    float clarity = 1.0;

    for (int i = 0; i < PT_STEPS; i++) {
        vec3 q = ro + rd * (entry + stride * float(i));
        if (q.z > PT_DEPTH) break;

        float absorb = pt_density(q, time) * stride;
        vec3 emit = mix(shadr_hsv(vec3(fract(0.66 + q.z * 0.07), 0.78, 1.0)), tint.rgb, 0.45);

        glow += emit * absorb * clarity;
        clarity *= exp(-absorb * 2.2);
        if (clarity < 0.01) break;
    }

    glow += tint.rgb * rim * 1.5;

    float alpha = clamp((1.0 - clarity) * 1.3 + rim, 0.0, 1.0) * aperture * tint.a;
    return shadr_resolve(glow, alpha);
}
