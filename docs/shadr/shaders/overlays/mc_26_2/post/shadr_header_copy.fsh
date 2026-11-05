#version 330

uniform sampler2D InSampler;

in vec2 texCoord;
out vec4 fragColor;

void main() {
    fragColor = texelFetch(InSampler, ivec2(int(gl_FragCoord.x), 0), 0);
}
