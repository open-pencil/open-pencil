#version 330

#moj_import <minecraft:globals.glsl>
#moj_import <shadr_world_mask.glsl>
#moj_import <shadr_header.glsl>

uniform sampler2D InSampler;
uniform sampler2D MainDepthSampler;
uniform sampler2D TranslucentDepthSampler;
uniform sampler2D ItemEntityDepthSampler;
uniform sampler2D HeaderSampler;

layout(std140) uniform SamplerInfo {
    vec2 OutSize;
    vec2 InSize;
};

layout(std140) uniform ShadrFogConfig {
    vec4 FogShape;
    vec4 FogTint;
};

in vec2 texCoord;
out vec4 fragColor;

#define SHADR_FOG_STEPS 12
#define FOG_DEBUG 0

void main() {
    vec4 scene = texture(InSampler, texCoord);
    if (shadr_ui_here(MainDepthSampler, TranslucentDepthSampler, ItemEntityDepthSampler, texCoord)) {
        fragColor = scene;
        return;
    }

    mat3 basis;
    vec2 tanHalf;
    vec3 celestialView;
    if (!shadr_header_read(HeaderSampler, basis, tanHalf, celestialView)) {
        fragColor = scene;
        return;
    }

    float density = FogShape.x;
    float falloff = max(FogShape.y, 0.0001);
    float base = FogShape.z;
    float maxDist = max(FogShape.w, 1.0);

    float depth = texture(MainDepthSampler, texCoord).r;
    vec3 rdView = normalize(vec3((texCoord * 2.0 - 1.0) * tanHalf, -1.0));
    float dist = shadr_is_sky(depth)
        ? maxDist
        : min(length(shadr_view_pos(texCoord, depth, tanHalf)), maxDist);

    vec3 rdWorld = basis * rdView;
    float camY = float(CameraBlockPos.y) + CameraOffset.y;

    float stepLength = dist / float(SHADR_FOG_STEPS);
    float optical = 0.0;
    for (int i = 0; i < SHADR_FOG_STEPS; i++) {
        float y = camY + rdWorld.y * stepLength * (float(i) + 0.5);
        optical += density * exp(-falloff * max(y - base, 0.0)) * stepLength;
    }
    float fog = 1.0 - exp(-optical);

    float phase = pow(max(dot(rdView, celestialView), 0.0), 8.0);
    vec3 tint = FogTint.rgb * (1.0 + FogTint.a * phase * 2.0);

#if FOG_DEBUG == 1
    fragColor = vec4(vec3(fog), 1.0);
    return;
#endif

    fragColor = vec4(mix(scene.rgb, clamp(tint, 0.0, 1.0), clamp(fog, 0.0, 1.0)), scene.a);
}
