import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

// A small JSON-file store. Chosen over a real database so the project runs with
// `npm install` alone — no service to start, no native build step. The API below
// is deliberately repository-shaped so swapping in Postgres touches only this file.

const EMPTY = { users: [], hotels: [], bookings: [], reviews: [], favorites: [], audit: [] };

let cache = null;
let writing = Promise.resolve();

const ensureDir = () => fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });

export const load = () => {
  if (cache) return cache;
  ensureDir();
  try {
    const raw = fs.readFileSync(config.dataFile, 'utf8');
    cache = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache;
};

// Writes are serialised through one promise chain and land via a temp file +
// rename, so a crash mid-write cannot leave a truncated database behind.
export const flush = () => {
  const snapshot = JSON.stringify(cache, null, 2);
  writing = writing.then(async () => {
    ensureDir();
    const tmp = `${config.dataFile}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, snapshot, 'utf8');
    await fsp.rename(tmp, config.dataFile);
  });
  return writing;
};

export const db = {
  get data() {
    return load();
  },

  table(name) {
    const rows = load()[name];
    if (!rows) throw new Error(`Unknown table "${name}"`);
    return rows;
  },

  all(name, predicate) {
    const rows = this.table(name);
    return predicate ? rows.filter(predicate) : rows.slice();
  },

  find(name, predicate) {
    return this.table(name).find(predicate) || null;
  },

  byId(name, id) {
    return this.find(name, (row) => row.id === id);
  },

  insert(name, row) {
    this.table(name).push(row);
    flush();
    return row;
  },

  update(name, id, patch) {
    const rows = this.table(name);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return null;
    rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() };
    flush();
    return rows[index];
  },

  remove(name, id) {
    const rows = this.table(name);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return false;
    rows.splice(index, 1);
    flush();
    return true;
  },

  replaceAll(name, rows) {
    load()[name] = rows;
    flush();
    return rows;
  },
};

export const resetCache = () => {
  cache = null;
};
