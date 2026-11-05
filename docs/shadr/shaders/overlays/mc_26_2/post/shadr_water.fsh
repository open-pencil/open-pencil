#version 330

#moj_import <minecraft:globals.glsl>
#moj_import <shadr_world_mask.glsl>
#moj_import <shadr_watermath.glsl>
#moj_import <shadr_header.glsl>

uniform sampler2D InSampler;
uniform sampler2D OpaqueSampler;
uniform sampler2D MainDepthSampler;
uniform sampler2D TranslucentSampler;
uniform sampler2D TranslucentDepthSampler;
uniform sampler2D ItemEntityDepthSampler;
uniform sampler2D SsrSampler;
uniform sampler2D HeaderSampler;

layout(std140) uniform SamplerInfo {
    vec2 OutSize;
    vec2 InSize;
};

layout(std140) uniform ShadrWaterConfig {
    vec4 Wave;
    vec4 AbsorbColor;
    vec4 ScatterColor;
    vec4 Shading;
    vec4 Extra;
};

in vec2 texCoord;
out vec4 fragColor;

#define WATER_DEBUG 0

void main() {
    vec4 scene = texture(InSampler, texCoord);
    if (shadr_ui_here(MainDepthSampler, TranslucentDepthSampler, ItemEntityDepthSampler, texCoord)) {
        fragColor = scene;
        return;
    }

    float surfaceDepth = texture(TranslucentDepthSampler, texCoord).r;
    float floorDepth = texture(MainDepthSampler, texCoord).r;
    vec4 translucent = texture(TranslucentSampler, texCoord);

    bool covered = !shadr_is_sky(surfaceDepth) && translucent.a > 0.01 &&
        shadr_linear_depth(surfaceDepth) < shadr_linear_depth(floorDepth) - 0.001;
    if (!covered) {
        fragColor = scene;
        return;
    }

    vec2 size = max(InSize, vec2(1.0));
    vec2 texel = 1.0 / size;

    mat3 basis;
    vec2 tanHalf;
    vec3 celestialView;
    bool aligned = shadr_header_read(HeaderSampler, basis, tanHalf, celestialView);
    if (!aligned) {
        fragColor = scene;
        return;
    }

    vec3 surfaceView = shadr_view_pos(texCoord, surfaceDepth, tanHalf);
    vec3 camPos = vec3(CameraBlockPos) + CameraOffset;
    vec3 surfaceWorld = camPos + basis * surfaceView;

    vec3 geoNormalView = shadr_normal_from_depth(TranslucentDepthSampler, texCoord, texel, tanHalf);
    vec3 geoNormalWorld = basis * geoNormalView;
    if (!shadr_water_fingerprint(geoNormalWorld, surfaceWorld)) {
        fragColor = scene;
        return;
    }

    float t = GameTime * 1200.0 * Wave.z;
    vec3 waveWorld = shadr_wave_normal(surfaceWorld.xz, t, Wave.x, Wave.y);
    vec3 waveView = normalize(transpose(basis) * waveWorld);
    vec3 rd = normalize(surfaceView);

    float thickness = distance(shadr_view_pos(texCoord, floorDepth, tanHalf), surfaceView);

    vec2 refractedUv = texCoord + waveView.xy * Wave.w * 0.6 / max(1.0, -surfaceView.z);
    float refractedDepth = texture(MainDepthSampler, refractedUv).r;
    if (shadr_linear_depth(refractedDepth) <= shadr_linear_depth(surfaceDepth) + 0.001 ||
        shadr_is_ui(refractedDepth)) {
        refractedUv = texCoord;
        refractedDepth = floorDepth;
    }

    vec3 floorView = shadr_view_pos(refractedUv, refractedDepth, tanHalf);
    float depthBelow = shadr_is_sky(refractedDepth)
        ? 64.0
        : max(distance(floorView, surfaceView), 0.0);
    vec3 refracted = texture(OpaqueSampler, refractedUv).rgb;

    vec3 floorWorld = camPos + basis * floorView;
    float caustic = shadr_caustic(floorWorld.xz * Shading.z, t) * exp(-depthBelow * 0.35);
    refracted *= 1.0 + Shading.y * caustic;

    vec3 absorb = -log(clamp(AbsorbColor.rgb, vec3(0.02), vec3(1.0)));
    vec3 body = refracted * exp(-absorb * AbsorbColor.a * depthBelow * 0.35);

    float phase = pow(max(dot(rd, celestialView), 0.0), 8.0);
    float scatterAmount = 1.0 - exp(-ScatterColor.a * depthBelow * 0.4);
    body += ScatterColor.rgb * scatterAmount * (1.0 + Shading.x * phase * 2.0);

    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, waveView), 0.0), 5.0);
    vec4 reflection = Extra.y > 0.5 ? texture(SsrSampler, texCoord) : vec4(0.0);
    vec3 mirror = mix(translucent.rgb, reflection.rgb, reflection.a);
    vec3 shaded = mix(body, mirror, clamp(fresnel * 1.2, 0.0, 0.9));

    float band = 1.0 - smoothstep(0.0, max(Extra.x, 0.001), thickness);
    float foam = clamp(band * Shading.w * shadr_foam_noise(surfaceWorld.xz, t), 0.0, 1.0);
    shaded = mix(shaded, vec3(0.92, 0.95, 0.97), foam);

#if WATER_DEBUG == 1
    fragColor = vec4(waveWorld * 0.5 + 0.5, 1.0);
    return;
#endif
#if WATER_DEBUG == 2
    fragColor = vec4(vec3(fract(surfaceWorld.y)), 1.0);
    return;
#endif

    fragColor = vec4(shaded, scene.a);
}
