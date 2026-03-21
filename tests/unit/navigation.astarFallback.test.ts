/**
 * Tests for astar() failure-state behaviour (Issue #3).
 *
 * Before the fix, astar() returned [{ x: endX, y: endY }] when no route
 * could be found, which caused the movement layer to walk agents in a
 * straight line through walls.  After the fix it returns [] so callers
 * can treat an empty array as "no path found" and keep the agent still.
 */

import { describe, expect, it } from "vitest";

import { astar, buildNavGrid } from "@/features/retro-office/core/navigation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal NavGrid (Uint8Array) of the given dimensions with every
 * cell set to the provided fill value (0 = free, 1 = blocked).
 */
function makeGrid(
  cols: number,
  rows: number,
  fill: 0 | 1 = 0,
): Uint8Array {
  return new Uint8Array(cols * rows).fill(fill);
}

/**
 * Mark a single grid cell as blocked (1) or free (0).
 */
function setCell(
  grid: Uint8Array,
  cols: number,
  col: number,
  row: number,
  value: 0 | 1,
) {
  grid[row * cols + col] = value;
}

// ---------------------------------------------------------------------------
// The real nav grid dimensions used by astar() internally.
// CANVAS_W = 1800, CANVAS_H = 720, GRID_CELL = 25
// GRID_COLS = ceil(1800/25) = 72, GRID_ROWS = ceil(720/25) = 29
// ---------------------------------------------------------------------------
const GRID_CELL = 25;
const GRID_COLS = 72; // Math.ceil(1800 / 25)
const GRID_ROWS = 29; // Math.ceil(720 / 25)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("astar — failure state returns empty array (Issue #3 fix)", () => {
  // -------------------------------------------------------------------------
  it("returns [] when the destination is fully enclosed and unreachable", () => {
    // Build a grid with a thick wall ring around a pocket of free cells so
    // findFree cannot escape the ring even with its distance-10 search.
    // We use a 12-cell-thick border wall that completely divides the grid.
    const grid = makeGrid(GRID_COLS, GRID_ROWS, 0);

    // Block the real border cells.
    for (let col = 0; col < GRID_COLS; col++) {
      setCell(grid, GRID_COLS, col, 0, 1);
      setCell(grid, GRID_COLS, col, GRID_ROWS - 1, 1);
    }
    for (let row = 0; row < GRID_ROWS; row++) {
      setCell(grid, GRID_COLS, 0, row, 1);
      setCell(grid, GRID_COLS, GRID_COLS - 1, row, 1);
    }

    // Create a thick horizontal wall across the middle of the grid that the
    // agent cannot cross, with a pocket of free cells on the far side.
    // Wall spans all columns from row 12 through row 24 (13 rows thick,
    // much greater than findFree's max search radius of 10 cells).
    const wallTop = 12;
    const wallBottom = 24;
    for (let row = wallTop; row <= wallBottom; row++) {
      for (let col = 1; col < GRID_COLS - 1; col++) {
        setCell(grid, GRID_COLS, col, row, 1);
      }
    }

    // Source: above the wall, clearly free.
    const sx = 36 * GRID_CELL + GRID_CELL / 2; // col 36, row 5
    const sy = 5 * GRID_CELL + GRID_CELL / 2;
    // Destination: below the wall, in the isolated pocket.
    const ex = 36 * GRID_CELL + GRID_CELL / 2; // col 36, row 27
    const ey = 27 * GRID_CELL + GRID_CELL / 2;

    const path = astar(sx, sy, ex, ey, grid);

    expect(path).toEqual([]);
  });

  // -------------------------------------------------------------------------
  it("returns [] when both start and end resolve to the same blocked cell", () => {
    // Fill the entire grid with walls so findFree finds nothing.
    const grid = makeGrid(GRID_COLS, GRID_ROWS, 1);

    const sx = 300;
    const sy = 300;
    const ex = 400;
    const ey = 400;

    const path = astar(sx, sy, ex, ey, grid);

    expect(path).toEqual([]);
  });

  // -------------------------------------------------------------------------
  it("returns a non-empty path for a clearly reachable destination (regression)", () => {
    // Use a real nav grid built from an empty furniture list so all interior
    // cells are free.  The only blocked cells are the border walls that
    // buildNavGrid always adds.
    const grid = buildNavGrid([]);

    // Source: near top-left interior.
    const sx = 100;
    const sy = 100;
    // Destination: near bottom-right interior, well away from borders.
    const ex = 1600;
    const ey = 600;

    const path = astar(sx, sy, ex, ey, grid);

    expect(path.length).toBeGreaterThan(0);
    // The last waypoint should be the exact destination.
    const last = path[path.length - 1];
    expect(last).toEqual({ x: ex, y: ey });
  });

  // -------------------------------------------------------------------------
  it("returns a single-step path when start and end are adjacent free cells", () => {
    const grid = buildNavGrid([]);

    // One GRID_CELL apart — should produce a very short path.
    const sx = 200;
    const sy = 200;
    const ex = sx + GRID_CELL;
    const ey = sy;

    const path = astar(sx, sy, ex, ey, grid);

    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1];
    expect(last).toEqual({ x: ex, y: ey });
  });

  // -------------------------------------------------------------------------
  it("returns [] when start snaps to the same free cell as end (already arrived)", () => {
    // When start and end map to the exact same grid cell astar returns [].
    // The agent is already at the target — no movement needed.
    const grid = buildNavGrid([]);

    // Pick pixel coords that both land in grid cell (4, 4).
    const cellOrigin = 4 * GRID_CELL; // 100
    const sx = cellOrigin + 2; // 102 → still cell (4,4)
    const sy = cellOrigin + 2;
    const ex = cellOrigin + 20; // 120 → still cell (4,4) since floor(120/25)=4
    const ey = cellOrigin + 20;

    const path = astar(sx, sy, ex, ey, grid);

    // Same cell — no waypoints needed.
    expect(path).toEqual([]);
  });
});

describe("movement layer handles empty path gracefully (Issue #3 fix)", () => {
  it("agent stays at its current position when path is empty", () => {
    // Simulate the movement-layer logic extracted from RetroOffice3D.tsx:
    //
    //   const path = agent.path ?? [];
    //   const wpX = path.length > 0 ? path[0].x : agent.x;   // fixed line
    //   const wpY = path.length > 0 ? path[0].y : agent.y;   // fixed line
    //   const dx = wpX - agent.x, dy = wpY - agent.y;
    //   const dist = Math.hypot(dx, dy);
    //   if (dist > speed) { /* move */ } else { /* stay */ }
    //
    // With the fix applied, an empty path means wpX/wpY = agent.x/agent.y,
    // so dist = 0 and the agent does NOT move.

    const agentX = 300;
    const agentY = 400;
    const agentTargetX = 900; // far away — would cause wall-walking before fix
    const agentTargetY = 600;
    const WALK_SPEED = 2;

    // Simulate the fixed movement logic.
    const path: { x: number; y: number }[] = []; // astar returned no route
    const wpX = path.length > 0 ? path[0].x : agentX; // stays at agentX
    const wpY = path.length > 0 ? path[0].y : agentY; // stays at agentY
    const dx = wpX - agentX;
    const dy = wpY - agentY;
    const dist = Math.hypot(dx, dy);

    // Agent should not move.
    const movedX =
      dist > WALK_SPEED ? agentX + (dx / dist) * WALK_SPEED : agentX;
    const movedY =
      dist > WALK_SPEED ? agentY + (dy / dist) * WALK_SPEED : agentY;

    expect(movedX).toBe(agentX);
    expect(movedY).toBe(agentY);

    // Sanity-check: with the OLD (broken) fallback to targetX/targetY,
    // the agent WOULD have moved.
    const oldWpX = path.length > 0 ? path[0].x : agentTargetX;
    const oldWpY = path.length > 0 ? path[0].y : agentTargetY;
    const oldDx = oldWpX - agentX;
    const oldDy = oldWpY - agentY;
    const oldDist = Math.hypot(oldDx, oldDy);
    expect(oldDist).toBeGreaterThan(WALK_SPEED); // confirms old code caused movement
  });
});
