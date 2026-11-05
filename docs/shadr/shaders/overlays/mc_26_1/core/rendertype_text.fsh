#version 330

#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:dynamictransforms.glsl>

uniform sampler2D Sampler0;

in float sphericalVertexDistance;
in float cylindricalVertexDistance;
in vec4 vertexColor;
in vec2 texCoord0;

out vec4 fragColor;

#moj_import <hud_fragment.glsl>

void main() {
    vec2 uvDerivative = fwidth(texCoord0);

    vec4 texColor;
    if (shadr_is_field()) {
        vec2 atlasSize = vec2(textureSize(Sampler0, 0));
        vec3 field = shadr_sample_field(Sampler0, texCoord0, atlasSize);
        float coverage = shadr_field_alpha(field, shadr_texels_per_pixel(uvDerivative, atlasSize));
        texColor = vec4(1.0, 1.0, 1.0, coverage);
    } else {
        texColor = texture(Sampler0, texCoord0);
    }

    vec4 color = texColor * vertexColor * ColorModulator;
    if (color.a < 0.1) {
        discard;
    }

    if (shadr_is_blur_panel()) {
        fragColor = vec4(SHADR_BLUR_KEY, 1.0);
        return;
    }

    fragColor = apply_fog(color, sphericalVertexDistance, cylindricalVertexDistance, FogEnvironmentalStart, FogEnvironmentalEnd, FogRenderDistanceStart, FogRenderDistanceEnd, FogColor);
}
