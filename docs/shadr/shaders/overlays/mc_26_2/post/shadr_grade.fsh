#version 330

#moj_import <shadr_world_mask.glsl>

uniform sampler2D InSampler;
uniform sampler2D MainDepthSampler;
uniform sampler2D TranslucentDepthSampler;
uniform sampler2D ItemEntityDepthSampler;

layout(std140) uniform SamplerInfo {
    vec2 OutSize;
    vec2 InSize;
};

layout(std140) uniform ShadrGradeConfig {
    vec4 Tone;
    vec4 Balance;
    vec4 Shadows;
    vec4 Midtones;
    vec4 Highlights;
    vec4 Optics;
    vec4 Grain;
};

in vec2 texCoord;
out vec4 fragColor;

#define GRADE_DEBUG 0

vec3 shadr_white_balance(vec3 colour, float temperature, float tint) {
    float t = temperature / 100.0;
    float g = tint / 100.0;
    vec3 scale = vec3(1.0 + 0.24 * t, 1.0 + 0.20 * g, 1.0 - 0.24 * t);
    return colour * scale;
}

vec3 shadr_vibrance(vec3 colour, float amount) {
    float luma = shadr_luma(colour);
    float peak = max(colour.r, max(colour.g, colour.b));
    float trough = min(colour.r, min(colour.g, colour.b));
    float sat = peak - trough;
    return mix(vec3(luma), colour, 1.0 + amount * (1.0 - sat));
}
vec3 shadr_balance(vec3 colour, vec3 shadows, vec3 midtones, vec3 highlights) {
    vec3 lift = (shadows - 0.5) * 0.5;
    vec3 gamma = 1.0 / clamp(1.0 + (midtones - 0.5) * 2.0, vec3(0.1), vec3(4.0));
    vec3 gain = clamp(1.0 + (highlights - 0.5) * 2.0, vec3(0.0), vec3(4.0));
    vec3 lifted = clamp(colour + lift * (1.0 - colour), vec3(0.0), vec3(8.0));
    return pow(max(lifted * gain, vec3(0.0)), gamma);
}

vec3 shadr_sample_aberrated(vec2 uv, float amount) {
    if (amount <= 0.0001) return texture(InSampler, uv).rgb;
    vec2 centred = uv - 0.5;
    float shift = amount * 0.01;
    return vec3(
        texture(InSampler, 0.5 + centred * (1.0 - shift)).r,
        texture(InSampler, uv).g,
        texture(InSampler, 0.5 + centred * (1.0 + shift)).b);
}

vec3 shadr_sharpen(vec3 colour, vec2 uv, float amount) {
    if (amount <= 0.0001) return colour;
    vec2 texel = 1.0 / max(InSize, vec2(1.0));
    vec3 blur = texture(InSampler, uv + vec2(texel.x, 0.0)).rgb
        + texture(InSampler, uv - vec2(texel.x, 0.0)).rgb
        + texture(InSampler, uv + vec2(0.0, texel.y)).rgb
        + texture(InSampler, uv - vec2(0.0, texel.y)).rgb;
    return colour + (colour - blur * 0.25) * amount;
}

void main() {
    vec4 source = texture(InSampler, texCoord);
    if (shadr_ui_here(MainDepthSampler, TranslucentDepthSampler, ItemEntityDepthSampler, texCoord)) {
        fragColor = source;
        return;
    }

    float exposure = Tone.x;
    float contrast = Tone.y;
    float pivot = Tone.z;
    int tonemap = int(Tone.w + 0.5);

    vec3 colour = shadr_sample_aberrated(texCoord, Optics.w);
    colour = shadr_sharpen(colour, texCoord, Grain.z);

    colour *= exp2(exposure);
    colour = shadr_balance(colour, Shadows.rgb, Midtones.rgb, Highlights.rgb);
    colour = shadr_white_balance(colour, Balance.z, Balance.w);
    colour = max(colour, vec3(0.0));
    colour = (colour - pivot) * contrast + pivot;
    colour = max(colour, vec3(0.0));
    colour = mix(vec3(shadr_luma(colour)), colour, Balance.x);
    colour = shadr_vibrance(colour, Balance.y);
    colour = shadr_tonemap(max(colour, vec3(0.0)), tonemap);

    float amount = Optics.x;
    if (amount > 0.0001) {
        vec2 centred = (texCoord - 0.5) * vec2(mix(1.0, InSize.x / max(InSize.y, 1.0), Optics.y), 1.0);
        float falloff = smoothstep(0.75, 0.75 - max(Optics.z, 0.01), length(centred));
        colour *= mix(1.0, falloff, amount);
    }

    float grain = Grain.x;
    if (grain > 0.0001) {
        float noise = shadr_hash12(floor(gl_FragCoord.xy / max(Grain.y, 0.5))) - 0.5;
        colour += noise * grain * 0.25;
    }

#if GRADE_DEBUG == 1
    fragColor = vec4(vec3(shadr_luma(colour)), 1.0);
    return;
#endif

    fragColor = vec4(clamp(colour, 0.0, 1.0), source.a);
}
