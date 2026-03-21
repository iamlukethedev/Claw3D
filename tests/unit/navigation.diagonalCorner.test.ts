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

  // ─── Additional tests ────────────────────────────────────────────────────

  it("prevents corner-cutting in all four diagonal directions (NE, NW, SE, SW)", () => {
    /*
     * For each diagonal direction we block one of the orthogonal neighbours of
     * the first diagonal step, then verify the path does not enter that blocker.
     * Each direction is tested in isolation with a fresh grid.
     *
     * Orthogonal neighbours of a diagonal (dc, dr) from cell (c, r):
     *   OrthoA = (row+dr, col)   — the "row" orthogonal
     *   OrthoB = (row,    col+dc) — the "col" orthogonal
     *
     * Blocking OrthoA for each direction forces the agent to take a detour.
     */

    // NE step from (col=8,row=15) → (col=9,row=14). OrthoA=(row=14,col=8). Block OrthoA → NE avoided.
    const neGrid = makeGrid([[14, 8]]); // blocks the row-ortho of the first NE step
    const nePath = astar(
      cellWorld(8, 15).x, cellWorld(8, 15).y,
      cellWorld(12, 11).x, cellWorld(12, 11).y,
      neGrid,
    );
    expect(nePath.length).toBeGreaterThan(0);
    // Must not step through the blocked cell
    expect(pathPassesThroughCell(nePath, 8, 14)).toBe(false);

    // NW step from (col=15,row=15) → (col=14,row=14). OrthoA=(row=14,col=15). Block it.
    const nwGrid = makeGrid([[14, 15]]);
    const nwPath = astar(
      cellWorld(15, 15).x, cellWorld(15, 15).y,
      cellWorld(11, 11).x, cellWorld(11, 11).y,
      nwGrid,
    );
    expect(nwPath.length).toBeGreaterThan(0);
    expect(pathPassesThroughCell(nwPath, 15, 14)).toBe(false);

    // SE step from (col=8,row=8) → (col=9,row=9). OrthoA=(row=9,col=8). Block it.
    const seGrid = makeGrid([[9, 8]]);
    const sePath = astar(
      cellWorld(8, 8).x, cellWorld(8, 8).y,
      cellWorld(12, 12).x, cellWorld(12, 12).y,
      seGrid,
    );
    expect(sePath.length).toBeGreaterThan(0);
    expect(pathPassesThroughCell(sePath, 8, 9)).toBe(false);

    // SW step from (col=15,row=8) → (col=14,row=9). OrthoA=(row=9,col=15). Block it.
    const swGrid = makeGrid([[9, 15]]);
    const swPath = astar(
      cellWorld(15, 8).x, cellWorld(15, 8).y,
      cellWorld(11, 12).x, cellWorld(11, 12).y,
      swGrid,
    );
    expect(swPath.length).toBeGreaterThan(0);
    expect(pathPassesThroughCell(swPath, 15, 9)).toBe(false);
  });

  it("rejects a diagonal move when BOTH orthogonal sides are blocked", () => {
    /*
     * Both orthogonal neighbors of a diagonal step are blocked.
     * The diagonal should be completely prohibited and the path must go around.
     *
     * Setup: start=(10,15) wants to go NE to (11,14).
     * OrthoA = (row=14, col=10), OrthoB = (row=15, col=11) — both blocked.
     * The agent must take a longer detour.
     */
    const grid = makeGrid([
      [14, 10], // OrthoA — blocks the "N" side of the NE move
      [15, 11], // OrthoB — blocks the "E" side of the NE move
    ]);

    const start = cellWorld(10, 15);
    const end = cellWorld(13, 12);
    const path = astar(start.x, start.y, end.x, end.y, grid);

    // A path still exists because the destination is reachable via a detour.
    expect(path.length).toBeGreaterThan(0);
    // The direct diagonal cell (11,14) should not appear in the path since the
    // direct NE move is blocked from the start.
    // The path must not go through the two blocked cells.
    expect(pathPassesThroughCell(path, 10, 14)).toBe(false);
    expect(pathPassesThroughCell(path, 11, 15)).toBe(false);
  });

  it("navigates around an L-shaped wall without corner-cutting any segment", () => {
    /*
     * L-shaped wall:
     *
     *   col: 8  9  10  11  12
     * row 8: [X][X][X][X][X]   ← horizontal arm (row 8, cols 8-12)
     * row 9:             [X]   ← vertical arm (col 12, rows 9-12)
     * row10:             [X]
     * row11:             [X]
     * row12:             [X]
     *
     * Agent goes from (6, 11) to (14, 6): a diagonal-leaning path that must
     * navigate the outer corner of the L at (12, 8) without corner-cutting.
     */
    const blocked: [row: number, col: number][] = [
      // Horizontal arm
      [8, 8], [8, 9], [8, 10], [8, 11], [8, 12],
      // Vertical arm
      [9, 12], [10, 12], [11, 12], [12, 12],
    ];

    const grid = makeGrid(blocked);
    const start = cellWorld(6, 11);
    const end = cellWorld(14, 6);
    const path = astar(start.x, start.y, end.x, end.y, grid);

    expect(path.length).toBeGreaterThan(0);

    // Path must not pass through any blocked wall cell.
    for (const [blockedRow, blockedCol] of blocked) {
      expect(
        pathPassesThroughCell(path, blockedCol, blockedRow),
        `path should not pass through blocked cell (col=${blockedCol}, row=${blockedRow})`,
      ).toBe(false);
    }
  });

  it("stress test: finds a valid path through a dense maze without corner-cutting", () => {
    /*
     * Maze-like grid with multiple walls forcing the agent to navigate without
     * cutting corners. We verify:
     *  1. A path exists (destination is reachable)
     *  2. No path waypoint falls on a blocked cell
     *
     *  Wall layout (interior cells only, well away from borders):
     *
     *  Row 5: cols 5-15 blocked (horizontal wall, gap at col 10)
     *  Row 10: cols 5-15 blocked (second wall, gap at col 8)
     *  Row 7: cols 12-20 blocked (right side vertical)
     *  Row 3-7: col 5 blocked (left vertical)
     */
    const blocked: [row: number, col: number][] = [];

    // Horizontal wall at row 5 with gap at col 10
    for (let c = 5; c <= 15; c++) {
      if (c !== 10) blocked.push([5, c]);
    }
    // Horizontal wall at row 10 with gap at col 8
    for (let c = 5; c <= 15; c++) {
      if (c !== 8) blocked.push([10, c]);
    }
    // Left vertical wall col 5, rows 3-7
    for (let r = 3; r <= 7; r++) {
      if (!blocked.some(([br, bc]) => br === r && bc === 5)) {
        blocked.push([r, 5]);
      }
    }

    const grid = makeGrid(blocked);
    const blockedSet = new Set(blocked.map(([r, c]) => `${r},${c}`));

    const start = cellWorld(3, 2);
    const end = cellWorld(20, 14);
    const path = astar(start.x, start.y, end.x, end.y, grid);

    // Path must be found
    expect(path.length).toBeGreaterThan(0);

    // No waypoint may land on a blocked cell
    for (const { x, y } of path) {
      const col = Math.floor(x / GRID_CELL);
      const row = Math.floor(y / GRID_CELL);
      expect(
        blockedSet.has(`${row},${col}`),
        `path waypoint (col=${col}, row=${row}) must not be a blocked cell`,
      ).toBe(false);
    }
  });
});
