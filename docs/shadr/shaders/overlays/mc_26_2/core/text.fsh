#version 330

#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
#moj_import <minecraft:fog.glsl>
#endif

#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:projection.glsl>
#moj_import <minecraft:globals.glsl>

uniform sampler2D Sampler0;

#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
in float sphericalVertexDistance;
in float cylindricalVertexDistance;
#endif

in vec4 vertexColor;
in vec2 texCoord0;

out vec4 fragColor;

#moj_import <hud_fragment.glsl>
#moj_import <shadr_header.glsl>

void main() {
#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
    if (shadr_has_mode(16.0)) {
        vec2 f = gl_FragCoord.xy;
        if (f.x >= float(SHADR_HEADER_PIXELS) || f.y >= 1.0) discard;
        mat3 view = mat3(ModelViewMat);
        view[0] = normalize(view[0]);
        view[1] = normalize(view[1]);
        view[2] = normalize(view[2]);
        fragColor = shadr_header_write(vec4(0.0, 0.0, 0.0, 1.0), f, view, ProjMat, GameTime);
        return;
    }
    if (shadr_is_stream()) {
        fragColor = vec4(texture(Sampler0, texCoord0).rgb, 1.0);
        return;
    }
#endif

    vec2 uvDerivative = fwidth(texCoord0);

#ifdef IS_GRAYSCALE
    vec4 texColor = texture(Sampler0, texCoord0).rrrr;
#else
    vec4 texColor;
    if (shadr_is_field()) {
        vec2 atlasSize = vec2(textureSize(Sampler0, 0));
        vec3 field = shadr_sample_field(Sampler0, texCoord0, atlasSize);
        float coverage = shadr_field_alpha(field, shadr_texels_per_pixel(uvDerivative, atlasSize));
        texColor = vec4(1.0, 1.0, 1.0, coverage);
    } else {
        texColor = texture(Sampler0, texCoord0);
    }
#endif

#ifdef IS_SEE_THROUGH
    vec4 color = texColor * vertexColor;
#else
    vec4 color = texColor * vertexColor * ColorModulator;
#endif
    if (color.a < 0.1) {
        discard;
    }

    if (shadr_is_blur_panel()) {
        fragColor = vec4(SHADR_BLUR_KEY, 1.0);
        return;
    }

#ifdef IS_SEE_THROUGH
    fragColor = color * ColorModulator;
#elif defined(IS_GUI)
    fragColor = color;
#else
    fragColor = apply_fog(color, sphericalVertexDistance, cylindricalVertexDistance, FogEnvironmentalStart, FogEnvironmentalEnd, FogRenderDistanceStart, FogRenderDistanceEnd, FogColor);
#endif
}
