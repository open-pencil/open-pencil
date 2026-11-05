#version 330

#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <shadr_sky.glsl>

uniform sampler2D Sampler0;

in vec2 texCoord0;

out vec4 fragColor;

#define SHADR_CELESTIAL_A    250
#define SHADR_CELESTIAL_GRID 64
#define ID_SUN  1
#define ID_MOON 2

#define SUN_LIMB 0.45

#define SUN_DISC 0.62

vec4 shadr_sun(vec2 uv) {
    vec2 p = uv * 2.0 - 1.0;
    float r = length(p);

    float disc = 1.0 - smoothstep(SUN_DISC, SUN_DISC + 0.035, r);
    float mu = sqrt(max(1.0 - pow(min(r / SUN_DISC, 1.0), 2.0), 0.0));
    float limb = mix(1.0 - SUN_LIMB, 1.0, mu);

    float grain = shadr_sky_hash(vec3(floor(p * 26.0), 1.0)) * 0.06;

    vec3 core = mix(vec3(1.0, 0.94, 0.82), vec3(1.0, 0.99, 0.96), limb) * (limb + grain);

    float corona = 0.30 * exp(-(r - 0.62) * 22.0) * step(0.62, r);
    corona *= smoothstep(0.95, 0.66, r);

    vec3 colour = core * disc + vec3(1.0, 0.86, 0.66) * corona;
    return vec4(colour, clamp(disc + corona, 0.0, 1.0));
}

vec4 shadr_moon(vec2 uv) {
    vec2 p = uv * 2.0 - 1.0;
    float r = length(p);
    float disc = 1.0 - smoothstep(0.90, 0.96, r);
    if (disc <= 0.0) return vec4(0.0);

    float z = sqrt(max(1.0 - r * r, 0.0));
    vec3 n = vec3(p, z);

    float craters = 0.0;
    for (int i = 0; i < 2; i++) {
        float scale = 7.0 + 9.0 * float(i);
        vec2 cell = floor(p * scale);
        float h = shadr_sky_hash(vec3(cell, float(i)));
        vec2 centre = (cell + 0.5 + (vec2(h, fract(h * 31.7)) - 0.5) * 0.7) / scale;
        float d = length(p - centre) * scale;
        craters += (1.0 - smoothstep(0.18, 0.42, d)) * (0.10 + 0.14 * h) / float(i + 1);
    }

    float maria = smoothstep(0.52, 0.78, shadr_sky_hash(vec3(floor(p * 2.6), 7.0)));

    vec3 rock = mix(vec3(0.82, 0.81, 0.78), vec3(0.55, 0.56, 0.60), maria * 0.55);
    rock *= 1.0 - craters;
    rock *= 0.72 + 0.28 * n.z;

    return vec4(rock, disc);
}

void main() {
    ivec2 size = textureSize(Sampler0, 0);
    vec2 texel = texCoord0 * vec2(size);
    ivec4 raw = ivec4(round(texelFetch(Sampler0, ivec2(floor(texel)), 0) * 255.0));

    if (raw.a == SHADR_CELESTIAL_A && (raw.b == ID_SUN || raw.b == ID_MOON)) {
        vec2 cell = floor(vec2(raw.rg) / 255.0 * float(SHADR_CELESTIAL_GRID));
        vec2 uv = clamp((cell + fract(texel)) / float(SHADR_CELESTIAL_GRID), 0.0, 1.0);

        vec4 body = raw.b == ID_SUN ? shadr_sun(uv) : shadr_moon(uv);
        if (body.a <= 0.002) {
            discard;
        }
        fragColor = body * ColorModulator;
        return;
    }

    vec4 color = texture(Sampler0, texCoord0);
    if (color.a == 0.0) {
        discard;
    }
    fragColor = color * ColorModulator;
}
