# Deploy Claw3D Behind Entra ID And oauth2-proxy

This guide describes a production deployment pattern for Claw3D on an Azure VM
behind nginx, Let's Encrypt, oauth2-proxy, and Microsoft Entra ID.

Use this when you want enterprise SSO in front of Claw3D without adding a
built-in OIDC login flow to the app itself.

## Topology

```text
Browser
  -> https://claw3d.example.com
  -> nginx / Let's Encrypt
  -> oauth2-proxy / Entra ID
  -> Claw3D Studio on 127.0.0.1:3000
  -> OpenClaw Gateway over ws:// or wss:// from the Studio host
```

Claw3D still owns the Studio UI and same-origin gateway WebSocket proxy. Entra
ID and oauth2-proxy own user authentication before requests reach Claw3D.

## Prerequisites

- Azure VM with Node.js 20+ and npm 10+.
- DNS record for the Claw3D host, for example `claw3d.example.com`.
- nginx installed on the VM.
- TLS certificate from Let's Encrypt or another trusted CA.
- oauth2-proxy installed on the VM.
- An Entra ID tenant where you can create an app registration.
- A running OpenClaw Gateway reachable from the Claw3D Studio host.

## Entra ID app registration

Create an Entra ID app registration for oauth2-proxy.

Recommended settings:

- Platform type: Web.
- Redirect URI:

```text
https://claw3d.example.com/oauth2/callback
```

- Supported account type: choose the tenant policy your organization requires.
- Client secret: create one and store it only on the VM.
- API permissions:
  - `openid`
  - `profile`
  - `email`

Record these values:

- Tenant ID.
- Client ID.
- Client secret.

## Claw3D environment

Run Claw3D on loopback and let nginx expose it publicly.

Example `.env` values:

```bash
HOST=127.0.0.1
PORT=3000
TRUSTED_PROXY=1
UPSTREAM_ALLOWLIST=openclaw-gateway.example.com,localhost,127.0.0.1
CLAW3D_GATEWAY_URL=wss://openclaw-gateway.example.com
CLAW3D_GATEWAY_ADAPTER_TYPE=openclaw
CLAW3D_OFFICE_EVENTS_SECRET=<long-random-webhook-secret>
```

Notes:

- Keep `HOST=127.0.0.1` when nginx and oauth2-proxy are on the same VM.
- Set `TRUSTED_PROXY=1` only when nginx is the only public entry point and
  direct public access to Claw3D is blocked.
- Set `UPSTREAM_ALLOWLIST` in production so Studio only proxies approved gateway
  hosts.
- `CLAW3D_OFFICE_EVENTS_SECRET` is only needed if you use
  `POST /api/office/events`.

`STUDIO_ACCESS_TOKEN` is optional in this deployment. oauth2-proxy is the main
browser-facing auth gate. If you also enable `STUDIO_ACCESS_TOKEN`, configure
oauth2-proxy or nginx to issue the expected `studio_access` cookie, otherwise
Claw3D will return `401 Studio access token required`.

Start Claw3D:

```bash
npm run build
npm run start
```

Use systemd, pm2, or another process manager for production.

## oauth2-proxy configuration

Example `/etc/oauth2-proxy/claw3d.cfg`:

```ini
provider = "oidc"
oidc_issuer_url = "https://login.microsoftonline.com/<tenant-id>/v2.0"

client_id = "<application-client-id>"
client_secret = "<application-client-secret>"
redirect_url = "https://claw3d.example.com/oauth2/callback"

email_domains = [ "*" ]
scope = "openid profile email"

cookie_secret = "<base64-32-byte-secret>"
cookie_secure = true
cookie_httponly = true
cookie_samesite = "lax"
cookie_expire = "8h"
cookie_refresh = "1h"

reverse_proxy = true
set_xauthrequest = true
pass_authorization_header = true
pass_access_token = false

upstreams = [ "http://127.0.0.1:3000" ]
http_address = "127.0.0.1:4180"
```

Generate a cookie secret:

```bash
python3 - <<'PY'
import base64, os
print(base64.urlsafe_b64encode(os.urandom(32)).decode())
PY
```

Restrict access further with oauth2-proxy options such as `allowed_groups` or
`allowed_email_domains` if your Entra tenant requires it.

## nginx configuration

Example server block:

```nginx
server {
    listen 80;
    server_name claw3d.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name claw3d.example.com;

    ssl_certificate /etc/letsencrypt/live/claw3d.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/claw3d.example.com/privkey.pem;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /oauth2/ {
        proxy_pass http://127.0.0.1:4180;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /oauth2/auth {
        internal;
        proxy_pass http://127.0.0.1:4180;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
    }

    location / {
        auth_request /oauth2/auth;
        error_page 401 = /oauth2/start;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/gateway/ws {
        auth_request /oauth2/auth;
        error_page 401 = /oauth2/start;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

The explicit `/api/gateway/ws` location is important. Claw3D uses this
same-origin WebSocket endpoint for browser-to-Studio gateway traffic.

## Webhook ingress

If you expose `POST /api/office/events` to systems such as HubSpot or CI, keep
the endpoint behind the same TLS host and require signed payloads.

Example signed request:

```bash
body='{"source":"hubspot","eventType":"deal.closed","title":"Deal closed","message":"Automotive account signed.","effect":"confetti"}'
ts="$(date +%s000)"
sig="sha256=$(printf '%s.%s' "$ts" "$body" | openssl dgst -sha256 -hmac "$CLAW3D_OFFICE_EVENTS_SECRET" -hex | awk '{print $2}')"

curl -X POST https://claw3d.example.com/api/office/events \
  -H "Content-Type: application/json" \
  -H "X-Claw3D-Timestamp: $ts" \
  -H "X-Claw3D-Signature: $sig" \
  --data "$body"
```

Recommended nginx hardening for webhooks:

- Keep TLS enabled.
- Keep request body size small.
- Allowlist source IP ranges when your provider publishes stable ranges.
- Rotate `CLAW3D_OFFICE_EVENTS_SECRET` if it is exposed.

## Health checks

From the VM:

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:4180/oauth2/start
```

From a browser:

1. Open `https://claw3d.example.com/office`.
2. Confirm Entra redirects you to sign in.
3. Confirm the office UI loads after sign-in.
4. Confirm the browser WebSocket connects through `/api/gateway/ws`.
5. Confirm the configured OpenClaw Gateway is reachable from the Studio host.

## Troubleshooting

### Redirect loop

- Confirm `redirect_url` in oauth2-proxy exactly matches the Entra redirect URI.
- Confirm nginx sends `X-Forwarded-Proto: https`.
- Confirm oauth2-proxy has `reverse_proxy = true`.

### WebSocket does not connect

- Confirm nginx has a dedicated `/api/gateway/ws` location.
- Confirm `proxy_set_header Upgrade $http_upgrade`.
- Confirm `proxy_set_header Connection "upgrade"`.
- Confirm oauth2-proxy protects the WebSocket route with `auth_request`.

### `401 Studio access token required`

This means `STUDIO_ACCESS_TOKEN` is enabled but the expected `studio_access`
cookie is not present. Either disable `STUDIO_ACCESS_TOKEN` and rely on
oauth2-proxy, or configure your deployment to issue the cookie before requests
reach Claw3D.

### Gateway proxy blocked

Set `UPSTREAM_ALLOWLIST` to include the upstream OpenClaw Gateway host. For
direct runtime integrations, also set `CUSTOM_RUNTIME_ALLOWLIST` or include the
runtime host in `UPSTREAM_ALLOWLIST`.

### User can reach Claw3D without Entra

- Confirm Claw3D listens only on `127.0.0.1`.
- Confirm the VM firewall does not expose port `3000`.
- Confirm nginx is the only public listener.
- Confirm `TRUSTED_PROXY=1` is only set behind your controlled nginx proxy.
