#version 330

#moj_import <minecraft:globals.glsl>
#moj_import <shadr_watermath.glsl>
#moj_import <shadr_header.glsl>

uniform sampler2D OpaqueSampler;
uniform sampler2D MainDepthSampler;
uniform sampler2D TranslucentSampler;
uniform sampler2D TranslucentDepthSampler;
uniform sampler2D HeaderSampler;

layout(std140) uniform SamplerInfo {
    vec2 OutSize;
    vec2 InSize;
};

layout(std140) uniform ShadrSsrConfig {
    vec4 Ray;
    vec4 Quality;
    vec4 WaveInfo;
};

in vec2 texCoord;
out vec4 fragColor;

#define SHADR_SSR_MAX_STEPS 64
#define SSR_DEBUG 0

void main() {
    float surfaceDepth = texture(TranslucentDepthSampler, texCoord).r;
    float opaqueDepth = texture(MainDepthSampler, texCoord).r;

    bool reflective = !shadr_is_sky(surfaceDepth) && !shadr_is_ui(surfaceDepth) &&
        texture(TranslucentSampler, texCoord).a > 0.01 &&
        shadr_linear_depth(surfaceDepth) < shadr_linear_depth(opaqueDepth) - 0.001;
    if (!reflective) {
        fragColor = vec4(0.0);
        return;
    }

    vec2 size = max(InSize, vec2(1.0));
    vec2 texel = 1.0 / size;

    mat3 basis;
    vec2 tanHalf;
    vec3 celestialView;
    bool aligned = shadr_header_read(HeaderSampler, basis, tanHalf, celestialView);
    if (!aligned) tanHalf = shadr_half_extent(Quality.z, size);

    vec3 origin = shadr_view_pos(texCoord, surfaceDepth, tanHalf);
    vec3 normal = shadr_normal_from_depth(TranslucentDepthSampler, texCoord, texel, tanHalf);

    if (aligned) {
        vec3 camPos = vec3(CameraBlockPos) + CameraOffset;
        vec3 surfaceWorld = camPos + basis * origin;
        if (shadr_water_fingerprint(basis * normal, surfaceWorld)) {
            float t = GameTime * 1200.0 * WaveInfo.z;
            vec3 wave = shadr_wave_normal(surfaceWorld.xz, t, WaveInfo.x, WaveInfo.y);
            normal = normalize(transpose(basis) * wave);
        }
    }

    vec3 incident = normalize(origin);
    vec3 direction = reflect(incident, normal);

    int steps = int(clamp(Quality.x, 8.0, float(SHADR_SSR_MAX_STEPS)) + 0.5);
    float maxDistance = Ray.y;
    float thickness = Ray.z;
    float stride = max(Ray.w, 1.0);

    float travelled = 0.0;
    float stepSize = maxDistance / float(steps) * stride;
    vec3 hitColour = vec3(0.0);
    float hit = 0.0;
    vec2 hitUv = vec2(0.0);

    for (int i = 0; i < SHADR_SSR_MAX_STEPS; i++) {
        if (i >= steps) break;
        travelled += stepSize;
        vec3 probe = origin + direction * travelled;
        if (-probe.z <= 0.05) break;

        vec2 uv = shadr_project(probe, tanHalf);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;

        float sceneDepth = texture(MainDepthSampler, uv).r;
        if (shadr_is_ui(sceneDepth)) break;
        float sceneZ = shadr_linear_depth(sceneDepth);
        float difference = -probe.z - sceneZ;

        if (difference > 0.0 && difference < thickness + stepSize) {
            float low = travelled - stepSize;
            float high = travelled;
            for (int r = 0; r < 5; r++) {
                float mid = (low + high) * 0.5;
                vec3 refined = origin + direction * mid;
                vec2 refinedUv = shadr_project(refined, tanHalf);
                float refinedZ = shadr_linear_depth(texture(MainDepthSampler, refinedUv).r);
                if (-refined.z > refinedZ) high = mid; else low = mid;
            }
            hitUv = shadr_project(origin + direction * high, tanHalf);
            hitColour = texture(OpaqueSampler, hitUv).rgb;
            hit = 1.0;
            break;
        }
    }

#if SSR_DEBUG == 1
    fragColor = vec4(normal * 0.5 + 0.5, 1.0);
    return;
#endif

    if (hit < 0.5) {
        fragColor = vec4(0.0);
        return;
    }

    vec2 edge = abs(hitUv - 0.5) * 2.0;
    float border = 1.0 - smoothstep(1.0 - max(Ray.x, 0.001), 1.0, max(edge.x, edge.y));
    float distanceFade = 1.0 - clamp(travelled / max(maxDistance, 0.0001), 0.0, 1.0);
    fragColor = vec4(hitColour, border * mix(1.0, distanceFade, Ray.x));
}
