const { WebSocket, WebSocketServer } = require("ws");

const { buildServerDeviceAuth } = require("./studio-device");

const buildErrorResponse = (id, code, message) => {
  return {
    type: "res",
    id,
    ok: false,
    error: { code, message },
  };
};

const isObject = (value) => Boolean(value && typeof value === "object");

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const resolvePathname = (url) => {
  const raw = typeof url === "string" ? url : "";
  const idx = raw.indexOf("?");
  return (idx === -1 ? raw : raw.slice(0, idx)) || "/";
};

const injectAuthToken = (params, token) => {
  const next = isObject(params) ? { ...params } : {};
  const auth = isObject(next.auth) ? { ...next.auth } : {};
  auth.token = token;
  next.auth = auth;
  return next;
};

const resolveOriginForUpstream = (upstreamUrl) => {
  const url = new URL(upstreamUrl);
  const proto = url.protocol === "wss:" ? "https:" : "http:";
  const hostname =
    url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "0.0.0.0"
      ? "localhost"
      : url.hostname;
  const host = url.port ? `${hostname}:${url.port}` : hostname;
  return `${proto}//${host}`;
};

const hasNonEmptyToken = (params) => {
  const raw = params && isObject(params) && isObject(params.auth) ? params.auth.token : "";
  return typeof raw === "string" && raw.trim().length > 0;
};

const hasNonEmptyPassword = (params) => {
  const raw = params && isObject(params) && isObject(params.auth) ? params.auth.password : "";
  return typeof raw === "string" && raw.trim().length > 0;
};

const hasNonEmptyDeviceToken = (params) => {
  const raw = params && isObject(params) && isObject(params.auth) ? params.auth.deviceToken : "";
  return typeof raw === "string" && raw.trim().length > 0;
};

const hasCompleteDeviceAuth = (params) => {
  const device = params && isObject(params) && isObject(params.device) ? params.device : null;
  if (!device) {
    return false;
  }
  const id = typeof device.id === "string" ? device.id.trim() : "";
  const publicKey = typeof device.publicKey === "string" ? device.publicKey.trim() : "";
  const signature = typeof device.signature === "string" ? device.signature.trim() : "";
  const nonce = typeof device.nonce === "string" ? device.nonce.trim() : "";
  const signedAt = device.signedAt;
  return (
    id.length > 0 &&
    publicKey.length > 0 &&
    signature.length > 0 &&
    nonce.length > 0 &&
    Number.isFinite(signedAt) &&
    signedAt >= 0
  );
};

// Extract client metadata from connect frame params for device auth signing.
const resolveClientMeta = (params) => {
  const client = params && isObject(params) && isObject(params.client) ? params.client : {};
  return {
    clientId: typeof client.id === "string" ? client.id : "openclaw-control-ui",
    clientMode: typeof client.mode === "string" ? client.mode : "webchat",
    role: typeof params?.role === "string" ? params.role : "operator",
    scopes: Array.isArray(params?.scopes)
      ? params.scopes.filter((s) => typeof s === "string")
      : ["operator.read", "operator.write", "operator.admin", "operator.approvals", "operator.pairing"],
  };
};

function createGatewayProxy(options) {
  const {
    loadUpstreamSettings,
    allowWs = (req) => resolvePathname(req.url) === "/api/gateway/ws",
    log = () => {},
    logError = (msg, err) => console.error(msg, err),
  } = options || {};

  const { verifyClient } = options || {};

  if (typeof loadUpstreamSettings !== "function") {
    throw new Error("createGatewayProxy requires loadUpstreamSettings().");
  }

  const wss = new WebSocketServer({ noServer: true, verifyClient });

  wss.on("connection", (browserWs) => {
    let upstreamWs = null;
    let upstreamReady = false;
    let upstreamUrl = "";
    let upstreamToken = "";
    let connectRequestId = null;
    let connectResponseSent = false;
    let pendingConnectFrame = null;
    let pendingUpstreamSetupError = null;
    let closed = false;
    // Nonce received from the gateway's connect.challenge event.
    let challengeNonce = null;

    const closeBoth = (code, reason) => {
      if (closed) return;
      closed = true;
      try {
        browserWs.close(code, reason);
      } catch {}
      try {
        upstreamWs?.close(code, reason);
      } catch {}
    };

    const sendToBrowser = (frame) => {
      if (browserWs.readyState !== WebSocket.OPEN) return;
      browserWs.send(JSON.stringify(frame));
    };

    const sendConnectError = (code, message) => {
      if (connectRequestId && !connectResponseSent) {
        connectResponseSent = true;
        sendToBrowser(buildErrorResponse(connectRequestId, code, message));
      }
      closeBoth(1011, "connect failed");
    };

    // Forward the connect frame to the upstream gateway.
    // If the browser did not include device auth, add server-side Ed25519-signed
    // device auth so the gateway's control-ui-insecure-auth check passes.
    const forwardConnectFrame = async (frame) => {
      const browserHasDeviceAuth = hasCompleteDeviceAuth(frame.params);
      const browserHasCredential =
        hasNonEmptyToken(frame.params) ||
        hasNonEmptyPassword(frame.params) ||
        hasNonEmptyDeviceToken(frame.params) ||
        browserHasDeviceAuth;

      if (!upstreamToken && !browserHasCredential) {
        sendConnectError(
          "studio.gateway_token_missing",
          "Upstream gateway token is not configured on the Studio host."
        );
        return;
      }

      if (browserHasDeviceAuth) {
        // Browser already signed the challenge — forward as-is.
        upstreamWs.send(JSON.stringify(frame));
        return;
      }

      // Browser lacks device auth (disableDeviceAuth=true or non-secure context).
      // Build params with the upstream token injected, then add server-side device auth.
      try {
        const params = browserHasCredential
          ? frame.params
          : injectAuthToken(frame.params, upstreamToken);

        const effectiveToken = hasNonEmptyToken(params) ? params.auth?.token : upstreamToken;
        const { clientId, clientMode, role, scopes } = resolveClientMeta(params);

        const deviceAuth = await buildServerDeviceAuth({
          nonce: challengeNonce ?? undefined,
          token: effectiveToken,
          clientId,
          clientMode,
          role,
          scopes,
        });

        const connectFrame = {
          ...frame,
          params: {
            ...params,
            device: deviceAuth,
          },
        };
        upstreamWs.send(JSON.stringify(connectFrame));
      } catch (err) {
        logError("Failed to build server-side device auth.", err);
        sendConnectError(
          "studio.device_auth_failed",
          "Studio proxy failed to sign gateway connect request."
        );
      }
    };

    const maybeForwardPendingConnect = () => {
      if (!pendingConnectFrame || !upstreamReady || upstreamWs?.readyState !== WebSocket.OPEN) {
        return;
      }
      const frame = pendingConnectFrame;
      pendingConnectFrame = null;
      void forwardConnectFrame(frame);
    };

    const startUpstream = async () => {
      try {
        const settings = await loadUpstreamSettings();
        upstreamUrl = typeof settings?.url === "string" ? settings.url.trim() : "";
        upstreamToken = typeof settings?.token === "string" ? settings.token.trim() : "";
      } catch (err) {
        logError("Failed to load upstream gateway settings.", err);
        pendingUpstreamSetupError = {
          code: "studio.settings_load_failed",
          message: "Failed to load Studio gateway settings.",
        };
        return;
      }

      if (!upstreamUrl) {
        pendingUpstreamSetupError = {
          code: "studio.gateway_url_missing",
          message: "Upstream gateway URL is not configured on the Studio host.",
        };
        return;
      }

      let upstreamOrigin = "";
      try {
        upstreamOrigin = resolveOriginForUpstream(upstreamUrl);
      } catch {
        pendingUpstreamSetupError = {
          code: "studio.gateway_url_invalid",
          message: "Upstream gateway URL is invalid on the Studio host.",
        };
        return;
      }

      upstreamWs = new WebSocket(upstreamUrl, { origin: upstreamOrigin });

      upstreamWs.on("open", () => {
        upstreamReady = true;
        maybeForwardPendingConnect();
      });

      upstreamWs.on("message", (upRaw) => {
        const upStr = String(upRaw ?? "");
        const upParsed = safeJsonParse(upStr);

        // Track connect response id so we know when the handshake completes.
        if (upParsed && isObject(upParsed) && upParsed.type === "res") {
          const resId = typeof upParsed.id === "string" ? upParsed.id : "";
          if (resId && connectRequestId && resId === connectRequestId) {
            connectResponseSent = true;
          }
        }

        // Intercept connect.challenge to capture the nonce for server-side signing.
        if (
          upParsed &&
          isObject(upParsed) &&
          upParsed.type === "event" &&
          upParsed.event === "connect.challenge"
        ) {
          const payload = upParsed.payload;
          const nonce =
            payload && isObject(payload) && typeof payload.nonce === "string"
              ? payload.nonce
              : null;
          if (nonce) {
            challengeNonce = nonce;
          }
          // Forward the challenge to the browser as usual.
          if (browserWs.readyState === WebSocket.OPEN) {
            browserWs.send(upStr);
          }
          // If the connect frame was already queued (arrived before challenge), re-forward
          // it now that we have the nonce.
          if (pendingConnectFrame && upstreamReady && upstreamWs?.readyState === WebSocket.OPEN) {
            const frame = pendingConnectFrame;
            pendingConnectFrame = null;
            void forwardConnectFrame(frame);
          }
          return;
        }

        if (browserWs.readyState === WebSocket.OPEN) {
          browserWs.send(upStr);
        }
      });

      upstreamWs.on("close", (ev) => {
        const reason = typeof ev?.reason === "string" ? ev.reason : "";
        if (!connectResponseSent && connectRequestId) {
          sendToBrowser(
            buildErrorResponse(
              connectRequestId,
              "studio.upstream_closed",
              `Upstream gateway closed (${ev.code}): ${reason}`
            )
          );
        }
        closeBoth(1012, "upstream closed");
      });

      upstreamWs.on("error", (err) => {
        logError("Upstream gateway WebSocket error.", err);
        sendConnectError(
          "studio.upstream_error",
          "Failed to connect to upstream gateway WebSocket."
        );
      });

      log("proxy connected");
    };

    void startUpstream();

    browserWs.on("message", async (raw) => {
      const parsed = safeJsonParse(String(raw ?? ""));
      if (!parsed || !isObject(parsed)) {
        closeBoth(1003, "invalid json");
        return;
      }

      if (!connectRequestId) {
        if (parsed.type !== "req" || parsed.method !== "connect") {
          closeBoth(1008, "connect required");
          return;
        }
        const id = typeof parsed.id === "string" ? parsed.id : "";
        if (!id) {
          closeBoth(1008, "connect id required");
          return;
        }
        connectRequestId = id;
        if (pendingUpstreamSetupError) {
          sendConnectError(pendingUpstreamSetupError.code, pendingUpstreamSetupError.message);
          return;
        }
        pendingConnectFrame = parsed;
        maybeForwardPendingConnect();
        return;
      }

      if (!upstreamReady || upstreamWs.readyState !== WebSocket.OPEN) {
        closeBoth(1013, "upstream not ready");
        return;
      }

      if (parsed.type === "req" && parsed.method === "connect" && !connectResponseSent) {
        pendingConnectFrame = null;
        void forwardConnectFrame(parsed);
        return;
      }

      upstreamWs.send(JSON.stringify(parsed));
    });

    browserWs.on("close", () => {
      closeBoth(1000, "client closed");
    });

    browserWs.on("error", (err) => {
      logError("Browser WebSocket error.", err);
      closeBoth(1011, "client error");
    });
  });

  const handleUpgrade = (req, socket, head) => {
    if (!allowWs(req)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  };

  return { wss, handleUpgrade };
}

module.exports = { createGatewayProxy };
