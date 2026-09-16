import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { config } from '../config/configuration';
import type { Database, Row, TableName } from '../types/models';

const EMPTY = (): Database => ({
  users: [],
  hotels: [],
  bookings: [],
  reviews: [],
  favorites: [],
  audit: [],
});

/**
 * A small JSON-file store. Chosen over a real database so the project runs with
 * `npm install` alone — no service to start, no native build step. The surface
 * below is deliberately repository-shaped, so swapping in Postgres (TypeORM,
 * Prisma, …) means reimplementing this provider and nothing else.
 */
@Injectable()
export class StoreService {
  private cache: Database | null = null;
  private writing: Promise<void> = Promise.resolve();

  private ensureDir(): void {
    fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
  }

  load(): Database {
    if (this.cache) return this.cache;
    this.ensureDir();
    try {
      const raw = fs.readFileSync(config.dataFile, 'utf8');
      this.cache = { ...EMPTY(), ...(JSON.parse(raw) as Partial<Database>) };
    } catch {
      this.cache = EMPTY();
    }
    return this.cache;
  }

  get data(): Database {
    return this.load();
  }

  /**
   * Writes are serialised through one promise chain and land via a temp file +
   * rename, so a crash mid-write cannot leave a truncated database behind.
   */
  flush(): Promise<void> {
    const snapshot = JSON.stringify(this.load(), null, 2);
    this.writing = this.writing.then(async () => {
      this.ensureDir();
      const tmp = `${config.dataFile}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, snapshot, 'utf8');
      await fsp.rename(tmp, config.dataFile);
    });
    return this.writing;
  }

  table<T extends TableName>(name: T): Database[T] {
    const rows = this.load()[name];
    if (!rows) throw new Error(`Unknown table "${name}"`);
    return rows;
  }

  all<T extends TableName>(name: T, predicate?: (row: Row<T>) => boolean): Row<T>[] {
    const rows = this.table(name) as Row<T>[];
    return predicate ? rows.filter(predicate) : rows.slice();
  }

  find<T extends TableName>(name: T, predicate: (row: Row<T>) => boolean): Row<T> | null {
    return (this.table(name) as Row<T>[]).find(predicate) || null;
  }

  byId<T extends TableName>(name: T, id: string | undefined | null): Row<T> | null {
    if (!id) return null;
    return this.find(name, (row) => (row as { id: string }).id === id);
  }

  insert<T extends TableName>(name: T, row: Row<T>): Row<T> {
    (this.table(name) as Row<T>[]).push(row);
    void this.flush();
    return row;
  }

  update<T extends TableName>(name: T, id: string, patch: Partial<Row<T>>): Row<T> | null {
    const rows = this.table(name) as Row<T>[];
    const index = rows.findIndex((row) => (row as { id: string }).id === id);
    if (index === -1) return null;
    rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() };
    void this.flush();
    return rows[index];
  }

  remove<T extends TableName>(name: T, id: string): boolean {
    const rows = this.table(name) as Row<T>[];
    const index = rows.findIndex((row) => (row as { id: string }).id === id);
    if (index === -1) return false;
    rows.splice(index, 1);
    void this.flush();
    return true;
  }

  replaceAll<T extends TableName>(name: T, rows: Database[T]): Database[T] {
    this.load()[name] = rows;
    void this.flush();
    return rows;
  }

  resetCache(): void {
    this.cache = null;
  }
}
