import type { AgentState, FocusFilter } from "@/features/agents/state/store";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AgentAvatar } from "./AgentAvatar";
import {
  NEEDS_APPROVAL_BADGE_CLASS,
  resolveAgentStatusBadgeClass,
  resolveAgentStatusLabel,
} from "./colorSemantics";
import { EmptyStatePanel } from "./EmptyStatePanel";

type FleetSidebarProps = {
  agents: AgentState[];
  selectedAgentId: string | null;
  filter: FocusFilter;
  onFilterChange: (next: FocusFilter) => void;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  createDisabled?: boolean;
  createBusy?: boolean;
};

const FILTER_OPTIONS: Array<{ value: FocusFilter; label: string; testId: string }> = [
  { value: "all", label: "All", testId: "fleet-filter-all" },
  { value: "running", label: "Running", testId: "fleet-filter-running" },
  { value: "approvals", label: "Approvals", testId: "fleet-filter-approvals" },
];

export const FleetSidebar = ({
  agents,
  selectedAgentId,
  filter,
  onFilterChange,
  onSelectAgent,
  onCreateAgent,
  createDisabled = false,
  createBusy = false,
}: FleetSidebarProps) => {
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const previousTopByAgentIdRef = useRef<Map<string, number>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const agentOrderKey = useMemo(() => agents.map((agent) => agent.agentId).join("|"), [agents]);

  useLayoutEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();

    const getTopInScrollContent = (node: HTMLElement) =>
      node.getBoundingClientRect().top - scrollerRect.top + scroller.scrollTop;

    const nextTopByAgentId = new Map<string, number>();
    const agentIds = agentOrderKey.length === 0 ? [] : agentOrderKey.split("|");
    for (const agentId of agentIds) {
      const node = rowRefs.current.get(agentId);
      if (!node) continue;
      const nextTop = getTopInScrollContent(node);
      nextTopByAgentId.set(agentId, nextTop);
      const previousTop = previousTopByAgentIdRef.current.get(agentId);
      if (typeof previousTop !== "number") continue;
      const deltaY = previousTop - nextTop;
      if (Math.abs(deltaY) < 0.5) continue;
      if (typeof node.animate !== "function") continue;
      node.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0px)" }],
        { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }
    previousTopByAgentIdRef.current = nextTopByAgentId;
  }, [agentOrderKey]);

  return (
    <aside
      className="glass-panel fade-up-delay ui-panel ui-depth-sidepanel relative flex h-full w-full min-w-72 flex-col gap-3 bg-sidebar p-3 xl:max-w-[320px] xl:border-r xl:border-sidebar-border"
      data-testid="fleet-sidebar"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="console-title type-page-title text-foreground">Agents ({agents.length})</p>
        <button
          type="button"
          data-testid="fleet-new-agent-button"
          className="ui-btn-primary px-3 py-2 font-mono text-[12px] font-medium tracking-[0.02em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
          onClick={onCreateAgent}
          disabled={createDisabled || createBusy}
        >
          {createBusy ? "Creating..." : "New agent"}
        </button>
      </div>

      <div className="ui-segment ui-segment-fleet-filter grid-cols-3">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={option.testId}
              aria-pressed={active}
              className="ui-segment-item px-2 py-1 font-mono text-[12px] font-medium tracking-[0.02em]"
              data-active={active ? "true" : "false"}
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div ref={scrollContainerRef} className="ui-scroll min-h-0 flex-1 overflow-auto">
        {agents.length === 0 ? (
          <EmptyStatePanel title="No agents available." compact className="p-3 text-xs" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {agents.map((agent) => {
              const selected = selectedAgentId === agent.agentId;
              const avatarSeed = agent.avatarSeed ?? agent.agentId;
              return (
                <button
                  key={agent.agentId}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current.set(agent.agentId, node);
                      return;
                    }
                    rowRefs.current.delete(agent.agentId);
                  }}
                  type="button"
                  data-testid={`fleet-agent-row-${agent.agentId}`}
                  aria-label={`Select agent: ${agent.name}`}
                  aria-pressed={selected}
                  className={`group relative ui-card flex w-full items-center gap-3 overflow-hidden border px-3 py-3 text-left transition-colors ${
                    selected
                      ? "ui-card-selected"
                      : "hover:bg-surface-2/45"
                  }`}
                  onClick={() => onSelectAgent(agent.agentId)}
                >
                  <span
                    aria-hidden="true"
                    className={`ui-card-select-indicator ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-35"}`}
                  />
                  <AgentAvatar
                    seed={avatarSeed}
                    name={agent.name}
                    avatarUrl={agent.avatarUrl ?? null}
                    size={42}
                    isSelected={selected}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="type-secondary-heading truncate text-foreground">
                      {agent.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`ui-badge ${resolveAgentStatusBadgeClass(agent.status)}`}
                        data-status={agent.status}
                      >
                        {resolveAgentStatusLabel(agent.status)}
                      </span>
                      {agent.awaitingUserInput ? (
                        <span className={`ui-badge ${NEEDS_APPROVAL_BADGE_CLASS}`} data-status="approval">
                          Needs approval
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
