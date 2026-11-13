// Options page controller: reads/writes chrome.storage.sync and shows bridge health.
"use strict";

const DEFAULTS = (globalThis.GeminiBridgeSettings || {});
const KEYS = ["workerUrl", "bridgeToken", "clientApiToken", "enforcementMode"];

const $ = (id) => document.getElementById(id);

function mask(value) {
  if (!value) return "";
  return value.length <= 10 ? "•".repeat(value.length) : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function effective(stored) {
  const s = DEFAULTS.resolveSettings ? DEFAULTS.resolveSettings(stored) : {};
  return {
    workerUrl: (stored.workerUrl || DEFAULTS.DEFAULT_WORKER_URL || "").trim(),
    bridgeToken: (stored.bridgeToken || DEFAULTS.DEFAULT_BRIDGE_AUTH_TOKEN || "").trim(),
    clientApiToken: (stored.clientApiToken || DEFAULTS.DEFAULT_CLIENT_API_KEY || "").trim(),
    enforcementMode: stored.enforcementMode === "permissive" ? "permissive" : "strict",
    resolved: s,
  };
}

async function load() {
  const stored = await chrome.storage.sync.get(KEYS);
  const eff = effective(stored);

  $("workerUrl").placeholder = eff.workerUrl;
  $("bridgeToken").placeholder = mask(eff.bridgeToken);
  $("clientApiToken").placeholder = mask(eff.clientApiToken);
  $("enforcementMode").value = eff.enforcementMode;

  $("workerUrlHint").textContent = `Effective: ${eff.workerUrl || "(not set)"}`;
  checkHealth(eff.workerUrl);
}

async function checkHealth(workerUrl) {
  const dot = $("statusDot");
  const text = $("statusText");
  const meta = $("statusMeta");
  if (!workerUrl) {
    dot.className = "dot bad";
    text.textContent = "No worker URL configured";
    meta.textContent = "";
    return;
  }
  try {
    const res = await fetch(`${workerUrl.replace(/\/+$/, "")}/health`, { cache: "no-store" });
    const body = await res.json();
    const connected = body.extension_status === "CONNECTED_AND_READY";
    dot.className = `dot ${connected ? "ok" : "bad"}`;
    text.textContent = connected ? "Bridge connected" : `Bridge ${body.extension_status || "disconnected"}`;
    meta.textContent = `v${body.version} · model: ${body.browser_models?.active_model || "—"} · scope: ${body.current_scope || "—"}`;
  } catch (err) {
    dot.className = "dot bad";
    text.textContent = "Worker unreachable";
    meta.textContent = String(err && err.message ? err.message : err);
  }
}

function readForm() {
  const out = {};
  for (const key of KEYS) {
    const el = $(key);
    const value = (el && el.value ? el.value : "").trim();
    if (value) out[key] = value;
  }
  return out;
}

$("save").addEventListener("click", async () => {
  const values = readForm();
  await chrome.storage.sync.set(values);
  $("savedMsg").textContent = "Saved";
  setTimeout(() => { $("savedMsg").textContent = ""; }, 2500);
  await load();
});

$("reset").addEventListener("click", async () => {
  await chrome.storage.sync.remove(KEYS);
  for (const key of KEYS) {
    if (key !== "enforcementMode") $(key).value = "";
  }
  $("savedMsg").textContent = "Reset";
  setTimeout(() => { $("savedMsg").textContent = ""; }, 2500);
  await load();
});

load();
