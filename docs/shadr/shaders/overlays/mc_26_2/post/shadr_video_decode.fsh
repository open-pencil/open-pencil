#version 330

#moj_import <minecraft:globals.glsl>
#moj_import <shadr_video.glsl>

uniform sampler2D PrevSampler;
uniform sampler2D DataSampler;
uniform sampler2D StateSampler;
uniform sampler2D LastStateSampler;

layout(std140) uniform ShadrVideoConfig {
    vec4 Geometry;
    vec4 Playback;
};

in vec2 texCoord;
out vec4 fragColor;

#define MOSAIC_SUPER 32
#define MOSAIC_BLOCK 8
#define MOSAIC_BLOCKS_PER_SUPER_EDGE 4
#define MOSAIC_SHEET_EDGE 4096

#define MOSAIC_SB_SKIP 0
#define MOSAIC_SB_MOTION 2
#define MOSAIC_BLK_SKIP 0
#define MOSAIC_BLK_MOTION 1
#define MOSAIC_BLK_DELTA 2
#define MOSAIC_BLK_INTRA 3
#define MOSAIC_BLK_MOTION_DELTA 4
#define MOSAIC_BLK_MOTION_RESIDUAL 5
#define MOSAIC_BLK_ENDPOINT_REUSE 6
#define MOSAIC_BLK_INTRA_VQ 7
#define MOSAIC_MV_BIAS 128
#define MOSAIC_RESIDUAL_BIAS 128
#define MOSAIC_HEADER_TEXELS 2
#define MOSAIC_CODEBOOK 4096

const int MOSAIC_PAYLOAD_TEXELS[8] = int[8](0, 0, 4, 8, 4, 8, 4, 4);
const int MOSAIC_COMMAND_TEXELS[8] = int[8](0, 1, 0, 0, 1, 1, 1, 0);

ivec4 mosaic_fetch(int index) {
    return ivec4(round(texelFetch(
        DataSampler,
        ivec2(index % MOSAIC_SHEET_EDGE, index / MOSAIC_SHEET_EDGE),
        0) * 255.0));
}

int mosaic_pointer(ivec4 texel) {
    return (texel.g << 16) | (texel.b << 8) | texel.a;
}

ivec3 mosaic_previous(ivec2 size, int x, int y) {
    int cx = clamp(x, 0, size.x - 1);
    int cy = clamp(y, 0, size.y - 1);
    return ivec3(round(texelFetch(PrevSampler, ivec2(cx, size.y - 1 - cy), 0).rgb * 255.0));
}

ivec3 mosaic_expand565(int packedBits) {
    int r = (packedBits >> 11) & 31;
    int g = (packedBits >> 5) & 63;
    int b = packedBits & 31;
    return ivec3((r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2));
}

ivec3 mosaic_palette(int e0, int e1, int pick) {
    ivec3 c0 = mosaic_expand565(e0);
    ivec3 c1 = mosaic_expand565(e1);
    if (pick == 0) return c0;
    if (pick == 1) return c1;
    if (e0 > e1) {
        if (pick == 2) return (2 * c0 + c1) / 3;
        return (c0 + 2 * c1) / 3;
    }
    if (pick == 2) return (c0 + c1) / 2;
    return ivec3(0);
}

int mosaic_pick(ivec4 indices, int x, int y) {
    int row = y % 4 == 0 ? indices.r
        : (y % 4 == 1 ? indices.g : (y % 4 == 2 ? indices.b : indices.a));
    return (row >> ((x % 4) * 2)) & 3;
}

ivec3 mosaic_bc1(ivec4 endpoints, ivec4 indices, int x, int y) {
    int e0 = (endpoints.g << 8) | endpoints.r;
    int e1 = (endpoints.a << 8) | endpoints.b;
    return mosaic_palette(e0, e1, mosaic_pick(indices, x, y));
}

void main() {
    ivec2 size = ivec2(Geometry.xy);
    int superColumns = int(Geometry.z);
    int superblocksPerFrame = int(Geometry.w);

    ivec4 state = ivec4(round(texelFetch(StateSampler, ivec2(0), 0) * 255.0));
    ivec4 last = ivec4(round(texelFetch(LastStateSampler, ivec2(0), 0) * 255.0));

    int frame = (state.r << 16) | (state.g << 8) | state.b;

    ivec2 pixel = ivec2(gl_FragCoord.xy);
    int x = pixel.x;
    int y = size.y - 1 - pixel.y;

    if (last.a > 127 && state.rgb == last.rgb) {
        fragColor = vec4(vec3(mosaic_previous(size, x, y)) / 255.0, 1.0);
        return;
    }

    ivec4 plane = mosaic_fetch(
        frame * superblocksPerFrame + (y / MOSAIC_SUPER) * superColumns + (x / MOSAIC_SUPER));

    ivec3 colour;
    if (plane.r == MOSAIC_SB_SKIP) {
        colour = mosaic_previous(size, x, y);
    } else if (plane.r == MOSAIC_SB_MOTION) {
        colour = mosaic_previous(size, x + plane.g - MOSAIC_MV_BIAS, y + plane.b - MOSAIC_MV_BIAS);
    } else {
        int base = mosaic_pointer(plane);
        ivec4 h0 = mosaic_fetch(base);
        ivec4 h1 = mosaic_fetch(base + 1);
        int block =
            ((y % MOSAIC_SUPER) / MOSAIC_BLOCK) * MOSAIC_BLOCKS_PER_SUPER_EDGE +
            ((x % MOSAIC_SUPER) / MOSAIC_BLOCK);

        int mode = 0;
        int commandSlot = 0;
        int payloadOffset = 0;
        int commands = 0;
        for (int j = 0; j < 16; j++) {
            ivec4 header = j < 8 ? h0 : h1;
            int n = (header[(j & 7) >> 1] >> ((j & 1) * 4)) & 15;
            if (j == block) {
                mode = n;
                commandSlot = commands;
            }
            if (j < block) payloadOffset += MOSAIC_PAYLOAD_TEXELS[n];
            commands += MOSAIC_COMMAND_TEXELS[n];
        }

        int commandAt = base + MOSAIC_HEADER_TEXELS + commandSlot;
        int payloadAt = base + MOSAIC_HEADER_TEXELS + commands + payloadOffset;
        int quarter = ((y % MOSAIC_BLOCK) / 4) * 2 + ((x % MOSAIC_BLOCK) / 4);

        if (mode == MOSAIC_BLK_SKIP) {
            colour = mosaic_previous(size, x, y);
        } else if (mode == MOSAIC_BLK_MOTION) {
            ivec4 command = mosaic_fetch(commandAt);
            colour = mosaic_previous(
                size, x + command.r - MOSAIC_MV_BIAS, y + command.g - MOSAIC_MV_BIAS);
        } else if (mode == MOSAIC_BLK_DELTA) {
            ivec4 offset = mosaic_fetch(payloadAt + quarter);
            colour = clamp(mosaic_previous(size, x, y) + offset.rgb - MOSAIC_MV_BIAS, 0, 255);
        } else if (mode == MOSAIC_BLK_MOTION_DELTA) {
            ivec4 command = mosaic_fetch(commandAt);
            ivec4 offset = mosaic_fetch(payloadAt + quarter);
            colour = clamp(
                mosaic_previous(
                    size, x + command.r - MOSAIC_MV_BIAS, y + command.g - MOSAIC_MV_BIAS) +
                    offset.rgb - MOSAIC_MV_BIAS,
                0, 255);
        } else if (mode == MOSAIC_BLK_INTRA) {
            colour = mosaic_bc1(
                mosaic_fetch(payloadAt + quarter * 2),
                mosaic_fetch(payloadAt + quarter * 2 + 1),
                x, y);
        } else if (mode == MOSAIC_BLK_MOTION_RESIDUAL) {
            ivec4 command = mosaic_fetch(commandAt);
            ivec3 residual = mosaic_bc1(
                mosaic_fetch(payloadAt + quarter * 2),
                mosaic_fetch(payloadAt + quarter * 2 + 1),
                x, y);
            colour = clamp(
                mosaic_previous(
                    size, x + command.r - MOSAIC_MV_BIAS, y + command.g - MOSAIC_MV_BIAS) +
                    residual - MOSAIC_RESIDUAL_BIAS,
                0, 255);
        } else if (mode == MOSAIC_BLK_ENDPOINT_REUSE) {
            ivec4 command = mosaic_fetch(commandAt);
            colour = mosaic_bc1(
                mosaic_fetch(mosaic_pointer(command) + quarter * 2),
                mosaic_fetch(payloadAt + quarter),
                x, y);
        } else {
            ivec4 payload = mosaic_fetch(payloadAt + quarter);
            int codebook = int(Playback.w);
            colour = mosaic_bc1(
                mosaic_fetch(codebook + (payload.r | (payload.g << 8))),
                mosaic_fetch(codebook + MOSAIC_CODEBOOK + (payload.b | (payload.a << 8))),
                x, y);
        }
    }

    fragColor = vec4(vec3(colour) / 255.0, 1.0);
}
