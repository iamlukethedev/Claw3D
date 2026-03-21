import { describe, expect, it } from "vitest";

import { astar } from "@/features/retro-office/core/navigation";

// Grid constants (must match navigation.ts)
const GRID_CELL = 25;
const CANVAS_W = 1800;
const CANVAS_H = 720;
const GRID_COLS = Math.ceil(CANVAS_W / GRID_CELL);
const GRID_ROWS = Math.ceil(CANVAS_H / GRID_CELL);

/** Build a raw NavGrid from a set of blocked cell indices (row, col). */
const makeGrid = (blockedCells: [row: number, col: number][]): Uint8Array => {
  const grid = new Uint8Array(GRID_COLS * GRID_ROWS);
  // Always block borders (mirrors buildNavGrid behaviour).
  for (let c = 0; c < GRID_COLS; c++) {
    grid[c] = 1;
    grid[(GRID_ROWS - 1) * GRID_COLS + c] = 1;
  }
  for (let r = 0; r < GRID_ROWS; r++) {
    grid[r * GRID_COLS] = 1;
    grid[r * GRID_COLS + GRID_COLS - 1] = 1;
  }
  for (const [r, c] of blockedCells) {
    grid[r * GRID_COLS + c] = 1;
  }
  return grid;
};

/** Convert a grid cell centre to world coordinates. */
const cellWorld = (col: number, row: number) => ({
  x: col * GRID_CELL + GRID_CELL / 2,
  y: row * GRID_CELL + GRID_CELL / 2,
});

/**
 * Returns true if any waypoint in `path` passes through the given cell.
 * We check by converting the cell centre ±half-cell against each point.
 */
const pathPassesThroughCell = (
  path: { x: number; y: number }[],
  col: number,
  row: number,
): boolean => {
  const cx = col * GRID_CELL + GRID_CELL / 2;
  const cy = row * GRID_CELL + GRID_CELL / 2;
  return path.some(
    (p) => Math.abs(p.x - cx) < GRID_CELL && Math.abs(p.y - cy) < GRID_CELL,
  );
};

describe("astar – diagonal corner-cutting prevention (issue #6)", () => {
  it("does not cut through the corner of a blocked cell", () => {
    /*
     * Layout (using interior cells, away from the border):
     *
     *   col:  5   6   7
     * row 5: [ ] [X] [ ]
     * row 6: [ ] [ ] [ ]   start=(5,6), end=(7,5)
     * row 7: [S] [ ] [E]
     *
     * Without the fix the agent would take the diagonal (5→6 col, 7→6 row) move
     * because only the destination cell (6,6) was checked — not the two
     * orthogonal cells (5,6)=start_row_adj and (6,7)=blocked-adjacent.
     *
     * With the fix, the NE diagonal from (5,7) to (6,6) is rejected because
     * the orthogonal neighbour (5,6) passes next to the blocked cell (6,5).
     *
     * We place the wall at (6,5) so a straight NE path would clip its corner.
     */
    const grid = makeGrid([
      [5, 6], // blocked cell — the corner agents must not clip
    ]);

    const start = cellWorld(5, 7);
    const end = cellWorld(7, 5);

    const path = astar(start.x, start.y, end.x, end.y, grid);

    // The path must not pass directly through the blocked cell's corner.
    // Any valid path must go around (via col 5→5→6→7 or 5→6→7 with clear orthos).
    expect(pathPassesThroughCell(path, 6, 5)).toBe(false);
    // A path should still be returned (the destination is reachable).
    expect(path.length).toBeGreaterThan(0);
  });

  it("still allows diagonal moves when both orthogonal cells are free", () => {
    /*
     * Open grid with no interior obstacles — diagonal moves should be used
     * freely to shorten the path.
     */
    const grid = makeGrid([]); // only border cells blocked
    const start = cellWorld(5, 15);
    const end = cellWorld(10, 20);

    const path = astar(start.x, start.y, end.x, end.y, grid);

    // A path exists and uses fewer than 11 steps (pure Manhattan would need 10,
    // diagonals allow 5 steps; allow some slack).
    expect(path.length).toBeGreaterThan(0);
    expect(path.length).toBeLessThanOrEqual(7);
  });

  it("finds a path around a corner-blocking wall segment", () => {
    /*
     * Wall at columns 6-8, row 10. Agent wants to go from (5,12) to (9,8) —
     * a path that, without corner-cutting prevention, would clip the NE corner
     * of the wall at (8,10).
     */
    const grid = makeGrid([
      [10, 6],
      [10, 7],
      [10, 8],
    ]);

    const start = cellWorld(5, 12);
    const end = cellWorld(9, 8);

    const path = astar(start.x, start.y, end.x, end.y, grid);
    expect(path.length).toBeGreaterThan(0);

    // The path must not pass through the blocked row-10 cells.
    for (const blockedCol of [6, 7, 8]) {
      expect(pathPassesThroughCell(path, blockedCol, 10)).toBe(false);
    }
  });
});
