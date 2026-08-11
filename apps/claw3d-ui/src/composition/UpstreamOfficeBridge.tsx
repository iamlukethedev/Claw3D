"use client";

import { useState } from "react";
import type { VisualConnectionState, VisualSnapshot } from "@claw3d/visual-contract";
import { FaithfulThreeOffice } from "@claw3d/visual-react";

export interface UpstreamOfficeBridgeProps {
  snapshot: VisualSnapshot | null;
  connection: VisualConnectionState;
  adapterLabel: string;
  scenarios?: readonly string[];
  selectedScenario?: string;
  persistenceEnabled: boolean;
  onRetry(): void;
  onScenarioChange?(scenario: string): void;
  onClearBrowserPreferences(): void;
}

export function UpstreamOfficeBridge({
  snapshot,
  connection,
  adapterLabel,
  scenarios = [],
  selectedScenario,
  persistenceEnabled,
  onRetry,
  onScenarioChange,
  onClearBrowserPreferences,
}: UpstreamOfficeBridgeProps) {
  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [eventConsoleOpen, setEventConsoleOpen] = useState(false);
  const actors = snapshot?.actors ?? [];
  const history = snapshot?.history.slice(-8).reverse() ?? [];
  const runtimeKind = scenarios.length > 0 ? "demo" : "custom";

  return (
    <main className="upstream-office-shell">
      <section className="upstream-office-scene" aria-label="Claw3D visual office">
        <FaithfulThreeOffice
          snapshot={snapshot}
          connection={connection}
          title="JARVIS Headquarters"
          runtimeLabel={runtimeKind}
        />
      </section>

      <aside className={`upstream-directory ${directoryOpen ? "is-open" : "is-collapsed"}`}>
        <button
          type="button"
          className="upstream-directory-toggle"
          aria-expanded={directoryOpen}
          onClick={() => setDirectoryOpen((value) => !value)}
        >
          <span>Building Directory</span>
          <span aria-hidden="true">⌄</span>
        </button>
        {directoryOpen ? (
          <>
            <div className="upstream-directory-stepper" aria-hidden="true">
              <span>Prev</span><span>Next</span>
            </div>
            <p className="upstream-directory-label">Building</p>
            <article className="upstream-floor-card" aria-current="page">
              <div><small>Floor</small><strong>Lobby</strong></div>
              <span className="upstream-floor-adapter">{runtimeKind}</span>
              <footer><span>Visual</span><span>roster {actors.length} | loaded</span></footer>
            </article>
            <article className="upstream-current-floor">
              <small>Current floor</small>
              <strong>Lobby</strong>
              <footer><span>{runtimeKind}</span><span>roster {actors.length} | loaded</span></footer>
            </article>
          </>
        ) : null}
      </aside>

      <aside className="upstream-side-actions" aria-label="Visual panels">
        <button type="button" onClick={() => setActivityOpen((value) => !value)}>
          Activity
        </button>
        <button type="button" onClick={() => setEventConsoleOpen((value) => !value)}>
          Events
        </button>
      </aside>

      {activityOpen ? (
        <aside className="upstream-activity-panel" aria-label="Tasks and notifications">
          <header>
            <div><small>Visual runtime</small><strong>Activity</strong></div>
            <button type="button" aria-label="Close activity" onClick={() => setActivityOpen(false)}>×</button>
          </header>
          <section>
            <h2>Tasks</h2>
            {(snapshot?.tasks ?? []).map((task) => (
              <article key={task.id}>
                <div><strong>{task.title}</strong><span>{task.status}</span></div>
                <progress max={100} value={task.progress ?? 0} />
              </article>
            ))}
            {snapshot?.tasks.length === 0 ? <p>No visual tasks.</p> : null}
          </section>
          <section>
            <h2>Notifications</h2>
            {(snapshot?.notifications ?? []).map((notification) => (
              <article key={notification.id}><strong>{notification.title}</strong></article>
            ))}
            {snapshot?.notifications.length === 0 ? <p>No visual notifications.</p> : null}
          </section>
          {scenarios.length > 0 ? (
            <section>
              <h2>Mock scenario</h2>
              <div className="upstream-scenarios">
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
              </div>
            </section>
          ) : null}
          <footer>
            <p>{persistenceEnabled ? "Local preferences enabled." : "Browser persistence disabled."}</p>
            <button type="button" onClick={onClearBrowserPreferences}>Erase browser preferences</button>
          </footer>
        </aside>
      ) : null}

      <section className={`upstream-event-console ${eventConsoleOpen ? "is-expanded" : ""}`}>
        <header>
          <span>Visual Event Console</span>
          <span>actors {actors.length} | events {history.length}</span>
          <button type="button" onClick={() => setEventConsoleOpen((value) => !value)}>
            {eventConsoleOpen ? "Collapse" : "Expand"}
          </button>
        </header>
        {eventConsoleOpen ? (
          <ol>
            {history.map((event) => (
              <li key={event.eventId}>
                <time>{new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                <strong>{event.type}</strong>
                <span>{event.actorId ?? "system"}</span>
              </li>
            ))}
            {history.length === 0 ? <li>No visual events.</li> : null}
          </ol>
        ) : null}
      </section>

      {connection.phase !== "online" ? (
        <div className="upstream-connection-card" role="status">
          <small>Visual connector</small>
          <strong>{connection.label}</strong>
          {connection.phase === "error" || connection.phase === "offline" ? (
            <button type="button" onClick={onRetry}>Retry</button>
          ) : null}
        </div>
      ) : null}

      <span className="upstream-adapter-label">{adapterLabel}</span>
    </main>
  );
}
