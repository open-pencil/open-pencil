#version 330

#moj_import <shadr_world.glsl>

uniform sampler2D InSampler;
uniform sampler2D AoSampler;
uniform sampler2D MainDepthSampler;

in vec2 texCoord;
out vec4 fragColor;

#define SSAO_DEBUG 0

void main() {
    vec4 scene = texture(InSampler, texCoord);
    float depth = texture(MainDepthSampler, texCoord).r;
    float ao = texture(AoSampler, texCoord).r;

#if SSAO_DEBUG == 1
    fragColor = vec4(vec3(ao), 1.0);
    return;
#endif

    if (shadr_is_ui(depth) || shadr_is_sky(depth)) {
        fragColor = scene;
        return;
    }
    fragColor = vec4(scene.rgb * ao, scene.a);
}
