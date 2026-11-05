#version 330

#moj_import <shadr_world_mask.glsl>

uniform sampler2D InSampler;
uniform sampler2D MainDepthSampler;
uniform sampler2D TranslucentDepthSampler;
uniform sampler2D ItemEntityDepthSampler;

layout(std140) uniform ShadrBloomConfig {
    vec4 Bloom;
};

in vec2 texCoord;
out vec4 fragColor;

void main() {
    if (shadr_ui_here(MainDepthSampler, TranslucentDepthSampler, ItemEntityDepthSampler, texCoord)) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec3 colour = texture(InSampler, texCoord).rgb;
    float threshold = Bloom.x;
    float knee = max(threshold * Bloom.y, 0.0001);
    float brightness = max(colour.r, max(colour.g, colour.b));

    float soft = clamp(brightness - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee);
    float weight = max(soft, brightness - threshold) / max(brightness, 0.0001);

    fragColor = vec4(colour * clamp(weight, 0.0, 1.0), 1.0);
}
