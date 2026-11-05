#version 330

#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <shadr_sky.glsl>

in float sphericalVertexDistance;
in float cylindricalVertexDistance;
in vec3 shadrSkyDir;

out vec4 fragColor;

#define SKY_STRENGTH 0.75

#define RAYLEIGH_K vec3(0.196, 0.456, 1.000)

#define TURBIDITY 0.42

#define SKY_DEBUG 0

void main() {
#if SKY_DEBUG == 1
    fragColor = vec4(1.0, 0.0, 1.0, 1.0);
    return;
#endif

    vec3 dir = normalize(shadrSkyDir);
    vec3 base = ColorModulator.rgb;

    float mass = shadr_air_mass(dir.y);

    vec3 scattered = 1.0 - exp(-RAYLEIGH_K * mass * TURBIDITY);

    float energy = max(dot(scattered, vec3(0.2126, 0.7152, 0.0722)), 1.0e-4);
    vec3 color = base * mix(vec3(1.0), scattered / energy, SKY_STRENGTH);

    color += shadr_dither(gl_FragCoord.xy);

    fragColor = apply_fog(vec4(color, ColorModulator.a),
                          sphericalVertexDistance, cylindricalVertexDistance,
                          0.0, FogSkyEnd, FogSkyEnd, FogSkyEnd, FogColor);
}
