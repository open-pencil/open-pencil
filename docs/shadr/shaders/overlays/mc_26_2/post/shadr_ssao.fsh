#version 330

#moj_import <shadr_world.glsl>
#moj_import <shadr_header.glsl>

uniform sampler2D MainDepthSampler;
uniform sampler2D HeaderSampler;

layout(std140) uniform SamplerInfo {
    vec2 OutSize;
    vec2 InSize;
};

layout(std140) uniform ShadrSsaoConfig {
    vec4 Ao;
    vec4 Quality;
};

in vec2 texCoord;
out vec4 fragColor;

#define SHADR_AO_MAX_SAMPLES 32

void main() {
    float depth = texture(MainDepthSampler, texCoord).r;
    if (shadr_is_sky(depth) || shadr_is_ui(depth)) {
        fragColor = vec4(1.0);
        return;
    }

    vec2 size = max(InSize, vec2(1.0));
    vec2 texel = 1.0 / size;
    mat3 headerBasis;
    vec2 headerTanHalf;
    vec3 headerCelestial;
    vec2 halfExtent = shadr_header_read(HeaderSampler, headerBasis, headerTanHalf, headerCelestial)
        ? headerTanHalf
        : shadr_half_extent(Quality.z, size);

    vec3 origin = shadr_view_pos(texCoord, depth, halfExtent);
    vec3 normal = shadr_normal_from_depth(MainDepthSampler, texCoord, texel, halfExtent);

    float radius = Ao.x;
    float bias = Ao.z;
    int samples = int(clamp(Quality.x, 4.0, float(SHADR_AO_MAX_SAMPLES)) + 0.5);

    float angleSeed = shadr_hash12(gl_FragCoord.xy) * SHADR_PI * 2.0;
    float occlusion = 0.0;
    float taps = 0.0;

    for (int i = 0; i < SHADR_AO_MAX_SAMPLES; i++) {
        if (i >= samples) break;
        float t = (float(i) + 0.5) / float(samples);
        float angle = angleSeed + t * SHADR_PI * 2.0 * 2.4;
        float reach = radius * sqrt(t);

        vec3 tangent = normalize(abs(normal.z) < 0.99 ? cross(normal, vec3(0.0, 0.0, 1.0))
                                                      : cross(normal, vec3(1.0, 0.0, 0.0)));
        vec3 bitangent = cross(normal, tangent);
        vec3 dir = normalize(tangent * cos(angle) + bitangent * sin(angle) + normal * 0.6);

        vec3 samplePos = origin + dir * reach;
        vec2 sampleUv = shadr_project(samplePos, halfExtent);
        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;

        float sampleDepth = texture(MainDepthSampler, sampleUv).r;
        if (shadr_is_sky(sampleDepth) || shadr_is_ui(sampleDepth)) {
            taps += 1.0;
            continue;
        }

        float sceneZ = shadr_linear_depth(sampleDepth);
        float sampleZ = -samplePos.z;
        float range = smoothstep(0.0, 1.0, radius / max(abs(sampleZ - sceneZ), 0.0001));
        occlusion += (sceneZ < sampleZ - bias ? 1.0 : 0.0) * range;
        taps += 1.0;
    }

    float ao = taps > 0.0 ? 1.0 - (occlusion / taps) * Ao.y : 1.0;
    fragColor = vec4(vec3(clamp(ao, 0.0, 1.0)), 1.0);
}
