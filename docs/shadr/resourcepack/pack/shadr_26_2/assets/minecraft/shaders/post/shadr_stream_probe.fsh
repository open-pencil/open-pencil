#version 330

#moj_import <shadr_stream.glsl>

uniform sampler2D InSampler;

layout(std140) uniform ShadrStreamConfig {
    vec4 Region;
    vec4 Layout;
};

in vec2 texCoord;
out vec4 fragColor;

#define SHADR_PROBE_PASS vec4(0.06, 0.72, 0.20, 1.0)
#define SHADR_PROBE_FAIL vec4(0.90, 0.06, 0.06, 1.0)
#define SHADR_PROBE_SKIP vec4(0.05, 0.28, 0.62, 1.0)
#define SHADR_PROBE_IDLE vec4(0.02, 0.02, 0.02, 1.0)

#define SHADR_PROBE_MODE_VERDICT 0
#define SHADR_PROBE_MODE_RAW 1
#define SHADR_PROBE_MODE_WORD 2
#define SHADR_PROBE_MODE_REGION 3
#define SHADR_PROBE_MODE_IMAGE 4
#define SHADR_PROBE_MODE_BLOCKS 5

int shadr_block_expand5(int v) { return (v << 3) | (v >> 2); }
int shadr_block_expand6(int v) { return (v << 2) | (v >> 4); }

vec3 shadr_block_endpoint(int packedBits) {
    return vec3(
        float(shadr_block_expand5((packedBits >> 11) & 0x1F)),
        float(shadr_block_expand6((packedBits >> 5) & 0x3F)),
        float(shadr_block_expand5(packedBits & 0x1F))) / 255.0;
}

int shadr_probe_word(sampler2D source, ivec2 regionOrigin, int columns, int slot, int index) {
    ivec2 slotOrigin = shadr_stream_slot_origin(regionOrigin, slot, columns);
    ivec2 word = ivec2(index % SHADR_MAP_EDGE, index / SHADR_MAP_EDGE);
    return shadr_map_word(texelFetch(source, shadr_stream_pixel_for(slotOrigin, word), 0));
}

void main() {
    vec2 screenSize = vec2(textureSize(InSampler, 0));
    ivec2 pixel = ivec2(floor(texCoord * screenSize));

    int columns = int(Region.z + 0.5);
    int rows = int(Region.w + 0.5);
    int slots = int(Layout.x + 0.5);
    int mode = int(Layout.y + 0.5);

    ivec2 regionOrigin = shadr_stream_region_origin(screenSize, Region.xy, columns, rows);
    if (!shadr_stream_in_region(regionOrigin, columns, rows, pixel)) {
        fragColor = texture(InSampler, texCoord);
        return;
    }

    ivec2 local = pixel - regionOrigin;

    if (mode == SHADR_PROBE_MODE_IMAGE) {
        ivec2 size = shadr_stream_region_size(columns, rows);
        ivec2 image = ivec2(local.x, size.y - 1 - local.y) / 2;
        ivec2 tile = ivec2(image.x / SHADR_IMAGE_TILE_WIDTH, image.y / SHADR_IMAGE_TILE_HEIGHT);
        int imageSlot = tile.y * columns + tile.x;
        if (tile.x >= columns || tile.y >= rows || imageSlot >= slots) {
            fragColor = SHADR_PROBE_IDLE;
            return;
        }
        int px = image.x % SHADR_IMAGE_TILE_WIDTH;
        int py = image.y % SHADR_IMAGE_TILE_HEIGHT;
        int base = SHADR_IMAGE_PAYLOAD_BASE + (py * SHADR_IMAGE_TILE_WIDTH + px) * SHADR_IMAGE_WORDS_PER_PIXEL;
        int w0 = shadr_probe_word(InSampler, regionOrigin, columns, imageSlot, base);
        int w1 = shadr_probe_word(InSampler, regionOrigin, columns, imageSlot, base + 1);
        int w2 = shadr_probe_word(InSampler, regionOrigin, columns, imageSlot, base + 2);
        int w3 = shadr_probe_word(InSampler, regionOrigin, columns, imageSlot, base + 3);
        if (w0 < 0 || w1 < 0 || w2 < 0 || w3 < 0) {
            fragColor = vec4(1.0, 0.0, 1.0, 1.0);
            return;
        }
        int packedBits = w0 | (w1 << 7) | (w2 << 14) | (w3 << 21);
        fragColor = vec4(
            float((packedBits >> 16) & 0xFF) / 255.0,
            float((packedBits >> 8) & 0xFF) / 255.0,
            float(packedBits & 0xFF) / 255.0,
            1.0);
        return;
    }

    if (mode == SHADR_PROBE_MODE_BLOCKS) {
        ivec2 size = shadr_stream_region_size(columns, rows);
        ivec2 image = ivec2(local.x, size.y - 1 - local.y) * SHADR_BLOCK_TILE_WIDTH * columns / size.x;
        ivec2 tile = ivec2(image.x / SHADR_BLOCK_TILE_WIDTH, image.y / SHADR_BLOCK_TILE_HEIGHT);
        int blockSlot = tile.y * columns + tile.x;
        if (tile.x >= columns || tile.y >= rows || blockSlot >= slots) {
            fragColor = SHADR_PROBE_IDLE;
            return;
        }
        int lx = image.x % SHADR_BLOCK_TILE_WIDTH;
        int ly = image.y % SHADR_BLOCK_TILE_HEIGHT;
        int base = SHADR_BLOCK_PAYLOAD_BASE
                + (ly / SHADR_BLOCK_EDGE * SHADR_BLOCKS_X + lx / SHADR_BLOCK_EDGE) * SHADR_BLOCK_WORDS;

        int w[10];
        for (int i = 0; i < 10; i++) {
            w[i] = shadr_probe_word(InSampler, regionOrigin, columns, blockSlot, base + i);
            if (w[i] < 0) {
                fragColor = vec4(1.0, 0.0, 1.0, 1.0);
                return;
            }
        }

        int lo = w[0] | (w[1] << 7) | (w[2] << 14) | (w[3] << 21) | ((w[4] & 0xF) << 28);
        int hi = w[5] | (w[6] << 7) | (w[7] << 14) | (w[8] << 21) | ((w[9] & 0xF) << 28);

        int e0 = lo & 0xFFFF;
        int e1 = (lo >> 16) & 0xFFFF;
        vec3 c0 = shadr_block_endpoint(e0);
        vec3 c1 = shadr_block_endpoint(e1);

        int selectors = (hi >> ((ly % SHADR_BLOCK_EDGE) * 8)) & 0xFF;
        int choice = (selectors >> ((lx % SHADR_BLOCK_EDGE) * 2)) & 3;

        vec3 colour;
        if (choice == 0) {
            colour = c0;
        } else if (choice == 1) {
            colour = c1;
        } else if (e0 > e1) {
            colour = choice == 2 ? floor((2.0 * c0 + c1) * 255.0 / 3.0) / 255.0
                                 : floor((c0 + 2.0 * c1) * 255.0 / 3.0) / 255.0;
        } else {
            colour = choice == 2 ? floor((c0 + c1) * 255.0 / 2.0) / 255.0 : vec3(0.0);
        }
        fragColor = vec4(colour, 1.0);
        return;
    }

    int slot = local.y / SHADR_MAP_EDGE * columns + local.x / SHADR_MAP_EDGE;
    if (slot >= slots) {
        fragColor = SHADR_PROBE_IDLE;
        return;
    }

    ivec2 slotOrigin = shadr_stream_slot_origin(regionOrigin, slot, columns);
    ivec2 word = shadr_stream_word_at(slotOrigin, pixel);
    int index = word.y * SHADR_MAP_EDGE + word.x;
    int actual = shadr_map_word(texelFetch(InSampler, pixel, 0));

    if (mode == SHADR_PROBE_MODE_RAW) {
        fragColor = vec4(vec3(float(texelFetch(InSampler, pixel, 0).r)), 1.0);
        return;
    }
    if (mode == SHADR_PROBE_MODE_WORD) {
        fragColor = actual < 0
                ? vec4(1.0, 0.0, 1.0, 1.0)
                : vec4(vec3(float(actual) / float(SHADR_MAP_WORDS - 1)), 1.0);
        return;
    }
    if (mode == SHADR_PROBE_MODE_REGION) {
        fragColor = vec4(0.0, 1.0, 1.0, 1.0);
        return;
    }

    int expected;
    if (index < SHADR_STREAM_HEADER_WORDS) {
        if (index == SHADR_STREAM_W_MAGIC_LOW) {
            expected = SHADR_STREAM_MAGIC_LOW;
        } else if (index == SHADR_STREAM_W_MAGIC_HIGH) {
            expected = SHADR_STREAM_MAGIC_HIGH;
        } else if (index == SHADR_STREAM_W_VERSION) {
            expected = SHADR_STREAM_VERSION;
        } else if (index == SHADR_STREAM_W_SLOT) {
            expected = slot;
        } else if (index == SHADR_STREAM_W_SLOT_COLUMNS) {
            expected = columns;
        } else if (index == SHADR_STREAM_W_SLOT_ROWS) {
            expected = rows;
        } else if (index == SHADR_STREAM_W_FLAGS) {
            expected = SHADR_STREAM_FLAG_ACTIVE;
        } else {
            fragColor = SHADR_PROBE_SKIP;
            return;
        }
    } else {
        expected = index % SHADR_MAP_WORDS;
    }

    fragColor = actual == expected ? SHADR_PROBE_PASS : SHADR_PROBE_FAIL;
}
