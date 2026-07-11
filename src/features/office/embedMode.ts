/**
 * Office embed mode.
 *
 * Claw3D's office screen ships a full "product" chrome: a building directory,
 * an HQ sidebar (inbox / kanban / marketplace / analytics), an agent event
 * console, and an in-scene toolbar. That surface is right for the standalone
 * product, but noise when the office is embedded as a calm ambient view — e.g.
 * a kitchen kiosk / tablet where a household just wants to see who's around.
 *
 * `embed=home` hides that chrome behind a single flag while keeping the scene,
 * agent nameplates, roster pill, title, camera controls, and chat. The full UI
 * stays one query param away (`?full=1`) so layout/builder work is unaffected.
 *
 * Resolution order (first match wins):
 *   1. `?full=1`  → always the full UI (explicit escape hatch).
 *   2. `?embed=home` → minimal home chrome.
 *   3. `NEXT_PUBLIC_CLAW3D_EMBED=home` → minimal home chrome by default
 *      (for deployments that are always embedded, with no param to set).
 *   4. otherwise → full UI (unchanged default).
 */
export type OfficeEmbedMode = "home" | null;

const HOME: OfficeEmbedMode = "home";

/** Minimal reader interface so this works with URLSearchParams and Next's
 * ReadonlyURLSearchParams alike. */
export interface EmbedParamReader {
  get(name: string): string | null;
}

export function resolveOfficeEmbedMode(
  params: EmbedParamReader | null | undefined,
): OfficeEmbedMode {
  if (params?.get("full") === "1") return null;
  if (params?.get("embed") === "home") return HOME;
  const embedParam = params?.get("embed") ?? null;
  if (
    !embedParam &&
    (process.env.NEXT_PUBLIC_CLAW3D_EMBED ?? "").trim().toLowerCase() === "home"
  ) {
    return HOME;
  }
  return null;
}
