#define SHADR_MAP_EDGE 128
#define SHADR_MAP_WORD_BITS 7
#define SHADR_MAP_WORDS 128
#define SHADR_MAP_NO_WORD -1

const int SHADR_MAP_WORD[256] = int[256](
    0,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,-1,-1,2,-1,3,
    -1,4,5,6,7,8,9,-1,-1,10,11,12,-1,-1,13,14,
    -1,15,-1,-1,16,17,-1,18,19,-1,-1,-1,20,21,22,-1,
    23,24,25,26,27,28,29,30,-1,31,32,33,34,35,-1,36,
    37,38,-1,39,40,-1,41,42,43,-1,44,45,46,-1,47,48,
    -1,49,-1,-1,50,-1,51,52,53,54,-1,55,56,-1,57,58,
    59,-1,60,-1,61,-1,62,63,64,65,66,-1,67,68,69,70,
    71,-1,72,73,74,75,-1,-1,-1,76,77,78,-1,79,-1,80,
    81,82,83,84,85,86,-1,87,-1,88,89,-1,90,91,92,93,
    94,-1,-1,95,96,97,-1,98,99,100,-1,-1,-1,-1,-1,101,
    102,103,-1,104,105,-1,-1,106,-1,-1,107,108,-1,-1,109,-1,
    110,-1,111,-1,112,-1,-1,-1,-1,-1,113,-1,-1,114,-1,-1,
    -1,-1,-1,-1,-1,115,-1,116,-1,-1,-1,-1,-1,-1,-1,-1,
    117,118,-1,-1,-1,119,-1,120,121,-1,-1,-1,122,-1,-1,-1,
    -1,-1,-1,-1,-1,123,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,124,-1,-1,-1,-1,125,-1,-1,126,-1,-1,-1,-1,127
);

int shadr_map_word(vec4 texel) {
    return SHADR_MAP_WORD[int(texel.r * 255.0 + 0.5)];
}

#define SHADR_STREAM_VERSION 2
#define SHADR_STREAM_MAGIC_LOW 85
#define SHADR_STREAM_MAGIC_HIGH 86
#define SHADR_STREAM_HEADER_WORDS 16
#define SHADR_STREAM_W_MAGIC_LOW 0
#define SHADR_STREAM_W_MAGIC_HIGH 1
#define SHADR_STREAM_W_VERSION 2
#define SHADR_STREAM_W_SLOT 3
#define SHADR_STREAM_W_STREAM 4
#define SHADR_STREAM_W_SERIAL_LOW 5
#define SHADR_STREAM_W_SERIAL_HIGH 6
#define SHADR_STREAM_W_REGION_X_LOW 7
#define SHADR_STREAM_W_REGION_X_HIGH 8
#define SHADR_STREAM_W_REGION_Y_LOW 9
#define SHADR_STREAM_W_REGION_Y_HIGH 10
#define SHADR_STREAM_W_SLOT_COLUMNS 11
#define SHADR_STREAM_W_SLOT_ROWS 12
#define SHADR_STREAM_W_FLAGS 13
#define SHADR_STREAM_FLAG_ACTIVE 1
#define SHADR_STREAM_DESIGN_WIDTH 1920.0
#define SHADR_STREAM_DESIGN_HEIGHT 1080.0

int shadr_stream_join(int low, int high) {
    return (high << SHADR_MAP_WORD_BITS) | low;
}

ivec2 shadr_stream_region_size(int columns, int rows) {
    return ivec2(columns, rows) * SHADR_MAP_EDGE;
}

ivec2 shadr_stream_region_origin(vec2 screenSize, vec2 designOrigin, int columns, int rows) {
    vec2 size = vec2(shadr_stream_region_size(columns, rows));
    float x = designOrigin.x / SHADR_STREAM_DESIGN_WIDTH * screenSize.x;
    float y = screenSize.y - designOrigin.y / SHADR_STREAM_DESIGN_HEIGHT * screenSize.y - size.y;
    vec2 limit = max(screenSize - size, vec2(0.0));
    return ivec2(floor(clamp(vec2(x, y), vec2(0.0), limit) + 0.5));
}

ivec2 shadr_stream_slot_origin(ivec2 regionOrigin, int slot, int columns) {
    return regionOrigin + ivec2(slot % columns, slot / columns) * SHADR_MAP_EDGE;
}

ivec2 shadr_stream_word_at(ivec2 slotOrigin, ivec2 pixel) {
    ivec2 local = pixel - slotOrigin;
    return ivec2(local.x, SHADR_MAP_EDGE - 1 - local.y);
}

ivec2 shadr_stream_pixel_for(ivec2 slotOrigin, ivec2 word) {
    return ivec2(slotOrigin.x + word.x, slotOrigin.y + SHADR_MAP_EDGE - 1 - word.y);
}

bool shadr_stream_in_region(ivec2 regionOrigin, int columns, int rows, ivec2 pixel) {
    ivec2 local = pixel - regionOrigin;
    ivec2 size = shadr_stream_region_size(columns, rows);
    return local.x >= 0 && local.y >= 0 && local.x < size.x && local.y < size.y;
}

#define SHADR_IMAGE_WORDS_PER_PIXEL 4
#define SHADR_IMAGE_PAYLOAD_BASE 128
#define SHADR_IMAGE_TILE_WIDTH 64
#define SHADR_IMAGE_TILE_HEIGHT 63

#define SHADR_BLOCK_EDGE 4
#define SHADR_BLOCK_WORDS 10
#define SHADR_BLOCK_PAYLOAD_BASE 128
#define SHADR_BLOCKS_X 48
#define SHADR_BLOCKS_Y 27
#define SHADR_BLOCK_TILE_WIDTH 192
#define SHADR_BLOCK_TILE_HEIGHT 108

#define SHADR_CU 16
#define SHADR_CU_PLANE_WORDS 5
#define SHADR_CU_POOL_ENTRY_WORDS 160
#define SHADR_CU_MODE_SKIP 0
#define SHADR_CU_MODE_MC 1
#define SHADR_CU_MODE_SPLIT 2
#define SHADR_CU_MODE_RESIDUAL 3
#define SHADR_CU_MODE_INTRA 4
#define SHADR_CU_SUB 8
#define SHADR_CU_SPLIT_WORDS 8
#define SHADR_CU_RES_BLOCK 8
#define SHADR_CU_KEPT 4
#define SHADR_CU_RESIDUAL_WORDS 76
#define SHADR_CU_RESIDUAL_BIAS 64
#define SHADR_CU_LUMA_STEP 2
#define SHADR_CU_CHROMA_STEP 1
#define SHADR_CU_MV_BIAS 64
#define SHADR_CU_SLOT_PAYLOAD 16256
#define SHADR_CU_COLUMNS 120
#define SHADR_CU_ROWS 68
#define SHADR_CU_SPLIT_BASE 40800
#define SHADR_CU_RESIDUAL_BASE 106080
#define SHADR_CU_POOL_BASE 726240
#define SHADR_FRAME_WIDTH 1920
#define SHADR_FRAME_HEIGHT 1088
const int SHADR_CU_SIGN[32] = int[32](1,1,1,1,1,1,1,1,1,1,-1,-1,1,1,-1,-1,1,-1,-1,1,1,-1,-1,1,1,-1,1,-1,1,-1,1,-1);
int shadr_cu_arena(sampler2D source, ivec2 regionOrigin, int columns, int address) {
    int slot = address / SHADR_CU_SLOT_PAYLOAD;
    int off = address - slot * SHADR_CU_SLOT_PAYLOAD;
    int r = 1 + off / SHADR_MAP_EDGE;
    int c = off - (r - 1) * SHADR_MAP_EDGE;
    ivec2 slotOrigin = shadr_stream_slot_origin(regionOrigin, slot, columns);
    ivec2 px = ivec2(slotOrigin.x + c, slotOrigin.y + SHADR_MAP_EDGE - 1 - r);
    return shadr_map_word(texelFetch(source, px, 0));
}

int shadr_cu_join32(int w0, int w1, int w2, int w3, int w4) {
    return w0 | (w1 << 7) | (w2 << 14) | (w3 << 21) | ((w4 & 15) << 28);
}

ivec3 shadr_cu_endpoint(int p) {
    int r = (p >> 11) & 31;
    int g = (p >> 5) & 63;
    int b = p & 31;
    return ivec3((r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2));
}
