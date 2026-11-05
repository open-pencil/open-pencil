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

    float covered = 1.0;
    for (float offset = -Radius; offset <= Radius; offset += 1.0) {
        vec2 at = texCoord + sampleStep * offset;
        bool outside = at.x < 0.0 || at.x > 1.0 || at.y < 0.0 || at.y > 1.0;
        covered = min(covered, outside ? 0.0 : texture(InSampler, at).a);
    }

    fragColor = vec4(vec3(0.0), covered);
}
