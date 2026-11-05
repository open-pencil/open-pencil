#version 330

in vec3 Position;
in vec4 Color;
in vec2 UV0;

#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:projection.glsl>
#moj_import <minecraft:globals.glsl>

out vec4 vertexColor;
out vec2 texCoord0;

#moj_import <hud.glsl>

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);

    vertexColor = Color;
    texCoord0 = UV0;

    if (make_hud()) {
        return;
    }
}
