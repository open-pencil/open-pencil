#version 330

#moj_import <minecraft:globals.glsl>
#moj_import <shadr_video.glsl>

uniform sampler2D StateSampler;

layout(std140) uniform ShadrVideoConfig {
    vec4 Geometry;
    vec4 Playback;
};

in vec2 texCoord;
out vec4 fragColor;


#define SHADR_VIDEO_PRIMED 255

int shadr_video_unpack24(ivec4 texel) {
    return (texel.r << 16) | (texel.g << 8) | texel.b;
}

vec4 shadr_video_pack24(int value, int alpha) {
    return vec4(
        float((value >> 16) & 0xFF) / 255.0,
        float((value >> 8) & 0xFF) / 255.0,
        float(value & 0xFF) / 255.0,
        float(alpha) / 255.0);
}

void main() {
    float frameCount = max(Playback.x, 1.0);
    int total = int(frameCount);

    ivec4 storedPosition = ivec4(round(texelFetch(StateSampler, ivec2(0, 0), 0) * 255.0));
    ivec4 storedClock = ivec4(round(texelFetch(StateSampler, ivec2(1, 0), 0) * 255.0));

    bool primed = storedPosition.a > 127;
    int at = shadr_video_unpack24(storedPosition);
    int lastClock = shadr_video_unpack24(storedClock);

    int clock = shadr_video_target_frame(
        GameTime, frameCount, max(Playback.y, 1.0), Playback.z);

    int next;
    if (!primed || at >= total) {
        // Nothing decoded yet
        next = 0;
    } else if (clock == lastClock) {
        next = at;
    } else {
        next = at + 1 >= total ? 0 : at + 1;
    }

    fragColor = int(gl_FragCoord.x) == 0
        ? shadr_video_pack24(next, SHADR_VIDEO_PRIMED)
        : shadr_video_pack24(clock, SHADR_VIDEO_PRIMED);
}
