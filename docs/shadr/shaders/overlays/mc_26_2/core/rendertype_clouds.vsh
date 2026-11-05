#version 330

#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:projection.glsl>

const int FLAG_MASK_DIR = 7;
const int FLAG_INSIDE_FACE = 1 << 4;
const int FLAG_USE_TOP_COLOR = 1 << 5;
const int FLAG_EXTRA_Z = 1 << 6;
const int FLAG_EXTRA_X = 1 << 7;

layout(std140) uniform CloudInfo {
    vec4 CloudColor;
    vec3 CloudOffset;
    vec3 CellSize;
};

uniform isamplerBuffer CloudFaces;

out float vertexDistance;
out vec4 vertexColor;

out vec3 cloudPosition;

flat out int cloudFace;

flat out float cloudLayerY;

const vec3[] vertices = vec3[](
    vec3(1, 0, 0),
    vec3(1, 0, 1),
    vec3(0, 0, 1),
    vec3(0, 0, 0),
    vec3(0, 1, 0),
    vec3(0, 1, 1),
    vec3(1, 1, 1),
    vec3(1, 1, 0),
    vec3(0, 0, 0),
    vec3(0, 1, 0),
    vec3(1, 1, 0),
    vec3(1, 0, 0),
    vec3(1, 0, 1),
    vec3(1, 1, 1),
    vec3(0, 1, 1),
    vec3(0, 0, 1),
    vec3(0, 0, 1),
    vec3(0, 1, 1),
    vec3(0, 1, 0),
    vec3(0, 0, 0),
    vec3(1, 0, 0),
    vec3(1, 1, 0),
    vec3(1, 1, 1),
    vec3(1, 0, 1)
);

const vec4[] faceColors = vec4[](
    vec4(0.7, 0.7, 0.7, 1.0),
    vec4(1.0, 1.0, 1.0, 1.0),
    vec4(0.8, 0.8, 0.8, 1.0),
    vec4(0.8, 0.8, 0.8, 1.0),
    vec4(0.9, 0.9, 0.9, 1.0),
    vec4(0.9, 0.9, 0.9, 1.0)
);

void main() {
    int quadVertex = gl_VertexID % 4;
    int index = (gl_VertexID / 4) * 3;

    int cellX = texelFetch(CloudFaces, index).r;
    int cellZ = texelFetch(CloudFaces, index + 1).r;
    int dirAndFlags = texelFetch(CloudFaces, index + 2).r;
    int direction = dirAndFlags & FLAG_MASK_DIR;
    bool isInsideFace = (dirAndFlags & FLAG_INSIDE_FACE) == FLAG_INSIDE_FACE;
    bool useTopColor = (dirAndFlags & FLAG_USE_TOP_COLOR) == FLAG_USE_TOP_COLOR;
    cellX = (cellX << 1) | ((dirAndFlags & FLAG_EXTRA_X) >> 7);
    cellZ = (cellZ << 1) | ((dirAndFlags & FLAG_EXTRA_Z) >> 6);
    vec3 faceVertex = vertices[(direction * 4) + (isInsideFace ? 3 - quadVertex : quadVertex)];
    vec3 pos = (faceVertex * CellSize) + (vec3(cellX, 0, cellZ) * CellSize) + CloudOffset;
    gl_Position = ProjMat * ModelViewMat * vec4(pos, 1.0);

    vertexDistance = fog_spherical_distance(pos);
    vertexColor = (useTopColor ? faceColors[1] : faceColors[direction]) * CloudColor;

    cloudPosition = pos;
    cloudFace = useTopColor ? 1 : direction;
    cloudLayerY = CloudOffset.y;
}
