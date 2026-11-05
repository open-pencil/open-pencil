#version 330

#moj_import <shadr_world.glsl>

uniform sampler2D InSampler;
uniform sampler2D MainDepthSampler;

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

#define SHADR_AO_BLUR_MAX 4

/** Bilateral. */
void main() {
    int radius = int(clamp(Quality.y, 0.0, float(SHADR_AO_BLUR_MAX)) + 0.5);
    if (radius <= 0) {
        fragColor = texture(InSampler, texCoord);
        return;
    }

    vec2 texel = 1.0 / max(InSize, vec2(1.0));
    float centreZ = shadr_linear_depth(texture(MainDepthSampler, texCoord).r);

    float total = 0.0;
    float weightSum = 0.0;
    for (int y = -SHADR_AO_BLUR_MAX; y <= SHADR_AO_BLUR_MAX; y++) {
        if (y < -radius || y > radius) continue;
        for (int x = -SHADR_AO_BLUR_MAX; x <= SHADR_AO_BLUR_MAX; x++) {
            if (x < -radius || x > radius) continue;
            vec2 uv = texCoord + vec2(float(x), float(y)) * texel;
            float z = shadr_linear_depth(texture(MainDepthSampler, uv).r);
            float weight = exp(-abs(z - centreZ) * 4.0);
            total += texture(InSampler, uv).r * weight;
            weightSum += weight;
        }
    }

    fragColor = vec4(vec3(weightSum > 0.0 ? total / weightSum : 1.0), 1.0);
}
