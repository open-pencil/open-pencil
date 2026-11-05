#version 330

uniform sampler2D InSampler;

layout(std140) uniform SamplerInfo {
    vec2 OutSize;
    vec2 InSize;
};

layout(std140) uniform ShadrBlurConfig {
    vec2 BlurDir;
    float Radius;
};

in vec2 texCoord;
out vec4 fragColor;

void main() {
    vec2 sampleStep = BlurDir / InSize;

    float covered = 0.0;
    for (float offset = -Radius; offset <= Radius; offset += 1.0) {
        covered = max(covered, texture(InSampler, texCoord + sampleStep * offset).a);
    }

    fragColor = vec4(vec3(0.0), covered);
}
