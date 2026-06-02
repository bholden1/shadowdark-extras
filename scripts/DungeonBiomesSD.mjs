// DungeonBiomesSD.mjs
//
// Biome theming for the procedural dungeon generator: each room is assigned a
// biome (crypt, library, temple, …) that sets its floor texture and scatters
// themed props. Floors + props use shipped assets out of the box; if the user
// has imported a Dungeondraft decor pack with a matching category, those props
// are mixed in too (best-effort, never required).

const MODULE_ID = "shadowdark-extras";
const GRID_SIZE = 100;

const FilePicker = foundry.applications.apps.FilePicker?.implementation ?? globalThis.FilePicker;

const FLOOR = (f) => `modules/${MODULE_ID}/assets/Dungeon/floor_tiles/${f}`;
const CLUT = (f) => `modules/${MODULE_ID}/assets/Dungeon/clutter/${f}`;

/**
 * Biome definitions. floor = shipped floor tile; props = shipped clutter
 * (filenames carry -WxH); ddpack = decor-library category name to also pull
 * from if present; weight = relative frequency when assigning.
 */
export const BIOME_DEFS = {
    hall:       { label: "Hall",       floor: FLOOR("DQ_Floor_Stone_01.webp"),         props: [CLUT("pillar-50x50.png"), CLUT("statue-100x100.png")],                              ddpack: "hall",       weight: 2 },
    crypt:      { label: "Crypt",      floor: FLOOR("DQ_Floor_Stone_05_black.webp"),   props: [CLUT("skull-26x30.png"), CLUT("statue2-100x100.png"), CLUT("rubble-100x100.png")], ddpack: "crypt",      weight: 1 },
    library:    { label: "Library",    floor: FLOOR("DQ_Floor_Stone_04_yellow.webp"),  props: [CLUT("paper-50x50.png"), CLUT("pillar-50x50.png")],                                 ddpack: "library",    weight: 1 },
    temple:     { label: "Temple",     floor: FLOOR("DQ_Floor_Stone_02_blue.webp"),    props: [CLUT("statue-100x100.png"), CLUT("fountain-100x100.png"), CLUT("pillar-50x50.png")], ddpack: "temple",     weight: 1 },
    laboratory: { label: "Laboratory", floor: FLOOR("DQ_Floor_Stone_03.webp"),         props: [CLUT("glass-50x50.png"), CLUT("paper-50x50.png")],                                  ddpack: "laboratory", weight: 1 },
    barracks:   { label: "Barracks",   floor: FLOOR("DQ_Floor_Cobble_01A.webp"),       props: [CLUT("rubble2-100x100.png")],                                                       ddpack: "barracks",   weight: 1 },
    prison:     { label: "Prison",     floor: FLOOR("DQ_Floor_Stone_02_black.webp"),   props: [CLUT("skull-26x30.png"), CLUT("rubble-100x100.png")],                               ddpack: "prison",     weight: 1 },
    storage:    { label: "Storage",    floor: FLOOR("DQ_Floor_Cobble_02A_light.webp"), props: [CLUT("rubble2-100x100.png"), CLUT("glass-50x50.png")],                              ddpack: "storage",    weight: 1 },
    ruins:      { label: "Ruins",      floor: FLOOR("DQ_Floor_Stone_04_red.webp"),     props: [CLUT("rubble-100x100.png"), CLUT("rubble2-100x100.png"), CLUT("pillar-50x50.png")], ddpack: "ruins",      weight: 2 },
};

/**
 * Assign a biome to each room. Returns Map(roomIndex -> biomeKey). The start
 * room is a "hall" (entrance); the rest are weighted-random from `enabled`.
 */
export function assignBiomes(roomData, rng, enabled = null) {
    const keys = (enabled && enabled.length ? enabled : Object.keys(BIOME_DEFS)).filter(k => BIOME_DEFS[k]);
    const pool = [];
    for (const k of keys) for (let i = 0; i < (BIOME_DEFS[k].weight || 1); i++) pool.push(k);
    const map = new Map();
    roomData.forEach((rd, i) => {
        if (rd.isStart && BIOME_DEFS.hall) { map.set(i, "hall"); return; }
        map.set(i, pool.length ? pool[Math.floor(rng() * pool.length)] : "hall");
    });
    return map;
}

/**
 * Map each room-interior floor cell to its biome's floor texture.
 * Returns Map("gx,gy" -> texturePath). Corridors / cave cells are absent
 * (caller falls back to the default floor for those).
 */
export function buildCellFloorMap(roomData, biomeMap, floors) {
    const cellFloor = new Map();
    roomData.forEach((rd, i) => {
        const biome = biomeMap.get(i);
        const def = biome && BIOME_DEFS[biome];
        if (!def) return;
        const room = rd.room;
        for (let gx = room.left; gx < room.right; gx++) {
            for (let gy = room.top; gy < room.bottom; gy++) {
                const k = `${gx},${gy}`;
                if (floors.has(k)) cellFloor.set(k, def.floor);
            }
        }
    });
    return cellFloor;
}

/** Best-effort: image files in an imported decor pack folder matching `category`. */
async function findDDPackProps(category) {
    if (!category) return [];
    const isImg = (f) => /\.(png|webp|jpg|jpeg)$/i.test(f);
    const roots = ["decor/ddpacks", "decor"];
    for (const root of roots) {
        try {
            const top = await FilePicker.browse("data", root);
            for (const dir of (top.dirs || [])) {
                if (dir.split("/").pop().toLowerCase().includes(category.toLowerCase())) {
                    const sub = await FilePicker.browse("data", dir);
                    const files = (sub.files || []).filter(isImg);
                    if (files.length) return files.slice(0, 12);
                }
            }
        } catch (e) { /* path absent — fine */ }
    }
    return [];
}

/** Resolve a biome's prop list to [{src, w, h}] (shipped + any DDPack matches). */
async function resolveBiomeProps(def) {
    const items = [];
    for (const p of def.props) {
        const m = p.match(/-(\d+)x(\d+)\.\w+$/i);
        items.push({ src: p, w: m ? +m[1] : GRID_SIZE, h: m ? +m[2] : GRID_SIZE });
    }
    for (const f of await findDDPackProps(def.ddpack)) {
        items.push({ src: f, w: GRID_SIZE, h: GRID_SIZE });
    }
    return items;
}

/**
 * Scatter biome props inside each non-start room. Returns Tile create-data
 * (same shape/flags as generic clutter so cleanup catches them).
 */
export async function placeBiomeProps(roomData, biomeMap, offset, gridSize, perRoom, rng) {
    const cache = new Map();
    const tiles = [];
    for (let i = 0; i < roomData.length; i++) {
        const rd = roomData[i];
        if (rd.isStart) continue;
        const biome = biomeMap.get(i);
        const def = biome && BIOME_DEFS[biome];
        if (!def) continue;

        if (!cache.has(biome)) cache.set(biome, await resolveBiomeProps(def));
        const items = cache.get(biome);
        if (!items.length) continue;

        const room = rd.room;
        const occupied = new Set();
        for (let c = 0; c < perRoom; c++) {
            const item = items[Math.floor(rng() * items.length)];
            const cellsW = Math.max(1, Math.ceil(item.w / gridSize));
            const cellsH = Math.max(1, Math.ceil(item.h / gridSize));
            const fitW = room.w - (cellsW - 1);
            const fitH = room.h - (cellsH - 1);
            if (fitW < 1 || fitH < 1) continue;

            let gx, gy, overlaps, tries = 0;
            do {
                gx = room.left + Math.floor(rng() * fitW);
                gy = room.top + Math.floor(rng() * fitH);
                overlaps = false;
                for (let ox = 0; ox < cellsW && !overlaps; ox++)
                    for (let oy = 0; oy < cellsH && !overlaps; oy++)
                        if (occupied.has(`${gx + ox},${gy + oy}`)) overlaps = true;
                tries++;
            } while (overlaps && tries < 20);
            if (overlaps) continue;

            for (let ox = 0; ox < cellsW; ox++)
                for (let oy = 0; oy < cellsH; oy++)
                    occupied.add(`${gx + ox},${gy + oy}`);

            tiles.push({
                texture: { src: item.src, anchorX: 0, anchorY: 0 },
                x: (gx + offset.x) * gridSize + (cellsW * gridSize - item.w) / 2,
                y: (gy + offset.y) * gridSize + (cellsH * gridSize - item.h) / 2,
                width: item.w,
                height: item.h,
                sort: 10,
                flags: { [MODULE_ID]: { dungeonClutter: true, dungeonBiomeProp: true, biome } }
            });
        }
    }
    return tiles;
}
