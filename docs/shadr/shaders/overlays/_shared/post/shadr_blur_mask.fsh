#version 330

#moj_import <shadr_post.glsl>

uniform sampler2D InSampler;

in vec2 texCoord;
out vec4 fragColor;

void main() {
    fragColor = vec4(vec3(0.0), shadr_is_blur_panel(texture(InSampler, texCoord).rgb) ? 1.0 : 0.0);
}
