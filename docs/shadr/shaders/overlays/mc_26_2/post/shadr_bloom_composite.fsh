#version 330

#moj_import <shadr_world_mask.glsl>

uniform sampler2D InSampler;
uniform sampler2D BloomSampler;
uniform sampler2D MainDepthSampler;
uniform sampler2D TranslucentDepthSampler;
uniform sampler2D ItemEntityDepthSampler;

layout(std140) uniform ShadrBloomConfig {
    vec4 Bloom;
};

in vec2 texCoord;
out vec4 fragColor;

void main() {
    vec4 scene = texture(InSampler, texCoord);
    if (shadr_ui_here(MainDepthSampler, TranslucentDepthSampler, ItemEntityDepthSampler, texCoord)) {
        fragColor = scene;
        return;
    }
    vec3 bloom = texture(BloomSampler, texCoord).rgb;
    fragColor = vec4(clamp(scene.rgb + bloom * Bloom.z, 0.0, 1.0), scene.a);
}
