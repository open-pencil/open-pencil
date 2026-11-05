#version 330

#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:projection.glsl>

in vec3 Position;

out float sphericalVertexDistance;
out float cylindricalVertexDistance;

out vec3 shadrSkyDir;

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);

    shadrSkyDir = Position;

    sphericalVertexDistance = fog_spherical_distance(Position);
    cylindricalVertexDistance = fog_cylindrical_distance(Position);
}
