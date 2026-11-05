#version 330

in vec3 Position;
in vec2 UV0;

#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:projection.glsl>
#moj_import <minecraft:globals.glsl>

out float sphericalVertexDistance;
out float cylindricalVertexDistance;
out vec2 texCoord0;

#moj_import <hud.glsl>

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);

    sphericalVertexDistance = fog_spherical_distance(Position);
    cylindricalVertexDistance = fog_cylindrical_distance(Position);

    texCoord0 = (TextureMat * vec4(UV0, 0.0, 1.0)).xy;

    if (make_hud()) {
        sphericalVertexDistance = 0.0;
        cylindricalVertexDistance = 0.0;
    }
}
