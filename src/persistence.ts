import { freshGame, parseGame, type Game } from "./domain";

export class SaveConflict extends Error {
  constructor() {
    super("Дом изменился в другой вкладке. Загрузите последнее сохранение.");
  }
}
export type Loaded = { game: Game; recovery: boolean };
export interface SaveRepository {
  load(now: number): Promise<Loaded>;
  save(game: Game, expectedRevision: number): Promise<Game>;
  recover(expectedRevision: number): Promise<Game>;
}
const newerVersion = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "schemaVersion" in value &&
  typeof value.schemaVersion === "number" &&
  value.schemaVersion > 2;

export class IndexedDbRepository implements SaveRepository {
  private connection?: Promise<IDBDatabase>;
  constructor(private name = "little-hearth-v1") {}
  private open(): Promise<IDBDatabase> {
    this.connection ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves");
      request.onerror = () => {
        this.connection = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        this.connection = undefined;
        reject(new Error("Закройте старую вкладку игры и повторите."));
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.connection = undefined;
        };
        resolve(request.result);
      };
    });
    return this.connection;
  }
  async load(now: number): Promise<Loaded> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      // A readwrite transaction makes first launch safe even across two tabs.
      const tx = db.transaction("saves", "readwrite");
      const store = tx.objectStore("saves");
      const current = store.get("current");
      const backup = store.get("backup");
      let result: Loaded;
      let failure: unknown;
      backup.onsuccess = () => {
        try {
          if (current.result === undefined && backup.result === undefined) {
            const game = freshGame(now);
            store.put(game, "current");
            result = { game, recovery: false };
          } else {
            if (newerVersion(current.result))
              throw new Error(
                "Сохранение создано новой версией. Оно не будет перезаписано.",
              );
            try {
              result = { game: parseGame(current.result), recovery: false };
            } catch {
              result = { game: parseGame(backup.result), recovery: true };
            }
          }
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          failure ?? tx.error ?? new Error("Не удалось открыть сохранение."),
        );
      tx.onerror = () => {
        /* onabort supplies the terminal result */
      };
    });
  }
  async save(game: Game, expectedRevision: number): Promise<Game> {
    parseGame(game);
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("saves", "readwrite");
      const store = tx.objectStore("saves");
      const current = store.get("current");
      let saved: Game;
      let failure: unknown;
      current.onsuccess = () => {
        try {
          const previous = parseGame(current.result);
          if (
            previous.revision !== expectedRevision ||
            game.revision !== expectedRevision
          )
            throw new SaveConflict();
          saved = parseGame({ ...game, revision: expectedRevision + 1 });
          store.put(previous, "backup");
          store.put(saved, "current");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(saved);
      tx.onabort = () =>
        reject(
          failure ??
            tx.error ??
            new Error("Не удалось сохранить. Изменение отменено."),
        );
      tx.onerror = () => {
        /* transaction abort is handled above */
      };
    });
  }
  async recover(expectedRevision: number): Promise<Game> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("saves", "readwrite");
      const store = tx.objectStore("saves");
      const current = store.get("current");
      const backup = store.get("backup");
      let restored: Game;
      let failure: unknown;
      backup.onsuccess = () => {
        try {
          if (newerVersion(current.result))
            throw new Error("Нужна новая версия приложения.");
          let valid = false;
          try {
            parseGame(current.result);
            valid = true;
          } catch {
            /* only invalid current can be recovered */
          }
          if (valid) throw new SaveConflict();
          const previous = parseGame(backup.result);
          if (previous.revision !== expectedRevision) throw new SaveConflict();
          restored = parseGame({
            ...previous,
            revision: previous.revision + 1,
          });
          if (current.result !== undefined)
            store.put(current.result, "quarantine");
          store.put(restored, "current");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(restored);
      tx.onabort = () =>
        reject(
          failure ?? tx.error ?? new Error("Не удалось восстановить резерв."),
        );
    });
  }
  async close(): Promise<void> {
    (await this.connection)?.close();
    this.connection = undefined;
  }
}
