#version 330

#moj_import <shadr_header.glsl>

uniform sampler2D InSampler;

in vec2 texCoord;
out vec4 fragColor;

void main() {
    vec2 f = gl_FragCoord.xy;
    if (f.y < 1.0 && f.x < float(SHADR_HEADER_PIXELS)) {
        fragColor = texelFetch(InSampler, ivec2(int(f.x), 1), 0);
        return;
    }
    fragColor = texture(InSampler, texCoord);
}
