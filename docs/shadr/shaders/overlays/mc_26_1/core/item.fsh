#version 330

#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:globals.glsl>
#moj_import <hud_shape.glsl>
#moj_import <shadr_shaders.glsl>

uniform sampler2D Sampler0;

in float sphericalVertexDistance;
in float cylindricalVertexDistance;
in vec4 vertexColor;
in vec2 texCoord0;
in vec4 shadrTint;

out vec4 fragColor;

#moj_import <hud_fragment.glsl>

void main() {
    vec2 uvDerivative = fwidth(texCoord0);

    vec3 dpdx = dFdx(shadrWorldPos);
    vec3 dpdy = dFdy(shadrWorldPos);
    vec2 dtdx = dFdx(texCoord0);
    vec2 dtdy = dFdy(texCoord0);

    bool isField = shadr_is_field();

    vec4 color = texture(Sampler0, texCoord0);

    ivec2 shadrAtlas = textureSize(Sampler0, 0);
    vec2 shadrTexel = texCoord0 * vec2(shadrAtlas);
    vec2 duvdx = dtdx * vec2(shadrAtlas) / float(SHADR_SHADER_GRID);
    vec2 duvdy = dtdy * vec2(shadrAtlas) / float(SHADR_SHADER_GRID);
    ivec2 shadrCoord = ivec2(floor(shadrTexel));
    ivec4 shadrRaw = ivec4(round(texelFetch(Sampler0, shadrCoord, 0) * 255.0));

    if (shadrRaw.a == SHADR_POSITION_ALPHA) {
        ivec4 sig = ivec4(round(
            texelFetch(Sampler0, shadrCoord + ivec2(0, SHADR_SHADER_GRID), 0) * 255.0));
        if (sig.r != SHADR_MARKER_R || sig.g != SHADR_MARKER_G
            || sig.a != SHADR_MARKER_A || sig.b != shadrRaw.b) {
            shadrRaw.a = 0;
        }
    }

    if (shadrRaw.a == SHADR_POSITION_ALPHA) {
        vec2 cell = floor(vec2(shadrRaw.rg) / 255.0 * float(SHADR_SHADER_GRID));
        vec2 uv = (cell + fract(shadrTexel)) / float(SHADR_SHADER_GRID);

        float det = duvdx.x * duvdy.y - duvdx.y * duvdy.x;
        if (abs(det) > 1e-12) {
            shadrQuadRight = ( duvdy.y * dpdx - duvdy.x * dpdy) / det;
            shadrQuadUp    = (-duvdx.y * dpdx + duvdx.x * dpdy) / det;
        } else {
            shadrQuadRight = vec3(1.0, 0.0, 0.0);
            shadrQuadUp    = vec3(0.0, 1.0, 0.0);
        }
        shadrQuadCentre = shadrWorldPos
                        - (uv.x - 0.5) * shadrQuadRight
                        - (uv.y - 0.5) * shadrQuadUp;

        vec4 result = shadr_dispatch(shadrRaw.b, clamp(uv, 0.0, 1.0), shadr_time(), shadrTint);
        if (result.a < 0.001) {
            discard;
        }
        fragColor = result;
        return;
    }

    if (isField) {
        vec2 atlasSize = vec2(textureSize(Sampler0, 0));
        vec2 shapeUv = shadr_shape_uv(color.gb, texCoord0, atlasSize);
        float coverage = shadr_shape_alpha(shapeUv, uvDerivative, atlasSize, color.r);
        color = vec4(1.0, 1.0, 1.0, coverage);
        if (color.a < 0.01) {
            discard;
        }
        if (shadr_is_blur_panel()) {
            fragColor = vec4(SHADR_BLUR_KEY, 1.0);
            return;
        }
        fragColor = color * vertexColor * ColorModulator;
        return;
    }

#ifdef ALPHA_CUTOUT
    if (color.a < ALPHA_CUTOUT) {
        discard;
    }
#endif

    color *= vertexColor * ColorModulator;

    fragColor = apply_fog(color, sphericalVertexDistance, cylindricalVertexDistance, FogEnvironmentalStart, FogEnvironmentalEnd, FogRenderDistanceStart, FogRenderDistanceEnd, FogColor);
}
