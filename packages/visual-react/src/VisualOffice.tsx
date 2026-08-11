"use client";

import type {
  AssetResolver,
  VisualConnectionState,
  VisualSnapshot,
} from "@claw3d/visual-contract";
import { createOfficeViewModel } from "@claw3d/visual-core";
import { ThreeOfficeScene } from "./ThreeOfficeScene";

export interface VisualOfficeProps {
  snapshot: VisualSnapshot | null;
  connection: VisualConnectionState;
  title: string;
  adapterLabel: string;
  assetResolver: AssetResolver;
  scenarios?: readonly string[];
  selectedScenario?: string;
  persistenceEnabled: boolean;
  reducedMotion?: boolean;
  onRetry(): void;
  onScenarioChange?(scenario: string): void;
  onClearBrowserPreferences(): void;
}

function statusLabel(connection: VisualConnectionState): string {
  if (connection.phase === "online") return "Live visual stream";
  if (connection.phase === "loading") return "Loading visual state";
  if (connection.phase === "reconnecting") return `Reconnecting · attempt ${connection.attempt}`;
  return connection.label;
}

export function VisualOffice({
  snapshot,
  connection,
  title,
  adapterLabel,
  scenarios = [],
  selectedScenario,
  persistenceEnabled,
  reducedMotion,
  onRetry,
  onScenarioChange,
  onClearBrowserPreferences,
}: VisualOfficeProps) {
  const viewModel = createOfficeViewModel(snapshot);
  const capabilities = snapshot?.capabilities;
  const unavailable = connection.phase === "offline" || connection.phase === "locked";

  return (
    <main className="visual-shell">
      <header className="visual-header">
        <div>
          <p className="visual-kicker">Claw3D · autonomous visual surface</p>
          <h1>{title}</h1>
        </div>
        <div className="visual-runtime-meta" aria-label="Visual runtime status">
          <span className={`visual-status-dot visual-status-${connection.phase}`} aria-hidden="true" />
          <div>
            <strong>{statusLabel(connection)}</strong>
            <small>{adapterLabel} · read-only</small>
          </div>
        </div>
      </header>

      {capabilities?.scenarioControls && scenarios.length > 0 ? (
        <nav className="visual-scenarios" aria-label="Mock scenarios">
          {scenarios.map((scenario) => (
            <button
              key={scenario}
              type="button"
              aria-pressed={selectedScenario === scenario}
              onClick={() => onScenarioChange?.(scenario)}
            >
              {scenario}
            </button>
          ))}
        </nav>
      ) : null}

      <section className="visual-layout">
        <aside className="visual-panel visual-roster" aria-label="Actor roster">
          <div className="visual-panel-heading">
            <div>
              <span>Roster</span>
              <strong>{viewModel.actors.length}</strong>
            </div>
            <span className="visual-readonly-pill">view only</span>
          </div>
          <div className="visual-metrics" aria-label="Actor status summary">
            <div><strong>{viewModel.activeCount}</strong><span>active</span></div>
            <div><strong>{viewModel.idleCount}</strong><span>idle</span></div>
            <div><strong>{viewModel.errorCount}</strong><span>error</span></div>
          </div>
          <div className="visual-actor-list">
            {viewModel.actors.map((actor) => (
              <article key={actor.id} className="visual-actor-card">
                <span className="visual-avatar" style={{ "--actor-color": actor.color } as React.CSSProperties}>
                  {actor.initials}
                </span>
                <div>
                  <strong>{actor.displayName}</strong>
                  <small>{actor.role ?? "Visual actor"}</small>
                </div>
                <span className={`visual-actor-state visual-actor-${actor.status}`}>{actor.status}</span>
              </article>
            ))}
            {snapshot && viewModel.actors.length === 0 ? (
              <div className="visual-empty-state"><strong>No visual actors</strong><span>The scene remains available.</span></div>
            ) : null}
          </div>
        </aside>

        <section className="visual-scene-card" aria-label="Office scene">
          {connection.phase === "loading" || !snapshot ? (
            <div className="visual-overlay-state" role="status">
              <span className="visual-loader" aria-hidden="true" />
              <strong>Building the visual snapshot</strong>
              <span>No backend payload enters this view.</span>
            </div>
          ) : unavailable ? (
            <div className="visual-overlay-state" role="status">
              <span className="visual-offline-icon" aria-hidden="true">↯</span>
              <strong>{connection.phase === "locked" ? "Session locked" : "Visual connector offline"}</strong>
              <span>{connection.label}</span>
              <button type="button" onClick={onRetry}>Retry visual connection</button>
            </div>
          ) : (
            <ThreeOfficeScene viewModel={viewModel} reducedMotion={reducedMotion} />
          )}
          <div className="visual-scene-caption">
            <span>drag to orbit · scroll to zoom</span>
            <span>{snapshot?.system.label ?? connection.label}</span>
          </div>
        </section>

        <aside className="visual-panel visual-activity" aria-label="Tasks and notifications">
          <div className="visual-panel-heading">
            <div><span>Visual activity</span><strong>{viewModel.completionPercent}%</strong></div>
          </div>
          {capabilities?.tasks ? (
            <section className="visual-section-list">
              <h2>Tasks</h2>
              {viewModel.tasks.map((task) => (
                <article key={task.id} className="visual-task-card">
                  <div><strong>{task.title}</strong><span>{task.status}</span></div>
                  <div className="visual-progress" aria-label={`${task.progress ?? 0}% complete`}>
                    <span style={{ width: `${Math.max(0, Math.min(100, task.progress ?? 0))}%` }} />
                  </div>
                </article>
              ))}
              {viewModel.tasks.length === 0 ? <p className="visual-muted">No visual tasks.</p> : null}
            </section>
          ) : null}
          {capabilities?.notifications ? (
            <section className="visual-section-list">
              <h2>Notifications</h2>
              {snapshot?.notifications.map((notification) => (
                <article key={notification.id} className={`visual-notice visual-notice-${notification.level}`}>
                  <span aria-hidden="true" />
                  <strong>{notification.title}</strong>
                </article>
              ))}
            </section>
          ) : null}
          <section className="visual-privacy-card">
            <h2>Local preferences</h2>
            <p>{persistenceEnabled ? "Minimal browser preferences are enabled." : "Browser persistence is disabled."}</p>
            <button type="button" onClick={onClearBrowserPreferences}>Erase browser preferences</button>
          </section>
        </aside>
      </section>
    </main>
  );
}
