import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const ORIGINAL_ENV = { ...process.env };

const setupAndImportHook = async (gatewayUrl: string | null) => {
  process.env = { ...ORIGINAL_ENV };
  if (gatewayUrl === null) {
    delete process.env.NEXT_PUBLIC_GATEWAY_URL;
  } else {
    process.env.NEXT_PUBLIC_GATEWAY_URL = gatewayUrl;
  }

  vi.resetModules();
  vi.spyOn(console, "info").mockImplementation(() => {});

  const captured: {
    url: string | null;
    token: unknown;
    authScopeKey: unknown;
    clientName: unknown;
  } = {
    url: null,
    token: null,
    authScopeKey: null,
    clientName: null,
  };

  vi.doMock("../../src/lib/gateway/openclaw/GatewayBrowserClient", () => {
    class GatewayBrowserClient {
      connected = false;
      private opts: {
        onHello?: (hello: unknown) => void;
        onEvent?: (event: unknown) => void;
        onClose?: (info: { code: number; reason: string }) => void;
        onGap?: (info: { expected: number; received: number }) => void;
      };

      constructor(opts: Record<string, unknown>) {
        captured.url = typeof opts.url === "string" ? opts.url : null;
        captured.token = "token" in opts ? opts.token : null;
        captured.authScopeKey = "authScopeKey" in opts ? opts.authScopeKey : null;
        captured.clientName = "clientName" in opts ? opts.clientName : null;
        this.opts = {
          onHello: typeof opts.onHello === "function" ? (opts.onHello as (hello: unknown) => void) : undefined,
          onEvent: typeof opts.onEvent === "function" ? (opts.onEvent as (event: unknown) => void) : undefined,
          onClose: typeof opts.onClose === "function" ? (opts.onClose as (info: { code: number; reason: string }) => void) : undefined,
          onGap: typeof opts.onGap === "function" ? (opts.onGap as (info: { expected: number; received: number }) => void) : undefined,
        };
      }

      start() {
        this.connected = true;
        this.opts.onHello?.({ type: "hello-ok", protocol: 1, adapterType: "openclaw" });
      }

      stop() {
        this.connected = false;
        this.opts.onClose?.({ code: 1000, reason: "stopped" });
      }

      async request<T = unknown>(method: string, params: unknown): Promise<T> {
        void method;
        void params;
        return {} as T;
      }
    }

    return { GatewayBrowserClient };
  });

  const mod = await import("@/lib/gateway/GatewayClient");
  return {
    useGatewayConnection: mod.useGatewayConnection as (settingsCoordinator: {
      loadSettings: () => Promise<unknown>;
      loadSettingsEnvelope?: () => Promise<unknown>;
      schedulePatch: (patch: unknown) => void;
      flushPending: () => Promise<void>;
    }) => {
      gatewayUrl: string;
      token: string;
      selectedAdapterType: "openclaw" | "hermes" | "demo" | "custom";
      detectedAdapterType: "openclaw" | "hermes" | "demo" | "custom" | null;
      activeAdapterType: "openclaw" | "hermes" | "demo" | "custom";
      localGatewayDefaults: {
        url: string;
        token: string;
        adapterType: "openclaw" | "hermes" | "demo" | "custom";
      } | null;
      shouldPromptForConnect: boolean;
      useLocalGatewayDefaults: () => void;
      setSelectedAdapterType: (value: "openclaw" | "hermes" | "demo" | "custom") => void;
      connect: () => Promise<void>;
    },
    captured,
  };
};

describe("useGatewayConnection", () => {
  afterEach(() => {
    cleanup();
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("defaults_to_env_url_when_set", async () => {
    const { useGatewayConnection } = await setupAndImportHook("ws://example.test:1234");
    const coordinator = {
      loadSettings: async () => null,
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () =>
      createElement(
        "div",
        { "data-testid": "gatewayUrl" },
        useGatewayConnection(coordinator).gatewayUrl
      );

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("ws://example.test:1234");
    });
  });

  it("falls_back_to_local_default_when_env_unset", async () => {
    const { useGatewayConnection } = await setupAndImportHook(null);
    const coordinator = {
      loadSettings: async () => null,
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () =>
      createElement(
        "div",
        { "data-testid": "gatewayUrl" },
        useGatewayConnection(coordinator).gatewayUrl
      );

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("ws://localhost:18789");
    });
  });

  it("connects_via_studio_proxy_ws_and_does_not_pass_token", async () => {
    const { useGatewayConnection, captured } = await setupAndImportHook(null);
    const coordinator = {
      loadSettings: async () => null,
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "wss://remote.example",
            token: "",
            adapterType: "hermes",
            lastKnownGood: {
              url: "wss://remote.example",
              token: "",
              adapterType: "hermes",
            },
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      useGatewayConnection(coordinator);
      return createElement("div", null, "ok");
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(captured.url).toBe("ws://localhost:3000/api/gateway/ws");
    });
    expect(captured.token).toBe("");
    expect(captured.authScopeKey).toBe("wss://remote.example");
    expect(captured.clientName).toBe("openclaw-control-ui");
  });

  it("uses_webchat_identity_for_remote_openclaw_connections", async () => {
    const { useGatewayConnection, captured } = await setupAndImportHook(null);
    const coordinator = {
      loadSettings: async () => null,
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "wss://pi5.myth-coho.ts.net",
            token: "shared-token",
            adapterType: "openclaw",
            lastKnownGood: {
              url: "wss://pi5.myth-coho.ts.net",
              token: "shared-token",
              adapterType: "openclaw",
            },
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      useGatewayConnection(coordinator);
      return createElement("div", null, "ok");
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(captured.url).toBe("ws://localhost:3000/api/gateway/ws");
    });
    expect(captured.authScopeKey).toBe("wss://pi5.myth-coho.ts.net");
    expect(captured.clientName).toBe("webchat-ui");
  });

  it("keeps_control_ui_identity_for_local_openclaw_connections", async () => {
    const { useGatewayConnection, captured } = await setupAndImportHook(null);
    const coordinator = {
      loadSettings: async () => null,
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "ws://localhost:18789",
            token: "shared-token",
            adapterType: "openclaw",
            lastKnownGood: {
              url: "ws://localhost:18789",
              token: "shared-token",
              adapterType: "openclaw",
            },
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      useGatewayConnection(coordinator);
      return createElement("div", null, "ok");
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(captured.url).toBe("ws://localhost:3000/api/gateway/ws");
    });
    expect(captured.authScopeKey).toBe("ws://localhost:18789");
    expect(captured.clientName).toBe("openclaw-control-ui");
  });

  it("does_not_auto_connect_without_a_last_known_good_state", async () => {
    const { useGatewayConnection, captured } = await setupAndImportHook(null);
    const coordinator = {
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "ws://localhost:18789",
            token: "",
            adapterType: "hermes",
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      loadSettings: async () => null,
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "gatewayUrl" }, state.gatewayUrl),
        createElement(
          "div",
          { "data-testid": "shouldPromptForConnect" },
          state.shouldPromptForConnect ? "yes" : "no"
        )
      );
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("ws://localhost:18789");
    });
    expect(screen.getByTestId("shouldPromptForConnect")).toHaveTextContent("yes");
    expect(captured.url).toBeNull();
  });

  it("uses_a_small_initial_auto_connect_delay_for_hermes_and_demo_only", async () => {
    const mod = await import("@/lib/gateway/GatewayClient");
    expect(mod.resolveInitialGatewayAutoConnectDelayMs("openclaw")).toBe(0);
    expect(mod.resolveInitialGatewayAutoConnectDelayMs("custom")).toBe(0);
    expect(mod.resolveInitialGatewayAutoConnectDelayMs("hermes")).toBe(900);
    expect(mod.resolveInitialGatewayAutoConnectDelayMs("demo")).toBe(900);
  });

  it("retries_only_the_first_connect_for_hermes_and_demo", async () => {
    const mod = await import("@/lib/gateway/GatewayClient");
    expect(mod.resolveInitialGatewayConnectAttemptCount("openclaw", false)).toBe(1);
    expect(mod.resolveInitialGatewayConnectAttemptCount("custom", false)).toBe(1);
    expect(mod.resolveInitialGatewayConnectAttemptCount("hermes", false)).toBe(2);
    expect(mod.resolveInitialGatewayConnectAttemptCount("demo", false)).toBe(2);
    expect(mod.resolveInitialGatewayConnectAttemptCount("hermes", true)).toBe(2);
    expect(mod.resolveInitialGatewayConnectAttemptCount("demo", true)).toBe(2);
    expect(mod.resolveInitialGatewayConnectAttemptCount("openclaw", true)).toBe(1);
  });

  it("uses_webchat_client_id_only_for_remote_openclaw", async () => {
    const mod = await import("@/lib/gateway/GatewayClient");
    expect(mod.resolveGatewayClientName("openclaw", "wss://pi5.myth-coho.ts.net")).toBe(
      "webchat-ui"
    );
    expect(mod.resolveGatewayClientName("openclaw", "ws://localhost:18789")).toBe(
      "openclaw-control-ui"
    );
    expect(mod.resolveGatewayClientName("hermes", "ws://localhost:18789")).toBe(
      "openclaw-control-ui"
    );
  });

  it("auto_applies_runtime_local_defaults_when_no_saved_gateway_and_build_time_empty", async () => {
    // Simulates #57: NEXT_PUBLIC_GATEWAY_URL was never rebuilt, but
    // CLAW3D_GATEWAY_URL is set on the server so localGatewayDefaults
    // comes through in the sanitized (public) form with tokenConfigured.
    const { useGatewayConnection } = await setupAndImportHook("");
    const coordinator = {
      loadSettings: async () => null,
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: null, // no saved gateway settings
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
        },
        // Sanitized public form — token is replaced with tokenConfigured
        localGatewayDefaults: { url: "ws://my-server:18789", tokenConfigured: true },
      }),
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "gatewayUrl" }, state.gatewayUrl),
        createElement(
          "div",
          { "data-testid": "localDefaultsUrl" },
          state.localGatewayDefaults?.url ?? ""
        )
      );
    };

    render(createElement(Probe));

    // The runtime local defaults should be auto-applied since there are
    // no saved settings and the build-time default is empty.
    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("ws://my-server:18789");
    });
    expect(screen.getByTestId("localDefaultsUrl")).toHaveTextContent("ws://my-server:18789");
  });

  it("applies_local_defaults_from_settings_envelope", async () => {
    const { useGatewayConnection } = await setupAndImportHook(null);
    const coordinator = {
      loadSettings: async () => ({
        version: 1,
        gateway: null,
        focused: {},
        avatars: {},
        analytics: {},
        voiceReplies: {},
      }),
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: { url: "wss://remote.example", token: "remote-token" },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
        },
        localGatewayDefaults: { url: "ws://localhost:18789", token: "local-token" },
      }),
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "gatewayUrl" }, state.gatewayUrl),
        createElement("div", { "data-testid": "token" }, state.token),
        createElement(
          "div",
          { "data-testid": "localDefaultsUrl" },
          state.localGatewayDefaults?.url ?? ""
        ),
        createElement(
          "button",
          {
            type: "button",
            onClick: state.useLocalGatewayDefaults,
            "data-testid": "useLocalDefaults",
          },
          "use"
        )
      );
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("wss://remote.example");
    });
    expect(screen.getByTestId("token")).toHaveTextContent("remote-token");
    expect(screen.getByTestId("localDefaultsUrl")).toHaveTextContent("ws://localhost:18789");

    fireEvent.click(screen.getByTestId("useLocalDefaults"));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("ws://localhost:18789");
    });
    expect(screen.getByTestId("token")).toHaveTextContent("local-token");
  });

  it("loads_and_persists_selected_adapter_type", async () => {
    const { useGatewayConnection } = await setupAndImportHook(null);
    const patches: unknown[] = [];
    const coordinator = {
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "ws://localhost:18789",
            token: "",
            adapterType: "hermes",
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      loadSettings: async () => null,
      schedulePatch: (patch: unknown) => {
        patches.push(patch);
      },
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "selectedAdapterType" }, state.selectedAdapterType),
        createElement("div", { "data-testid": "activeAdapterType" }, state.activeAdapterType)
      );
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("selectedAdapterType")).toHaveTextContent("hermes");
    });
    await waitFor(() => {
      expect(screen.getByTestId("activeAdapterType")).toHaveTextContent("hermes");
    });
    expect(patches).toEqual([]);
  });

  it("prefers_the_saved_selected_adapter_over_a_different_last_known_good_backend", async () => {
    const { useGatewayConnection, captured } = await setupAndImportHook(null);
    const coordinator = {
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "ws://localhost:18789",
            token: "",
            adapterType: "hermes",
            lastKnownGood: {
              url: "ws://localhost:9999",
              token: "openclaw-token",
              adapterType: "openclaw",
            },
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      loadSettings: async () => null,
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "gatewayUrl" }, state.gatewayUrl),
        createElement("div", { "data-testid": "selectedAdapterType" }, state.selectedAdapterType),
        createElement(
          "div",
          { "data-testid": "shouldPromptForConnect" },
          state.shouldPromptForConnect ? "yes" : "no"
        )
      );
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("ws://localhost:18789");
    });
    expect(screen.getByTestId("selectedAdapterType")).toHaveTextContent("hermes");
    expect(screen.getByTestId("shouldPromptForConnect")).toHaveTextContent("yes");
    expect(captured.url).toBeNull();
  });

  it("loads_custom_adapter_type_without_requiring_a_token", async () => {
    const { useGatewayConnection } = await setupAndImportHook(null);
    const coordinator = {
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "http://127.0.0.1:7770",
            token: "",
            adapterType: "custom",
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      loadSettings: async () => null,
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "gatewayUrl" }, state.gatewayUrl),
        createElement("div", { "data-testid": "selectedAdapterType" }, state.selectedAdapterType),
        createElement("div", { "data-testid": "activeAdapterType" }, state.activeAdapterType),
        createElement(
          "div",
          { "data-testid": "shouldPromptForConnect" },
          state.shouldPromptForConnect ? "yes" : "no"
        )
      );
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("http://127.0.0.1:7770");
    });
    expect(screen.getByTestId("selectedAdapterType")).toHaveTextContent("custom");
    expect(screen.getByTestId("activeAdapterType")).toHaveTextContent("custom");
    expect(screen.getByTestId("shouldPromptForConnect")).toHaveTextContent("yes");
  });

  it("still_prompts_to_reconnect_for_custom_with_last_known_good_state", async () => {
    const { useGatewayConnection } = await setupAndImportHook(null);
    const coordinator = {
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "http://127.0.0.1:7770",
            token: "",
            adapterType: "custom",
            lastKnownGood: {
              url: "http://127.0.0.1:7770",
              token: "",
              adapterType: "custom",
            },
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      loadSettings: async () => null,
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "selectedAdapterType" }, state.selectedAdapterType),
        createElement(
          "div",
          { "data-testid": "shouldPromptForConnect" },
          state.shouldPromptForConnect ? "yes" : "no"
        )
      );
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("selectedAdapterType")).toHaveTextContent("custom");
    });
    expect(screen.getByTestId("shouldPromptForConnect")).toHaveTextContent("yes");
  });

  it("persists_the_detected_backend_identity_in_last_known_good", async () => {
    const { useGatewayConnection } = await setupAndImportHook(null);
    const patches: unknown[] = [];
    const coordinator = {
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "wss://remote.example",
            token: "",
            adapterType: "hermes",
            lastKnownGood: {
              url: "wss://remote.example",
              token: "",
              adapterType: "hermes",
            },
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      loadSettings: async () => null,
      schedulePatch: (patch: unknown) => {
        patches.push(patch);
      },
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "selectedAdapterType" }, state.selectedAdapterType),
        createElement(
          "button",
          {
            type: "button",
            "data-testid": "connect",
            onClick: () => {
              void state.connect();
            },
          },
          "connect"
        )
      );
    };

    render(createElement(Probe));
    await waitFor(() => {
      expect(screen.getByTestId("selectedAdapterType")).toHaveTextContent("hermes");
    });
    fireEvent.click(screen.getByTestId("connect"));

    await waitFor(() => {
      expect(
        patches.some(
          (patch) =>
            typeof patch === "object" &&
            patch !== null &&
            "gateway" in patch &&
            typeof (patch as { gateway?: { lastKnownGood?: { adapterType?: string } } }).gateway
              ?.lastKnownGood?.adapterType === "string"
        )
      ).toBe(true);
    });

    expect(patches).toContainEqual({
      gateway: {
        lastKnownGood: {
          url: "wss://remote.example",
          token: "",
          adapterType: "openclaw",
        },
      },
    });
  });

  it("restores_backend_specific_profiles_when_switching_adapter_type", async () => {
    const { useGatewayConnection } = await setupAndImportHook(null);
    const coordinator = {
      loadSettingsEnvelope: async () => ({
        settings: {
          version: 1,
          gateway: {
            url: "ws://localhost:18789",
            token: "",
            adapterType: "hermes",
            profiles: {
              hermes: { url: "ws://localhost:18789", token: "" },
              custom: { url: "http://127.0.0.1:7770", token: "" },
            },
          },
          focused: {},
          avatars: {},
          analytics: {},
          voiceReplies: {},
          office: {},
          deskAssignments: {},
          standup: {},
          taskBoard: {},
        },
        localGatewayDefaults: null,
      }),
      loadSettings: async () => null,
      schedulePatch: () => {},
      flushPending: async () => {},
    };

    const Probe = () => {
      const state = useGatewayConnection(coordinator);
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "gatewayUrl" }, state.gatewayUrl),
        createElement(
          "button",
          {
            type: "button",
            "data-testid": "switch-custom",
            onClick: () => state.setSelectedAdapterType("custom"),
          },
          "custom"
        )
      );
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("ws://localhost:18789");
    });

    fireEvent.click(screen.getByTestId("switch-custom"));

    await waitFor(() => {
      expect(screen.getByTestId("gatewayUrl")).toHaveTextContent("http://127.0.0.1:7770");
    });
  });
});
