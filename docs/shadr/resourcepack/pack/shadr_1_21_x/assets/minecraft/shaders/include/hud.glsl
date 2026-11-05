/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#moj_import <shadr_profile.glsl>

#define X 1
#define Y 1
#define refRes vec2(1920.0, 1080.0)

#define SHADR_FIELD_BAND 100000.0

#define SHADR_BLUR_PANEL_Z 500000.0

#define SHADR_MODE_HUD 1.0
#define SHADR_MODE_FIELD 2.0
#define SHADR_MODE_BLUR 4.0
#define SHADR_MODE_STREAM 8.0

out float shadrMode;

bool is_hud(vec3 Position) {
    return (Position.y < -1000.0);
}

vec2 shadr_fit(vec2 screen) {
    float screenAspect = screen.x / screen.y;
    float designAspect = refRes.x / refRes.y;
    return screenAspect > designAspect
        ? vec2(designAspect / screenAspect, 1.0)
        : vec2(1.0, screenAspect / designAspect);
}

bool shadr_z_zero_to_one() {
    return ProjMat[2][2] < 0.5;
}

float shadr_depth(float depth01) {
    return shadr_z_zero_to_one() ? depth01 : depth01 * 2.0 - 1.0;
}

#define SHADR_HEADER_BAND -180000.0

bool make_hud() {
    shadrMode = 0.0;

    if (Position.y < SHADR_HEADER_BAND) {
        gl_Position = vec4(0.0, 0.0, -10.0, 1.0);
        return true;
    }

    if (is_hud(Position)) {
        float y = Position.y;
        shadrMode = SHADR_MODE_HUD;
        if (y < -SHADR_FIELD_BAND) {
            y += SHADR_FIELD_BAND;
            shadrMode += SHADR_MODE_FIELD;
        }

        if (abs(Position.z - SHADR_BLUR_PANEL_Z) < 1.0) {
            shadrMode += SHADR_MODE_BLUR;
        }

        vec3 pos = vec3(Position.x, y, Position.z) + vec3(0.0, 15000.0, 0.0);
        pos.x *= -1.0;
        if (y < -20000.0) {
            if (y < -40000.0) {
                pos.y += 20000.0;
            } else if (y < -30000.0) {
                pos.y += 10000.0;
            }
            pos.y += 10000.0;
        }

        pos.xy /= refRes * vec2(X, Y) / 2.0;
        pos.xy *= shadr_fit(ScreenSize);
#if SHADR_REVERSED_DEPTH
        pos.z = shadr_depth(0.95 - (pos.z / 100000000.0));
#else
        pos.z /= 1000000.0;
#endif

        gl_Position = vec4(pos, 1.0);
        return true;
    }
    return false;
}
