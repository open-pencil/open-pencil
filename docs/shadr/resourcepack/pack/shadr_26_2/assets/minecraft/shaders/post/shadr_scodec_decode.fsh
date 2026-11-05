#version 330

#moj_import <shadr_stream.glsl>

uniform sampler2D InSampler;
uniform sampler2D PrevSampler;
uniform sampler2D StateSampler;

layout(std140) uniform ShadrStreamConfig {
    vec4 Region;
    vec4 Layout;
};

in vec2 texCoord;
out vec4 fragColor;

ivec3 shadr_prev_pixel(ivec2 fp) {
    ivec2 t = clamp(
        ivec2(fp.x, SHADR_FRAME_HEIGHT - 1 - fp.y),
        ivec2(0),
        ivec2(SHADR_FRAME_WIDTH - 1, SHADR_FRAME_HEIGHT - 1));
    return ivec3(round(texelFetch(PrevSampler, t, 0).rgb * 255.0));
}

ivec3 shadr_prev_half(ivec2 fp, int mvx, int mvy) {
    ivec2 base = fp + ivec2(mvx >> 1, mvy >> 1);
    int fx = mvx & 1;
    int fy = mvy & 1;
    ivec3 c00 = shadr_prev_pixel(base);
    if (fx == 0 && fy == 0) return c00;
    if (fy == 0) return (c00 + shadr_prev_pixel(base + ivec2(1, 0)) + 1) >> 1;
    if (fx == 0) return (c00 + shadr_prev_pixel(base + ivec2(0, 1)) + 1) >> 1;
    ivec3 h1 = (c00 + shadr_prev_pixel(base + ivec2(1, 0)) + 1) >> 1;
    ivec3 h2 = (shadr_prev_pixel(base + ivec2(0, 1)) + shadr_prev_pixel(base + ivec2(1, 1)) + 1) >> 1;
    return (h1 + h2 + 1) >> 1;
}

void main() {
    ivec4 st = ivec4(round(texelFetch(StateSampler, ivec2(0, 0), 0) * 255.0));
    ivec2 t = clamp(
        ivec2(floor(texCoord * vec2(float(SHADR_FRAME_WIDTH), float(SHADR_FRAME_HEIGHT)))),
        ivec2(0),
        ivec2(SHADR_FRAME_WIDTH - 1, SHADR_FRAME_HEIGHT - 1));

    if (st.a < 128) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    if (st.b < 1) {
        fragColor = texelFetch(PrevSampler, t, 0);
        return;
    }

    ivec2 fp = ivec2(t.x, SHADR_FRAME_HEIGHT - 1 - t.y);
    vec2 screenSize = vec2(textureSize(InSampler, 0));
    int columns = int(Region.z + 0.5);
    int rows = int(Region.w + 0.5);
    ivec2 origin = shadr_stream_region_origin(screenSize, Region.xy, columns, rows);

    int cu = (fp.y / SHADR_CU) * SHADR_CU_COLUMNS + fp.x / SHADR_CU;
    int base = cu * SHADR_CU_PLANE_WORDS;
    int mode = shadr_cu_arena(InSampler, origin, columns, base);
    if (mode > SHADR_CU_MODE_INTRA) mode = SHADR_CU_MODE_SKIP;

    ivec3 outc;
    if (mode == SHADR_CU_MODE_SKIP) {
        outc = shadr_prev_pixel(fp);
    } else if (mode == SHADR_CU_MODE_MC) {
        int dx = clamp(shadr_cu_arena(InSampler, origin, columns, base + 1) - SHADR_CU_MV_BIAS, -32, 32);
        int dy = clamp(shadr_cu_arena(InSampler, origin, columns, base + 2) - SHADR_CU_MV_BIAS, -32, 32);
        outc = shadr_prev_half(fp, dx, dy);
    } else if (mode == SHADR_CU_MODE_SPLIT || mode == SHADR_CU_MODE_RESIDUAL) {
        int q = ((fp.y % SHADR_CU) / SHADR_CU_SUB) * 2 + (fp.x % SHADR_CU) / SHADR_CU_SUB;
        int sat = SHADR_CU_SPLIT_BASE + cu * SHADR_CU_SPLIT_WORDS + q * 2;
        int sx = clamp(shadr_cu_arena(InSampler, origin, columns, sat) - SHADR_CU_MV_BIAS, -32, 32);
        int sy = clamp(shadr_cu_arena(InSampler, origin, columns, sat + 1) - SHADR_CU_MV_BIAS, -32, 32);
        outc = shadr_prev_half(fp, sx, sy);
        if (mode == SHADR_CU_MODE_RESIDUAL) {
            int rat = SHADR_CU_RESIDUAL_BASE + cu * SHADR_CU_RESIDUAL_WORDS
                    + q * (SHADR_CU_KEPT * SHADR_CU_KEPT + 3);
            int px = fp.x % SHADR_CU_RES_BLOCK;
            int py = fp.y % SHADR_CU_RES_BLOCK;
            int d = 0;
            for (int kv = 0; kv < SHADR_CU_KEPT; kv++) {
                int sv = SHADR_CU_SIGN[py * SHADR_CU_KEPT + kv];
                for (int ku = 0; ku < SHADR_CU_KEPT; ku++) {
                    int c = shadr_cu_arena(InSampler, origin, columns, rat + kv * SHADR_CU_KEPT + ku)
                            - SHADR_CU_RESIDUAL_BIAS;
                    if (c != 0) {
                        d += c * SHADR_CU_LUMA_STEP * SHADR_CU_SIGN[px * SHADR_CU_KEPT + ku] * sv;
                    }
                }
            }
            int cbase = rat + SHADR_CU_KEPT * SHADR_CU_KEPT;
            int dr = (shadr_cu_arena(InSampler, origin, columns, cbase) - SHADR_CU_RESIDUAL_BIAS) * SHADR_CU_CHROMA_STEP;
            int dg = (shadr_cu_arena(InSampler, origin, columns, cbase + 1) - SHADR_CU_RESIDUAL_BIAS) * SHADR_CU_CHROMA_STEP;
            int db = (shadr_cu_arena(InSampler, origin, columns, cbase + 2) - SHADR_CU_RESIDUAL_BIAS) * SHADR_CU_CHROMA_STEP;
            outc = clamp(outc + ivec3(d + dr, d + dg, d + db), ivec3(0), ivec3(255));
        }
    } else {
        int entry = shadr_cu_arena(InSampler, origin, columns, base + 3)
                | (shadr_cu_arena(InSampler, origin, columns, base + 4) << 7);
        int rec = SHADR_CU_POOL_BASE + entry * SHADR_CU_POOL_ENTRY_WORDS
                + (((fp.y % SHADR_CU) / 4) * 4 + (fp.x % SHADR_CU) / 4) * 10;
        int lo = shadr_cu_join32(
            shadr_cu_arena(InSampler, origin, columns, rec),
            shadr_cu_arena(InSampler, origin, columns, rec + 1),
            shadr_cu_arena(InSampler, origin, columns, rec + 2),
            shadr_cu_arena(InSampler, origin, columns, rec + 3),
            shadr_cu_arena(InSampler, origin, columns, rec + 4));
        int hi = shadr_cu_join32(
            shadr_cu_arena(InSampler, origin, columns, rec + 5),
            shadr_cu_arena(InSampler, origin, columns, rec + 6),
            shadr_cu_arena(InSampler, origin, columns, rec + 7),
            shadr_cu_arena(InSampler, origin, columns, rec + 8),
            shadr_cu_arena(InSampler, origin, columns, rec + 9));
        int e0 = lo & 0xFFFF;
        int e1 = (lo >> 16) & 0xFFFF;
        ivec3 c0 = shadr_cu_endpoint(e0);
        ivec3 c1 = shadr_cu_endpoint(e1);
        int choice = (hi >> ((fp.y % 4) * 8 + (fp.x % 4) * 2)) & 3;
        if (choice == 0) {
            outc = c0;
        } else if (choice == 1) {
            outc = c1;
        } else if (e0 > e1) {
            outc = choice == 2 ? (2 * c0 + c1) / 3 : (c0 + 2 * c1) / 3;
        } else {
            outc = choice == 2 ? (c0 + c1) / 2 : ivec3(0);
        }
    }
    fragColor = vec4(vec3(outc) / 255.0, 1.0);
}
