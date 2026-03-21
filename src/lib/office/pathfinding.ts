/**
 * 2D grid-based A* pathfinding for OfficeMap.
 *
 * Builds a nav grid from map objects (walls, furniture) and collision polygons,
 * then runs A* to produce collision-aware waypoint paths.
 *
 * Designed for the Phaser viewer but intentionally placed in `src/lib/office/`
 * so any office surface can reuse the same pathfinder without duplicating logic.
 */
import type { OfficeCollision, OfficeMap, OfficeMapObject } from "@/lib/office/schema";

// ---------------------------------------------------------------------------
// Grid constants
// ---------------------------------------------------------------------------

const DEFAULT_CELL_SIZE = 8;
const DEFAULT_PAD = 4;

// Asset IDs that represent solid obstacles agents cannot walk through.
// Mirrors the furniture-layer intent: desks, tables, walls, machines, etc.
const BLOCKING_ASSET_IDS = new Set([
  "desk_modern",
  "meeting_table",
  "wall_block",
  "arcade_machine",
  "coffee_station",
  "tv_wall",
]);

// Tags that mark an object as a solid obstacle regardless of asset ID.
const BLOCKING_TAGS = new Set(["wall", "desk", "table", "obstacle"]);

// Layer IDs whose objects should be evaluated for blocking.
const BLOCKING_LAYERS = new Set(["walls", "furniture"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NavGrid2D = {
  cells: Uint8Array;
  cols: number;
  rows: number;
  cellSize: number;
};

export type Waypoint = { x: number; y: number };

// ---------------------------------------------------------------------------
// Grid construction
// ---------------------------------------------------------------------------

/**
 * Returns true when `obj` should block agent movement.
 *
 * The check is deliberately broad: if an object lives on a blocking layer
 * _or_ carries a blocking tag _or_ matches a known solid asset, it blocks.
 */
const isBlocking = (obj: OfficeMapObject): boolean => {
  if (BLOCKING_LAYERS.has(obj.layerId)) return true;
  if (BLOCKING_ASSET_IDS.has(obj.assetId)) return true;
  for (const tag of obj.tags) {
    if (BLOCKING_TAGS.has(tag)) return true;
  }
  return false;
};

/**
 * Resolve approximate width/height for an asset.
 *
 * OfficeMapObject does not carry explicit dimensions, so we use a best-effort
 * lookup keyed on `assetId`.  Unknown assets get a conservative default.
 */
const ASSET_SIZE: Record<string, [number, number]> = {
  desk_modern: [64, 32],
  meeting_table: [160, 80],
  wall_block: [32, 32],
  arcade_machine: [32, 48],
  coffee_station: [64, 32],
  tv_wall: [80, 10],
  floor_tile: [32, 32],
  plant_potted: [32, 32],
};

const getAssetSize = (assetId: string): [number, number] =>
  ASSET_SIZE[assetId] ?? [32, 32];

/**
 * Build a nav grid from an OfficeMap.
 *
 * Objects on blocking layers and explicit collision polygons are rasterised
 * into the grid.  A small padding is added around each obstacle so agents
 * do not clip through corners.
 */
export function buildNavGrid2D(
  map: OfficeMap,
  cellSize: number = DEFAULT_CELL_SIZE,
  pad: number = DEFAULT_PAD,
): NavGrid2D {
  const cols = Math.ceil(map.canvas.width / cellSize);
  const rows = Math.ceil(map.canvas.height / cellSize);
  const cells = new Uint8Array(cols * rows);

  // --- Mark blocking objects -----------------------------------------------
  for (const obj of map.objects) {
    if (!isBlocking(obj)) continue;
    const [w, h] = getAssetSize(obj.assetId);

    // Objects are positioned at their center in the Phaser scene, so convert
    // to top-left for grid rasterisation.
    const x1 = obj.x - w / 2 - pad;
    const y1 = obj.y - h / 2 - pad;
    const x2 = obj.x + w / 2 + pad;
    const y2 = obj.y + h / 2 + pad;

    const c1 = Math.max(0, Math.floor(x1 / cellSize));
    const c2 = Math.min(cols - 1, Math.floor(x2 / cellSize));
    const r1 = Math.max(0, Math.floor(y1 / cellSize));
    const r2 = Math.min(rows - 1, Math.floor(y2 / cellSize));

    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        cells[r * cols + c] = 1;
      }
    }
  }

  // --- Mark explicit collision polygons ------------------------------------
  for (const collision of map.collisions) {
    if (!collision.blocked) continue;
    rasterisePolygon(collision, cells, cols, rows, cellSize, pad);
  }

  return { cells, cols, rows, cellSize };
}

/**
 * Rasterise a convex/concave collision polygon into the grid.
 *
 * Uses a simple bounding-box + point-in-polygon approach.  For the small
 * grids used in the Phaser office viewer this is fast enough and avoids
 * pulling in a full polygon rasteriser dependency.
 */
function rasterisePolygon(
  collision: OfficeCollision,
  cells: Uint8Array,
  cols: number,
  rows: number,
  cellSize: number,
  pad: number,
): void {
  const points = collision.shape.points;
  if (points.length < 3) return;

  // Bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const c1 = Math.max(0, Math.floor(minX / cellSize));
  const c2 = Math.min(cols - 1, Math.floor(maxX / cellSize));
  const r1 = Math.max(0, Math.floor(minY / cellSize));
  const r2 = Math.min(rows - 1, Math.floor(maxY / cellSize));

  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const px = c * cellSize + cellSize / 2;
      const py = r * cellSize + cellSize / 2;
      if (pointInPolygon(px, py, points)) {
        cells[r * cols + c] = 1;
      }
    }
  }
}

/**
 * Ray-casting point-in-polygon test.
 */
function pointInPolygon(
  px: number,
  py: number,
  vertices: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ---------------------------------------------------------------------------
// A* pathfinder
// ---------------------------------------------------------------------------

/**
 * Find a collision-aware path from (sx, sy) to (ex, ey) on the given grid.
 *
 * Returns an array of waypoints (excluding the start) the agent should walk
 * through in order.  Returns an empty array when no valid path exists — the
 * caller should treat this as "stay put" rather than falling back to direct
 * movement (which is the bug this module exists to fix).
 *
 * Diagonal moves are only allowed when both adjacent orthogonal cells are
 * clear (no corner-cutting).
 */
export function astar2D(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  grid: NavGrid2D,
): Waypoint[] {
  const { cells, cols, rows, cellSize } = grid;

  const toCell = (x: number, y: number) => ({
    c: clamp(Math.floor(x / cellSize), 0, cols - 1),
    r: clamp(Math.floor(y / cellSize), 0, rows - 1),
  });
  const cellCenter = (c: number, r: number): Waypoint => ({
    x: c * cellSize + cellSize / 2,
    y: r * cellSize + cellSize / 2,
  });

  let { c: sc, r: sr } = toCell(sx, sy);
  let { c: ec, r: er } = toCell(ex, ey);

  // If start or end is inside a blocked cell, find the nearest free cell.
  const startFree = findFreeCell(sc, sr, cells, cols, rows);
  const endFree = findFreeCell(ec, er, cells, cols, rows);
  if (!startFree || !endFree) return [];
  sc = startFree.c;
  sr = startFree.r;
  ec = endFree.c;
  er = endFree.r;

  if (sc === ec && sr === er) return [{ x: ex, y: ey }];

  // A* with binary-heap open set
  const nodeCount = cols * rows;
  const gCost = new Float32Array(nodeCount).fill(Infinity);
  const parent = new Int32Array(nodeCount).fill(-1);
  const visited = new Uint8Array(nodeCount);
  const startIdx = sr * cols + sc;
  const endIdx = er * cols + ec;
  gCost[startIdx] = 0;

  const open: [number, number][] = [];
  heapPush(open, [startIdx, heuristic(sc, sr, ec, er)]);

  const DIRS: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ];

  while (open.length > 0) {
    const entry = heapPop(open);
    if (!entry) break;
    const [current] = entry;
    if (visited[current]) continue;
    visited[current] = 1;

    if (current === endIdx) {
      // Reconstruct path
      const path: Waypoint[] = [];
      let node = current;
      while (node !== startIdx) {
        const c = node % cols;
        const r = Math.floor(node / cols);
        path.push(cellCenter(c, r));
        node = parent[node];
      }
      path.reverse();
      // Replace the last waypoint with the exact destination
      if (path.length > 0) {
        path[path.length - 1] = { x: ex, y: ey };
      } else {
        path.push({ x: ex, y: ey });
      }
      return path;
    }

    const cc = current % cols;
    const cr = Math.floor(current / cols);

    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (visited[ni] || cells[ni]) continue;

      // Prevent diagonal corner-cutting
      if (dc !== 0 && dr !== 0) {
        if (cells[cr * cols + (cc + dc)] || cells[(cr + dr) * cols + cc]) {
          continue;
        }
      }

      const ng = gCost[current] + cost;
      if (ng < gCost[ni]) {
        gCost[ni] = ng;
        parent[ni] = current;
        heapPush(open, [ni, ng + heuristic(nc, nr, ec, er)]);
      }
    }
  }

  // No path found — return empty (caller should not fall back to direct movement)
  return [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function heuristic(c1: number, r1: number, c2: number, r2: number): number {
  return Math.hypot(c2 - c1, r2 - r1);
}

function findFreeCell(
  c: number,
  r: number,
  cells: Uint8Array,
  cols: number,
  rows: number,
): { c: number; r: number } | null {
  if (!cells[r * cols + c]) return { c, r };
  for (let dist = 1; dist < 12; dist++) {
    for (let dr = -dist; dr <= dist; dr++) {
      for (let dc = -dist; dc <= dist; dc++) {
        if (Math.abs(dr) !== dist && Math.abs(dc) !== dist) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (!cells[nr * cols + nc]) return { c: nc, r: nr };
      }
    }
  }
  return null;
}

// Min-heap helpers
function heapPush(heap: [number, number][], entry: [number, number]): void {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) {
    const pi = Math.floor((i - 1) / 2);
    if (heap[pi][1] <= entry[1]) break;
    heap[i] = heap[pi];
    i = pi;
  }
  heap[i] = entry;
}

function heapPop(heap: [number, number][]): [number, number] | null {
  if (heap.length === 0) return null;
  const first = heap[0];
  const last = heap.pop();
  if (!last || heap.length === 0) return first;
  let i = 0;
  while (true) {
    const li = i * 2 + 1;
    const ri = li + 1;
    if (li >= heap.length) break;
    let si = li;
    if (ri < heap.length && heap[ri][1] < heap[li][1]) si = ri;
    if (heap[si][1] >= last[1]) break;
    heap[i] = heap[si];
    i = si;
  }
  heap[i] = last;
  return first;
}
