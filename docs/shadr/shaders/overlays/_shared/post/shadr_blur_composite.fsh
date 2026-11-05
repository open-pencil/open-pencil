#version 330

#moj_import <shadr_post.glsl>

uniform sampler2D InSampler;
uniform sampler2D BlurSampler;
uniform sampler2D FillSampler;

in vec2 texCoord;
out vec4 fragColor;

#define BLUR_DEBUG 0

void main() {
    vec4 scene = texture(InSampler, texCoord);
    vec4 blurred = texture(BlurSampler, texCoord);
    vec4 filled = texture(FillSampler, texCoord);

#if BLUR_DEBUG == 1
    fragColor = vec4(
        shadr_is_blur_panel(scene.rgb) ? 1.0 : 0.0,
        blurred.a,
        0.0,
        1.0);
    return;
#endif

    if (!shadr_is_blur_panel(scene.rgb)) {
        fragColor = scene;
        return;
    }

    vec3 wide = filled.a > 0.001 ? filled.rgb : SHADR_BLUR_TINT;
    vec3 backdrop = mix(wide, blurred.rgb, clamp(blurred.a * 3.0, 0.0, 1.0));

    fragColor = vec4(mix(backdrop, SHADR_BLUR_TINT, SHADR_BLUR_TINT_STRENGTH), 1.0);
}
