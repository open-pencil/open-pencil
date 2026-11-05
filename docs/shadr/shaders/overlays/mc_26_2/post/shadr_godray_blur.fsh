#version 330

#moj_import <shadr_world.glsl>
#moj_import <shadr_header.glsl>

uniform sampler2D InSampler;
uniform sampler2D HeaderSampler;

layout(std140) uniform ShadrGodrayConfig {
    vec4 Rays;
    vec4 Quality;
};

in vec2 texCoord;
out vec4 fragColor;

#define SHADR_RAY_MAX_STEPS 64

void main() {
    mat3 basis;
    vec2 tanHalf;
    vec3 celestialView;
    if (!shadr_header_read(HeaderSampler, basis, tanHalf, celestialView) || celestialView.z > -0.05) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec2 sunNdc = (celestialView.xy / -celestialView.z) / tanHalf;
    vec2 sunUv = clamp(sunNdc * 0.5 + 0.5, vec2(-0.6), vec2(1.6));

    int steps = int(clamp(Quality.x, 8.0, float(SHADR_RAY_MAX_STEPS)) + 0.5);
    vec2 delta = (texCoord - sunUv) * Rays.z / float(steps);
    vec2 uv = texCoord;
    float illumination = 1.0;
    vec3 accum = vec3(0.0);

    for (int i = 0; i < SHADR_RAY_MAX_STEPS; i++) {
        if (i >= steps) break;
        uv -= delta;
        accum += texture(InSampler, clamp(uv, 0.0, 1.0)).rgb * illumination * Rays.w;
        illumination *= Rays.y;
    }

    fragColor = vec4(accum / float(steps), 1.0);
}
