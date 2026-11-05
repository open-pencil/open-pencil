/*
 * Copyright © 2026 theDevJade
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 * SPDX-License-Identifier: Apache-2.0
 */
#define SHADR_VIDEO_MARKER_ALPHA 250
#define SHADR_VIDEO_KEY_BITS 4
#define SHADR_VIDEO_UV_MAX 1023
// Kept narrow so two coincidental key matches on sharp content (text edges) rarely
// also land close in uv - see VideoFormat.UV_CONTINUITY for the full rationale.
#define SHADR_VIDEO_UV_CONTINUITY 16

#define SHADR_VIDEO_CYCLE 1200.0

float shadr_video_time(float gameTime) {
    return gameTime * SHADR_VIDEO_CYCLE;
}

float shadr_video_period(float seconds) {
    return SHADR_VIDEO_CYCLE / max(1.0, floor(SHADR_VIDEO_CYCLE / max(seconds, 1e-4) + 0.5));
}

int shadr_video_target_frame(float gameTime, float frameCount, float fps, float start) {
    float period = shadr_video_period(frameCount / fps);
    float phase = fract((shadr_video_time(gameTime) - start) / period);
    return int(min(floor(phase * frameCount), frameCount - 1.0));
}

/**
 * The tag the top SHADR_VIDEO_KEY_BITS of red carry, for a pixel at the given
 * framebuffer coordinate.
 *
 * A tag with one fixed value would claim a fraction of every colour the world can
 * produce - the sky sits in one red bucket, and a gradient that smooth also
 * satisfies the neighbour test, so the composite pass would swap the sky for
 * video. Keying the tag to the pixel's own position in a tile instead means a
 * region whose red channel is locally flat, or a smooth ramp, can only ever match
 * on a fraction of its pixels - never on their neighbours, which is what the
 * composite pass requires.
 *
 * Widened from a 2x2 tile (2 bits, 1/4 odds) to 4x4 (4 bits, 1/16 odds) after 2
 * bits proved not enough: that proof only covers SLOW, smooth content. A SHARP
 * edge (anti-aliased text, changing over 1-2px) can jump far enough in a single
 * step to land in whatever bucket a given pixel happens to need, and a page of
 * text has thousands of edges to get lucky across. The alpha channel was
 * considered as a place to hide extra check bits instead of spending uv
 * precision, but item.fsh's pipeline supports real alpha blending (its
 * ALPHA_CUTOUT path), so any alpha other than opaque 1.0 gets blended into the
 * marker's RGB by the GPU before this shader ever reads it back - unusable for a
 * checksum. The key has to live in bits that stay opaque, which means paying for
 * it out of uv precision.
 */
int shadr_video_key(ivec2 pixel) {
    return ((pixel.x & 3) << 2) | (pixel.y & 3);
}

vec3 shadr_video_pack(vec2 uv, ivec2 pixel) {
    ivec2 q = ivec2(round(clamp(uv, 0.0, 1.0) * float(SHADR_VIDEO_UV_MAX)));
    return vec3(
        float((shadr_video_key(pixel) << 4) | (q.x >> 6)),
        float(((q.x & 0x3F) << 2) | (q.y >> 8)),
        float(q.y & 0xFF)
    ) / 255.0;
}

ivec2 shadr_video_unpack(vec3 colour, ivec2 pixel) {
    ivec3 c = ivec3(round(colour * 255.0));
    if ((c.r >> 4) != shadr_video_key(pixel)) {
        return ivec2(-1);
    }
    return ivec2(((c.r & 0x0F) << 6) | (c.g >> 2), ((c.g & 0x03) << 8) | c.b);
}

bool shadr_video_adjoins(ivec2 centre, vec3 colour, ivec2 pixel) {
    ivec2 n = shadr_video_unpack(colour, pixel);
    if (n.x < 0) {
        return false;
    }
    ivec2 d = abs(n - centre);
    return d.x <= SHADR_VIDEO_UV_CONTINUITY && d.y <= SHADR_VIDEO_UV_CONTINUITY;
}
