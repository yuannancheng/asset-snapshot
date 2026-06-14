#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const { version } = pkg;

// Sync tauri.conf.json
const tauriPath = resolve(root, "src-tauri", "tauri.conf.json");
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
if (tauri.version !== version) {
  tauri.version = version;
  writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n", "utf8");
  console.log("tauri.conf.json -> " + version);
}

// Sync Cargo.toml
const cargoPath = resolve(root, "src-tauri", "Cargo.toml");
let cargo = readFileSync(cargoPath, "utf8");
const re = /^version\s*=\s*"[^"]*"/m;
const next = 'version = "' + version + '"';
if (cargo.match(re)?.[0] !== next) {
  cargo = cargo.replace(re, next);
  writeFileSync(cargoPath, cargo, "utf8");
  console.log("Cargo.toml -> " + version);
}
