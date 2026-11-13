# Self-host notes (suralism fork)

Deployment owned by this machine, not upstream's public worker.

## Worker

- URL: https://gemini-bridge.suralism.workers.dev
- Cloudflare account: bd1a35bb5a1370b016121fa9d3a1b18c (suralismz@gmail.com)
- KV namespace ARTIFACT_KV: fd7428a2eae74f209e1b16dfc2d5ffbb
- Secrets: `BRIDGE_AUTH_TOKEN` + `CLIENT_API_KEY` (generated locally, stored in `.env`, gitignored)

Redeploy:

```bash
cd cloudflare-worker
npm install --omit=dev
CLOUDFLARE_ACCOUNT_ID=bd1a35bb5a1370b016121fa9d3a1b18c npx wrangler deploy
```

Rotate a secret:

```bash
printf '%s' "$NEW_VALUE" | npx wrangler secret put BRIDGE_AUTH_TOKEN
```

## Extension (local build)

`dist/extension` in git holds **placeholders only**. Build the loadable copy:

```bash
python scripts/build-local.py     # -> dist/extension-local (gitignored)
```

Then in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** →
`G:\Vibe\gemini-web-bridge\dist\extension-local`, and keep
`https://gemini.google.com` open and logged in.

## Required vars (beyond the secrets)

`ALLOWED_ORIGINS` must include the Chrome extension origin or every `/bridge`
upgrade is rejected with HTTP 403 (KAN-308):

```toml
ALLOWED_ORIGINS = "chrome-extension://<extension-id>"
```

The unpacked extension id is stable for a given path and is shown on
`chrome://extensions`. Current id: `dlbegaecpgfiblgidolejligmkghojkd`.

## Use from clients

- OpenAI-compatible: `https://gemini-bridge.suralism.workers.dev/v1`
  (`Authorization: Bearer <CLIENT_API_KEY>`)
- MCP: `https://gemini-bridge.suralism.workers.dev/mcp` (same bearer header)
- Hermes: provider `geminibridge` and `mcp_servers.geminibridge` are already in
  `~/AppData/Local/hermes/config.yaml`.

Health: `curl https://gemini-bridge.suralism.workers.dev/health` →
`extension_status: CONNECTED_AND_READY` when the browser bridge is live.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/health` says DISCONNECTED but the page pill says Online | WS upgrade rejected | check `ALLOWED_ORIGINS` contains the current extension origin (403) |
| `chat/completions` 500 `Google Web Endpoint returned HTTP 400` | Gemini web rejected the replayed StreamGenerate payload for the account/UI/model in use | switch the page model (Pro is known-good), retry on the primary Google account (`/u/0`), or set `GEMINI_API_KEY` and rely on the hybrid fallback (non-streaming only) |
| Extension won't load: `Could not load options page` | upstream deleted `options.html` but kept the manifest key | fixed here — `dist/extension/options.html` is tracked |
