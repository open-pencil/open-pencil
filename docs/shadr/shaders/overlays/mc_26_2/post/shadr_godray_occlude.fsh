#version 330

#moj_import <shadr_world.glsl>
#moj_import <shadr_header.glsl>

uniform sampler2D InSampler;
uniform sampler2D MainDepthSampler;
uniform sampler2D HeaderSampler;

layout(std140) uniform ShadrGodrayConfig {
    vec4 Rays;
    vec4 Quality;
};

in vec2 texCoord;
out vec4 fragColor;

void main() {
    mat3 basis;
    vec2 tanHalf;
    vec3 celestialView;
    if (!shadr_header_read(HeaderSampler, basis, tanHalf, celestialView) || celestialView.z > -0.05) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    float depth = texture(MainDepthSampler, texCoord).r;
    if (!shadr_is_sky(depth)) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec3 viewDir = normalize(vec3((texCoord * 2.0 - 1.0) * tanHalf, -1.0));
    float cone = pow(max(dot(viewDir, celestialView), 0.0), Quality.y);
    fragColor = vec4(texture(InSampler, texCoord).rgb * cone, 1.0);
}
