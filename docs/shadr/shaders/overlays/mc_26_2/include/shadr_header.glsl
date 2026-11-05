/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#moj_import <shadr_sun.glsl>

/**
 * Layout: 16 values of 16 bits, 6 bits per pixel, 43 pixels.
 *   [0] magic 0xA55A
 *   [1] tanHalfFovX * 4096      [2] tanHalfFovY * 4096
 *   [3..5] celestial direction in view space, biased to [0,1]
 *   [6..14] view-to-world basis, column major, biased to [0,1]
 *   [15] xor checksum of values 0..14
 */
#define SHADR_HEADER_PIXELS 43
#define SHADR_HEADER_VALUES 16
#define SHADR_HEADER_MAGIC 0xA55Au

uint shadr_header_u16(float raw) {
    return uint(clamp(raw, 0.0, 65535.0) + 0.5);
}

uint shadr_header_biased(float value) {
    return shadr_header_u16((clamp(value, -1.0, 1.0) * 0.5 + 0.5) * 65535.0);
}

void shadr_header_values(mat3 modelView, mat4 projMat, float gameTime, out uint values[SHADR_HEADER_VALUES]) {
    float dayFactor;
    vec3 celestialView = modelView * shadr_celestial_world(gameTime, dayFactor);
    mat3 basis = transpose(modelView);

    values[0] = SHADR_HEADER_MAGIC;
    values[1] = shadr_header_u16(clamp(1.0 / projMat[0][0], 0.0, 15.9) * 4096.0);
    values[2] = shadr_header_u16(clamp(1.0 / projMat[1][1], 0.0, 15.9) * 4096.0);
    values[3] = shadr_header_biased(celestialView.x);
    values[4] = shadr_header_biased(celestialView.y);
    values[5] = shadr_header_biased(celestialView.z);
    for (int c = 0; c < 3; c++) {
        for (int r = 0; r < 3; r++) {
            values[6 + c * 3 + r] = shadr_header_biased(basis[c][r]);
        }
    }
    uint checksum = 0u;
    for (int i = 0; i < 15; i++) checksum ^= values[i];
    values[15] = checksum;
}

float shadr_header_inject(float channel, uint twoBits) {
    uint byteValue = uint(clamp(channel, 0.0, 1.0) * 255.0 + 0.5);
    return float((byteValue & 0xFCu) | twoBits) / 255.0;
}

vec4 shadr_header_write(vec4 color, vec2 fragCoord, mat3 modelView, mat4 projMat, float gameTime) {
    if (fragCoord.y >= 1.0 || fragCoord.x >= float(SHADR_HEADER_PIXELS)) return color;

    uint values[SHADR_HEADER_VALUES];
    shadr_header_values(modelView, projMat, gameTime, values);

    uint pixel = uint(fragCoord.x);
    vec3 rgb = color.rgb;
    for (uint c = 0u; c < 3u; c++) {
        uint two = 0u;
        for (uint sub = 0u; sub < 2u; sub++) {
            uint bitIndex = pixel * 6u + c * 2u + sub;
            if (bitIndex >= 256u) continue;
            uint bit = (values[bitIndex >> 4u] >> (bitIndex & 15u)) & 1u;
            two |= bit << sub;
        }
        rgb[int(c)] = shadr_header_inject(rgb[int(c)], two);
    }
    return vec4(rgb, color.a);
}

bool shadr_header_read(sampler2D header, out mat3 basis, out vec2 tanHalf, out vec3 celestialView) {
    uint values[SHADR_HEADER_VALUES];
    for (int i = 0; i < SHADR_HEADER_VALUES; i++) values[i] = 0u;

    for (int p = 0; p < SHADR_HEADER_PIXELS; p++) {
        vec3 rgb = texelFetch(header, ivec2(p, 0), 0).rgb;
        for (int c = 0; c < 3; c++) {
            uint two = uint(clamp(rgb[c], 0.0, 1.0) * 255.0 + 0.5) & 3u;
            for (int sub = 0; sub < 2; sub++) {
                int bitIndex = p * 6 + c * 2 + sub;
                if (bitIndex >= 256) continue;
                values[bitIndex >> 4] |= ((two >> uint(sub)) & 1u) << uint(bitIndex & 15);
            }
        }
    }

    basis = mat3(1.0);
    tanHalf = vec2(0.7002);
    celestialView = vec3(0.0, 1.0, 0.0);

    if (values[0] != SHADR_HEADER_MAGIC) return false;
    uint checksum = 0u;
    for (int i = 0; i < 15; i++) checksum ^= values[i];
    if (checksum != values[15]) return false;

    tanHalf = vec2(float(values[1]), float(values[2])) / 4096.0;
    if (tanHalf.x <= 0.01 || tanHalf.y <= 0.01) return false;

    celestialView = normalize(vec3(
        float(values[3]) / 65535.0 * 2.0 - 1.0,
        float(values[4]) / 65535.0 * 2.0 - 1.0,
        float(values[5]) / 65535.0 * 2.0 - 1.0));

    for (int c = 0; c < 3; c++) {
        basis[c] = vec3(
            float(values[6 + c * 3 + 0]) / 65535.0 * 2.0 - 1.0,
            float(values[6 + c * 3 + 1]) / 65535.0 * 2.0 - 1.0,
            float(values[6 + c * 3 + 2]) / 65535.0 * 2.0 - 1.0);
        basis[c] = normalize(basis[c]);
    }
    return true;
}
