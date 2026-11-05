#version 330

#moj_import <minecraft:fog.glsl>
#moj_import <minecraft:globals.glsl>
#moj_import <shadr_sun.glsl>

#define CLOUD_DEBUG 0

in float vertexDistance;
in vec4 vertexColor;
in vec3 cloudPosition;
flat in int cloudFace;
flat in float cloudLayerY;

out vec4 fragColor;

const float THICKNESS = 34.0;

const float MAX_MARCH = 260.0;

const int STEPS = 18;
const int LIGHT_STEPS = 3;

const float NOISE_SCALE = 1.0 / 46.0;

const float COVERAGE = 0.46;

const float DENSITY = 0.14;

const float LATERAL_FALLOFF = 1.0 / (55.0 * 55.0);

const float LIGHT_STEP = 6.0;

const float ABSORPTION = 1.15;

const vec2 WIND = vec2(1.6, 0.4);

float cloud_hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float cloud_noise(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = cloud_hash(cell);
    float n100 = cloud_hash(cell + vec3(1.0, 0.0, 0.0));
    float n010 = cloud_hash(cell + vec3(0.0, 1.0, 0.0));
    float n110 = cloud_hash(cell + vec3(1.0, 1.0, 0.0));
    float n001 = cloud_hash(cell + vec3(0.0, 0.0, 1.0));
    float n101 = cloud_hash(cell + vec3(1.0, 0.0, 1.0));
    float n011 = cloud_hash(cell + vec3(0.0, 1.0, 1.0));
    float n111 = cloud_hash(cell + vec3(1.0, 1.0, 1.0));

    return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
        f.z
    );
}

float cloud_fbm(vec3 p) {
    float sum = cloud_noise(p) * 0.52;
    sum += cloud_noise(p * 2.03 + 17.3) * 0.28;
    sum += cloud_noise(p * 4.11 + 41.7) * 0.14;
    sum += cloud_noise(p * 8.36 + 89.1) * 0.06;
    return sum;
}

float cloud_profile(float y) {
    float height = clamp((y - cloudLayerY) / THICKNESS, 0.0, 1.0);
    return smoothstep(0.0, 0.18, height) * smoothstep(1.0, 0.4, height) *
        mix(0.85, 1.1, height);
}

float cloud_density(vec3 p, vec2 drift) {
    float profile = cloud_profile(p.y);
    if (profile <= 0.0) return 0.0;
    vec3 q = vec3(p.x + drift.x, p.y, p.z + drift.y);
    float shape = cloud_fbm(q * NOISE_SCALE);
    return max(0.0, shape - COVERAGE) * (1.0 / (1.0 - COVERAGE)) * profile;
}

float cloud_transmittance_to_light(vec3 p, vec3 lightDir, vec2 drift) {
    float optical = 0.0;
    for (int i = 1; i <= LIGHT_STEPS; i++) {
        vec3 at = p + lightDir * (LIGHT_STEP * float(i));
        optical += cloud_density(at, drift);
    }
    return exp(-optical * ABSORPTION * LIGHT_STEP * 0.35);
}

float cloud_phase(float mu, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
}

void main() {
#if CLOUD_DEBUG == 1
    fragColor = vec4(1.0, 0.0, 1.0, 1.0);
    return;
#endif

    if (cloudFace >= 2) discard;

#if CLOUD_DEBUG == 3
    fragColor = vec4(normalize(cloudPosition) * 0.5 + 0.5, 1.0);
    return;
#endif

    float dayFactor;
    vec3 lightDir = shadr_celestial_world(GameTime, dayFactor);
    float horizonGlow = 1.0 - clamp(abs(lightDir.y) * 3.0, 0.0, 1.0);

    vec3 lit = mix(vec3(0.32, 0.36, 0.52), vec3(1.08, 1.04, 0.98), dayFactor);
    lit = mix(lit, vec3(1.15, 0.72, 0.46), horizonGlow * dayFactor);
    vec3 shadow = mix(vec3(0.10, 0.12, 0.20), vec3(0.50, 0.56, 0.72), dayFactor);
    vec3 ambient = mix(vec3(0.12, 0.14, 0.22), vec3(0.68, 0.74, 0.86), dayFactor);

    vec2 drift = WIND * GameTime * 1200.0;

    vec3 rayDirection = normalize(cloudPosition);
    vec3 origin = cloudPosition;

    float bottom = cloudLayerY;
    float top = cloudLayerY + THICKNESS;
    float exit = MAX_MARCH;
    if (abs(rayDirection.y) > 1.0e-4) {
        float toTop = (top - origin.y) / rayDirection.y;
        float toBottom = (bottom - origin.y) / rayDirection.y;
        exit = clamp(max(toTop, toBottom), 0.0, MAX_MARCH);
    }
    if (exit <= 0.0) discard;

    float mu = dot(rayDirection, lightDir);
    float phase = mix(cloud_phase(mu, 0.55), cloud_phase(mu, -0.2), 0.3) * 12.0;

    float stepSize = exit / float(STEPS);
    float transmittance = 1.0;
    vec3 scattered = vec3(0.0);

    float jitter = cloud_hash(vec3(gl_FragCoord.xy, fract(GameTime * 977.0)));

    for (int i = 0; i < STEPS; i++) {
        float along = (float(i) + jitter) * stepSize;
        vec3 p = origin + rayDirection * along;
        float density = cloud_density(p, drift);
        if (density <= 0.0) continue;

        density *= 1.0 - smoothstep(MAX_MARCH * 0.8, MAX_MARCH, along);

        float lateral = length((p - origin).xz);
        density *= exp(-lateral * lateral * LATERAL_FALLOFF);
        if (density <= 0.0) continue;

        float toLight = cloud_transmittance_to_light(p, lightDir, drift);
        float powder = 1.0 - exp(-density * 4.0);
        vec3 colour = ambient * 0.35 + mix(shadow, lit, toLight) * phase * powder;

        float absorbed = clamp(density * DENSITY * stepSize, 0.0, 1.0);
        scattered += colour * absorbed * transmittance;
        transmittance *= 1.0 - absorbed;
        if (transmittance < 0.01) break;
    }

    float alpha = 1.0 - transmittance;

#if CLOUD_DEBUG == 2
    fragColor = vec4(vec3(alpha), 1.0);
    return;
#endif

    if (alpha < 0.01) discard;

    vec3 colour = (scattered / max(alpha, 1.0e-4)) * vertexColor.rgb;

    alpha *= 1.0f - linear_fog_value(vertexDistance, 0, FogCloudsEnd);
    fragColor = vec4(colour, alpha * vertexColor.a);
}
