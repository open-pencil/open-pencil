#version 330

#moj_import <shadr_video.glsl>

uniform sampler2D InSampler;
uniform sampler2D FrameSampler;

in vec2 texCoord;
out vec4 fragColor;

#define SHADR_VIDEO_DEBUG 0

void main() {
    vec4 scene = texture(InSampler, texCoord);

    ivec2 size = textureSize(InSampler, 0);
    ivec2 pixel = ivec2(texCoord * vec2(size));

    ivec2 packedBits = shadr_video_unpack(scene.rgb, pixel);
    if (packedBits.x < 0) {
        fragColor = scene;
        return;
    }

    vec2 step = 1.0 / vec2(size);
    int agree = 0;
    if (shadr_video_adjoins(packedBits, texture(InSampler, texCoord + vec2(step.x, 0.0)).rgb, pixel + ivec2(1, 0))) agree++;
    if (shadr_video_adjoins(packedBits, texture(InSampler, texCoord - vec2(step.x, 0.0)).rgb, pixel - ivec2(1, 0))) agree++;
    if (shadr_video_adjoins(packedBits, texture(InSampler, texCoord + vec2(0.0, step.y)).rgb, pixel + ivec2(0, 1))) agree++;
    if (shadr_video_adjoins(packedBits, texture(InSampler, texCoord - vec2(0.0, step.y)).rgb, pixel - ivec2(0, 1))) agree++;

    if (agree < 2) {
        fragColor = scene;
        return;
    }

    vec2 uv = vec2(packedBits) / float(SHADR_VIDEO_UV_MAX);

#if SHADR_VIDEO_DEBUG == 1
    // The marker
    fragColor = vec4(uv, 0.0, 1.0);
    return;
#endif

    fragColor = vec4(texture(FrameSampler, vec2(uv.x, 1.0 - uv.y)).rgb, 1.0);
}
