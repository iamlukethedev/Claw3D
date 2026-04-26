import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConnectionPanel } from "@/features/agents/components/ConnectionPanel";

describe("ConnectionPanel close control", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders close control and calls handler when provided", () => {
    const onClose = vi.fn();

    render(
      createElement(ConnectionPanel, {
        gatewayUrl: "ws://127.0.0.1:18789",
        token: "token",
        selectedAdapterType: "openclaw",
        activeAdapterType: "openclaw",
        status: "disconnected",
        error: null,
        onGatewayUrlChange: vi.fn(),
        onTokenChange: vi.fn(),
        onAdapterTypeChange: vi.fn(),
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        onClose,
      })
    );

    fireEvent.click(screen.getByTestId("gateway-connection-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render close control when handler is missing", () => {
    render(
      createElement(ConnectionPanel, {
        gatewayUrl: "ws://127.0.0.1:18789",
        token: "token",
        selectedAdapterType: "openclaw",
        activeAdapterType: "openclaw",
        status: "disconnected",
        error: null,
        onGatewayUrlChange: vi.fn(),
        onTokenChange: vi.fn(),
        onAdapterTypeChange: vi.fn(),
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
      })
    );

    expect(screen.queryByTestId("gateway-connection-close")).not.toBeInTheDocument();
  });

  it("renders semantic gateway status class markers", () => {
    const { rerender } = render(
      createElement(ConnectionPanel, {
        gatewayUrl: "ws://127.0.0.1:18789",
        token: "token",
        selectedAdapterType: "openclaw",
        activeAdapterType: "openclaw",
        status: "disconnected",
        error: null,
        onGatewayUrlChange: vi.fn(),
        onTokenChange: vi.fn(),
        onAdapterTypeChange: vi.fn(),
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
      })
    );

    const disconnected = screen.getByText("Disconnected");
    expect(disconnected).toHaveAttribute("data-status", "disconnected");
    expect(disconnected).toHaveClass("ui-badge-status-disconnected");

    rerender(
      createElement(ConnectionPanel, {
        gatewayUrl: "ws://127.0.0.1:18789",
        token: "token",
        selectedAdapterType: "openclaw",
        activeAdapterType: "openclaw",
        status: "connected",
        error: null,
        onGatewayUrlChange: vi.fn(),
        onTokenChange: vi.fn(),
        onAdapterTypeChange: vi.fn(),
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
      })
    );

    const connected = screen.getByText("Connected");
    expect(connected).toHaveAttribute("data-status", "connected");
    expect(connected).toHaveClass("ui-badge-status-connected");
  });
});
