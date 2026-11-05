#version 330

#moj_import <minecraft:globals.glsl>
#moj_import <shadr_stream.glsl>

uniform sampler2D InSampler;
uniform sampler2D LastStateSampler;

layout(std140) uniform ShadrStreamConfig {
    vec4 Region;
    vec4 Layout;
};

in vec2 texCoord;
out vec4 fragColor;

#define SHADR_METER_WINDOW (1.0 / 1200.0)

void main() {
    vec2 screenSize = vec2(textureSize(InSampler, 0));
    int columns = int(Region.z + 0.5);
    int rows = int(Region.w + 0.5);
    ivec2 origin = shadr_stream_region_origin(screenSize, Region.xy, columns, rows);
    ivec2 slot0 = shadr_stream_slot_origin(origin, 0, columns);

    int magicLo = shadr_map_word(texelFetch(InSampler, shadr_stream_pixel_for(slot0, ivec2(SHADR_STREAM_W_MAGIC_LOW, 0)), 0));
    int magicHi = shadr_map_word(texelFetch(InSampler, shadr_stream_pixel_for(slot0, ivec2(SHADR_STREAM_W_MAGIC_HIGH, 0)), 0));
    int flags = shadr_map_word(texelFetch(InSampler, shadr_stream_pixel_for(slot0, ivec2(SHADR_STREAM_W_FLAGS, 0)), 0));
    int serialLo = shadr_map_word(texelFetch(InSampler, shadr_stream_pixel_for(slot0, ivec2(SHADR_STREAM_W_SERIAL_LOW, 0)), 0));
    int serialHi = shadr_map_word(texelFetch(InSampler, shadr_stream_pixel_for(slot0, ivec2(SHADR_STREAM_W_SERIAL_HIGH, 0)), 0));

    bool live = magicLo == SHADR_STREAM_MAGIC_LOW && magicHi == SHADR_STREAM_MAGIC_HIGH
            && (flags & SHADR_STREAM_FLAG_ACTIVE) != 0;

    ivec4 last = ivec4(round(texelFetch(LastStateSampler, ivec2(0, 0), 0) * 255.0));
    bool primed = last.a >= 128;
    bool fresh = live && (!primed || last.r != serialLo || last.g != serialHi);

    if (int(gl_FragCoord.x) == 0) {
        fragColor = vec4(
            float(serialLo) / 255.0,
            float(serialHi) / 255.0,
            fresh ? 1.0 : 0.0,
            live ? 1.0 : 0.0);
        return;
    }

    ivec4 meter = ivec4(round(texelFetch(LastStateSampler, ivec2(1, 0), 0) * 255.0));
    int count = meter.r;
    int shown = meter.g;
    float windowStart = float(meter.b | (meter.a << 8)) / 65535.0;
    float now = fract(GameTime);

    if (fresh && count < 255) count++;
    float elapsed = fract(now - windowStart + 1.0);
    if (!primed || elapsed >= SHADR_METER_WINDOW) {
        shown = primed ? count : 0;
        count = 0;
        windowStart = now;
    }

    int packedBits = int(round(windowStart * 65535.0));
    fragColor = vec4(
        float(count) / 255.0,
        float(min(shown, 255)) / 255.0,
        float(packedBits & 0xFF) / 255.0,
        float((packedBits >> 8) & 0xFF) / 255.0);
}
