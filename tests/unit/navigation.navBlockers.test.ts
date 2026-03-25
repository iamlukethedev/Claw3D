import { describe, expect, it } from "vitest";

import { CANVAS_H, CANVAS_W } from "@/features/retro-office/core/constants";
import { astar, buildNavGrid } from "@/features/retro-office/core/navigation";
import { ITEM_METADATA } from "@/features/retro-office/core/geometry";
import type { FurnitureItem } from "@/features/retro-office/core/types";

// Minimal helper: creates a FurnitureItem at a given position.
const makeItem = (type: string, x = 100, y = 100): FurnitureItem => ({
  _uid: `test_${type}`,
  type,
  x,
  y,
});

/**
 * Returns true if ANY cell in the grid that overlaps the given world-space
 * rectangle is marked as blocked (value === 1).
 */
const isBlocked = (
  grid: Uint8Array,
  wx: number,
  wy: number,
  ww = 30,
  wh = 30,
): boolean => {
  const GRID_CELL = 25;
  const GRID_COLS = Math.ceil(CANVAS_W / GRID_CELL);
  const GRID_ROWS = Math.ceil(CANVAS_H / GRID_CELL);

  const c1 = Math.max(0, Math.floor(wx / GRID_CELL));
  const c2 = Math.min(GRID_COLS - 1, Math.floor((wx + ww) / GRID_CELL));
  const r1 = Math.max(0, Math.floor(wy / GRID_CELL));
  const r2 = Math.min(GRID_ROWS - 1, Math.floor((wy + wh) / GRID_CELL));

  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (grid[r * GRID_COLS + c] === 1) return true;
    }
  }
  return false;
};

describe("buildNavGrid – solid floor props block pathfinding (issue #4)", () => {
  // The five types that were previously missing from the blocking set (issue #4).
  const solidProps = [
    "water_cooler",
    "server_terminal",
    "dishwasher",
    "easel",
    "beanbag",
  ] as const;

  for (const propType of solidProps) {
    it(`marks cells occupied by '${propType}' as blocked`, () => {
      const item = makeItem(propType, 400, 300);
      const grid = buildNavGrid([item]);
      // The item is placed at (400, 300); any cell in that vicinity should be blocked.
      expect(isBlocked(grid, 400, 300)).toBe(true);
    });
  }

  it("does not block cells occupied by non-solid props (e.g. keyboard)", () => {
    // A keyboard is a desk decoration and should NOT block walking paths.
    const item = makeItem("keyboard", 400, 300);
    const grid = buildNavGrid([item]);
    // Centre cell of the item should remain free (border cells are always blocked, pick interior).
    expect(isBlocked(grid, 400, 300)).toBe(false);
  });
});

describe("buildNavGrid – metadata-driven blocking (issue #4 rework)", () => {
  it("respects ITEM_METADATA.blocksNavigation for known blocking types", () => {
    // Spot-check a few well-known blocking types derived from metadata.
    const blockingTypes = Object.entries(ITEM_METADATA)
      .filter(([, meta]) => meta.blocksNavigation)
      .map(([type]) => type);

    for (const type of blockingTypes) {
      const item = makeItem(type, 400, 300);
      const grid = buildNavGrid([item]);
      expect(isBlocked(grid, 400, 300), `expected '${type}' to block`).toBe(true);
    }
  });

  it("does not block for known non-blocking types from ITEM_METADATA", () => {
    const nonBlockingTypes = Object.entries(ITEM_METADATA)
      .filter(([, meta]) => !meta.blocksNavigation)
      .map(([type]) => type);

    for (const type of nonBlockingTypes) {
      const item = makeItem(type, 400, 300);
      const grid = buildNavGrid([item]);
      expect(isBlocked(grid, 400, 300), `expected '${type}' NOT to block`).toBe(false);
    }
  });

  it("a new item type with blocksNavigation: true is correctly blocked by buildNavGrid", () => {
    // Simulate adding a brand-new prop type to ITEM_METADATA at runtime.
    // This verifies the metadata-driven path works end-to-end for future additions.
    const testType = "__test_new_blocking_prop__";
    ITEM_METADATA[testType] = { blocksNavigation: true };
    try {
      const item = makeItem(testType, 400, 300);
      const grid = buildNavGrid([item]);
      expect(isBlocked(grid, 400, 300)).toBe(true);
    } finally {
      // Clean up the temporary entry so it doesn't affect other tests.
      delete ITEM_METADATA[testType];
    }
  });

  it("an unknown item type defaults to non-blocking (safe fallback)", () => {
    // Types not listed in ITEM_METADATA should never accidentally block navigation.
    const item = makeItem("__completely_unknown_type__", 400, 300);
    const grid = buildNavGrid([item]);
    expect(isBlocked(grid, 400, 300)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Additional edge-case and integration tests (issue #4)
// ---------------------------------------------------------------------------

describe("buildNavGrid – continuous wall from adjacent blocking items (issue #4)", () => {
  it("adjacent blocking items form a continuous impassable wall", () => {
    /*
     * Place three `vending` machines side-by-side (each 40×60 px) at x=200,220,240.
     * Together they should create a solid horizontal band from y=300 that blocks
     * the entire horizontal span — no path can slip between them.
     *
     * We verify by checking that cells at several x positions along the row are
     * all blocked.
     */
    const items: FurnitureItem[] = [
      makeItem("vending", 200, 300),
      makeItem("vending", 240, 300),
      makeItem("vending", 280, 300),
    ];

    const grid = buildNavGrid(items);

    // All three placement regions should be blocked.
    expect(isBlocked(grid, 200, 300)).toBe(true);
    expect(isBlocked(grid, 240, 300)).toBe(true);
    expect(isBlocked(grid, 280, 300)).toBe(true);
  });
});

describe("buildNavGrid – near-boundary placement (issue #4)", () => {
  it("blocking item near the grid edge does not cause out-of-bounds errors", () => {
    // Place a large item near the right/bottom edges of the canvas.
    // buildNavGrid clamps cells to valid indices — this must not throw.
    const nearEdge = makeItem("cabinet", CANVAS_W - 40, CANVAS_H - 40);
    expect(() => buildNavGrid([nearEdge])).not.toThrow();

    const grid = buildNavGrid([nearEdge]);
    // The grid array length must still be correct.
    const GRID_CELL = 25;
    const GRID_COLS = Math.ceil(CANVAS_W / GRID_CELL);
    const GRID_ROWS = Math.ceil(CANVAS_H / GRID_CELL);
    expect(grid.length).toBe(GRID_COLS * GRID_ROWS);
  });

  it("blocking item at the top-left corner does not cause out-of-bounds errors", () => {
    const nearOrigin = makeItem("vending", 0, 0);
    expect(() => buildNavGrid([nearOrigin])).not.toThrow();
  });
});

describe("buildNavGrid + astar – full pathfinding integration (issue #4)", () => {
  it("path goes AROUND a blocking item placed between start and end", () => {
    /*
     * Layout (world coords):
     *   Start:   (100, 350)   ← left side
     *   End:     (700, 350)   ← right side
     *   Blocker: cabinet at (400, 300) — 200×40 px, blocks a wide horizontal band
     *
     * A straight horizontal path would pass through x≈400 y≈300-340. The astar
     * path must route around the cabinet, not through it.
     */
    const blocker = makeItem("cabinet", 400, 300);
    const grid = buildNavGrid([blocker]);

    const path = astar(100, 350, 700, 350, grid);

    expect(path.length).toBeGreaterThan(0);

    // Verify no waypoint falls inside the (padded) blocked region around the cabinet.
    // The cabinet is 200×40; buildNavGrid adds 0.6*GRID_CELL ≈ 15 px padding.
    const blockedXMin = 400 - 15;
    const blockedXMax = 400 + 200 + 15;
    const blockedYMin = 300 - 15;
    const blockedYMax = 300 + 40 + 15;

    for (const { x, y } of path) {
      const insideBlocker =
        x >= blockedXMin && x <= blockedXMax &&
        y >= blockedYMin && y <= blockedYMax;
      expect(insideBlocker, `waypoint (${x.toFixed(0)}, ${y.toFixed(0)}) must not be inside the cabinet footprint`).toBe(false);
    }
  });
});

describe("buildNavGrid – specific non-blocking item types (issue #4)", () => {
  it("desk_cubicle does NOT block navigation — agents stand at these", () => {
    /*
     * desk_cubicle has blocksNavigation: false in ITEM_METADATA.
     * Agents interact with desks by standing beside them; the desk itself
     * is not a solid blocker in the pathfinding grid.
     */
    const item = makeItem("desk_cubicle", 400, 300);
    const grid = buildNavGrid([item]);
    expect(isBlocked(grid, 400, 300)).toBe(false);
    // Confirm via metadata as the authoritative source.
    expect(ITEM_METADATA["desk_cubicle"]?.blocksNavigation).toBe(false);
  });

  it("door does NOT block navigation — agents must be able to walk through doors", () => {
    /*
     * door has blocksNavigation: false in ITEM_METADATA.
     * Doors are structural openings that agents traverse; they must never be
     * marked impassable in the nav grid.
     */
    const item = makeItem("door", 400, 300);
    const grid = buildNavGrid([item]);
    expect(isBlocked(grid, 400, 300)).toBe(false);
    // Confirm via metadata.
    expect(ITEM_METADATA["door"]?.blocksNavigation).toBe(false);
  });
});
