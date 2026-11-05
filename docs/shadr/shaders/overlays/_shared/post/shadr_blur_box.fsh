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

    vec3 colour = vec3(0.0);
    float weight = 0.0;
    float taps = 0.0;

    for (float offset = -Radius; offset <= Radius; offset += 1.0) {
        vec4 texel = texture(InSampler, texCoord + sampleStep * offset);
        colour += texel.rgb * texel.a;
        weight += texel.a;
        taps += 1.0;
    }

    if (weight < 0.0001) {
        fragColor = vec4(0.0);
        return;
    }

    fragColor = vec4(colour / weight, min(weight / max(taps * 0.25, 1.0), 1.0));
}
