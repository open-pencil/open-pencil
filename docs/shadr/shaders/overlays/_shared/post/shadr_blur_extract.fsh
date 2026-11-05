#version 330

#moj_import <shadr_post.glsl>

uniform sampler2D InSampler;
uniform sampler2D MaskSampler;

in vec2 texCoord;
out vec4 fragColor;

void main() {
    vec3 scene = texture(InSampler, texCoord).rgb;

    bool insidePanel = texture(MaskSampler, texCoord).a > 0.5;

    fragColor = insidePanel ? vec4(0.0) : vec4(scene, 1.0);
}
