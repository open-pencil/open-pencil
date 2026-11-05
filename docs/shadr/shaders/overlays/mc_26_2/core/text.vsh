#version 330

in vec3 Position;
in vec4 Color;
in vec2 UV0;
#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
in ivec2 UV2;
#endif

#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:sample_lightmap.glsl>
#endif

#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:projection.glsl>
#moj_import <minecraft:globals.glsl>

uniform sampler2D Sampler0;

#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
uniform sampler2D Sampler2;
out float sphericalVertexDistance;
out float cylindricalVertexDistance;
#endif

out vec4 vertexColor;
out vec2 texCoord0;

#moj_import <hud.glsl>
#moj_import <shadr_header_vertex.glsl>
#moj_import <shadr_stream_vertex.glsl>

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);
    texCoord0 = UV0;

    if (shadr_header_place()) {
        vertexColor = vec4(1.0);
#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
        sphericalVertexDistance = 0.0;
        cylindricalVertexDistance = 0.0;
#endif
        return;
    }

#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
    if (shadr_stream_place(Sampler0, UV0)) {
        vertexColor = vec4(1.0);
        sphericalVertexDistance = 0.0;
        cylindricalVertexDistance = 0.0;
        return;
    }
#endif

#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
    sphericalVertexDistance = fog_spherical_distance(Position);
    cylindricalVertexDistance = fog_cylindrical_distance(Position);
    vertexColor = Color * sample_lightmap(Sampler2, UV2);
#else
    vertexColor = Color;
#endif

    if (make_hud()) {
        vertexColor = Color;
#if !defined(IS_GUI) && !defined(IS_SEE_THROUGH)
        sphericalVertexDistance = 0.0;
        cylindricalVertexDistance = 0.0;
#endif
    }
}
