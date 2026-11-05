#version 330

in vec3 Position;
in vec4 Color;
in vec2 UV0;
in ivec2 UV1;
in ivec2 UV2;
in vec3 Normal;

#moj_import <minecraft:light.glsl>
#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:projection.glsl>
#moj_import <minecraft:sample_lightmap.glsl>
#moj_import <minecraft:globals.glsl>

uniform sampler2D Sampler2;

out vec3 shadrWorldPos;
flat out vec3 shadrEye;

out float sphericalVertexDistance;
out float cylindricalVertexDistance;
out vec4 vertexColor;
out vec2 texCoord0;
out vec4 shadrTint;

#moj_import <hud.glsl>

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);

    sphericalVertexDistance = fog_spherical_distance(Position);
    cylindricalVertexDistance = fog_cylindrical_distance(Position);

    vertexColor = minecraft_mix_light(Light0_Direction, Light1_Direction, Normal, Color) * sample_lightmap(Sampler2, UV2);

    texCoord0 = UV0;
    shadrTint = Color;

    shadrWorldPos = Position + ModelOffset;
    shadrEye = ModelOffset - inverse(mat3(ModelViewMat)) * ModelViewMat[3].xyz;

    if (make_hud()) {
        vertexColor = Color;
        sphericalVertexDistance = 0.0;
        cylindricalVertexDistance = 0.0;
    }
}
