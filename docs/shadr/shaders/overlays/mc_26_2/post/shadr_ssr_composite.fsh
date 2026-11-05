#version 330

#moj_import <shadr_world.glsl>

uniform sampler2D InSampler;
uniform sampler2D ReflectionSampler;

layout(std140) uniform ShadrSsrConfig {
    vec4 Ray;
    vec4 Quality;
};

in vec2 texCoord;
out vec4 fragColor;

void main() {
    vec4 scene = texture(InSampler, texCoord);
    vec4 reflection = texture(ReflectionSampler, texCoord);
    float strength = reflection.a * Quality.y;
    fragColor = vec4(mix(scene.rgb, reflection.rgb, clamp(strength, 0.0, 1.0)), scene.a);
}
