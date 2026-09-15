import { describe, expect, it, vi } from "vitest";
import { applyCommand } from "../src/domain";
import { IndexedDbRepository, SaveConflict } from "../src/persistence";
import { createGameStore } from "../src/store";

const NOW = Date.UTC(2026, 8, 14, 12);
const unique = () => `test-${crypto.randomUUID()}`;
async function replace(name: string, key: string, value: unknown) {
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(name, 1);
    open.onsuccess = () => {
      const tx = open.result.transaction("saves", "readwrite");
      tx.objectStore("saves").put(value, key);
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
      tx.onabort = () => reject(tx.error);
    };
  });
}
describe("IndexedDB persistence and transactional store", () => {
  it("restores the complete state from a new repository and never duplicates a reward", async () => {
    const name = unique();
    const first = new IndexedDbRepository(name);
    const store = createGameStore(first, () => NOW);
    await store.getState().load();
    await store.getState().dispatch({ type: "feed" });
    await store.getState().dispatch({ type: "corner", value: "reading" });
    await store.getState().dispatch({ type: "story", value: "reading" });
    const saved = store.getState().game;
    await first.close();
    const second = new IndexedDbRepository(name);
    const reopened = createGameStore(second, () => NOW);
    await reopened.getState().load();
    expect(reopened.getState().game).toEqual(saved);
    await reopened.getState().dispatch({ type: "story", value: "reading" });
    expect(reopened.getState().game?.coins).toBe(140);
    expect(reopened.getState().game?.memories).toHaveLength(1);
    await second.close();
  });
  it("rejects stale writes from another tab rather than losing progress", async () => {
    const name = unique();
    const a = new IndexedDbRepository(name);
    const b = new IndexedDbRepository(name);
    const [one, two] = await Promise.all([a.load(NOW), b.load(NOW)]);
    await a.save(
      applyCommand(one.game, { type: "feed" }, NOW).game,
      one.game.revision,
    );
    await expect(
      b.save(
        applyCommand(two.game, { type: "pet" }, NOW).game,
        two.game.revision,
      ),
    ).rejects.toBeInstanceOf(SaveConflict);
    expect((await b.load(NOW)).game.hasFed).toBe(true);
    await a.close();
    await b.close();
  });
  it("preserves old state and suppresses success on a storage write failure", async () => {
    const repo = new IndexedDbRepository(unique());
    const store = createGameStore(repo, () => NOW);
    await store.getState().load();
    const before = structuredClone(store.getState().game);
    vi.spyOn(repo, "save").mockRejectedValueOnce(new Error("Quota exceeded"));
    await store.getState().dispatch({ type: "feed" });
    expect(store.getState().game).toEqual(before);
    expect(store.getState().error).toBe("Quota exceeded");
    expect((await repo.load(NOW)).game).toEqual(before);
    await repo.close();
  });
  it("blocks duplicate in-flight commands", async () => {
    const repo = new IndexedDbRepository(unique());
    const store = createGameStore(repo, () => NOW);
    await store.getState().load();
    await Promise.all([
      store.getState().dispatch({ type: "pet" }),
      store.getState().dispatch({ type: "pet" }),
    ]);
    expect(store.getState().game?.revision).toBe(1);
    await repo.close();
  });
  it("offers backup recovery without silently overwriting corruption", async () => {
    const name = unique();
    const repo = new IndexedDbRepository(name);
    const { game } = await repo.load(NOW);
    await repo.save(applyCommand(game, { type: "feed" }, NOW).game, 0);
    await replace(name, "current", { broken: true });
    const loaded = await repo.load(NOW);
    expect(loaded.recovery).toBe(true);
    expect(loaded.game).toEqual(game);
    const store = createGameStore(repo, () => NOW);
    await store.getState().load();
    await store.getState().dispatch({ type: "pet" });
    expect(store.getState().game?.revision).toBe(0);
    await store.getState().recover();
    expect(store.getState().recovery).toBe(false);
    expect((await repo.load(NOW)).recovery).toBe(false);
    await repo.close();
  });
  it("never overwrites a save from a newer app version with an old backup", async () => {
    const name = unique();
    const repo = new IndexedDbRepository(name);
    const { game } = await repo.load(NOW);
    await repo.save(applyCommand(game, { type: "pet" }, NOW).game, 0);
    await replace(name, "current", { ...game, schemaVersion: 3 });
    await expect(repo.load(NOW)).rejects.toThrow("новой версией");
    await expect(repo.recover(0)).rejects.toThrow("новая версия");
    await repo.close();
  });
  it("rejects corruption without a valid backup instead of creating a new pet", async () => {
    const name = unique();
    const repo = new IndexedDbRepository(name);
    await repo.load(NOW);
    await replace(name, "current", { invalid: true });
    await expect(repo.load(NOW)).rejects.toThrow();
    await repo.close();
  });
});

it("migrates legacy storage and commits format 2 without losing progress", async () => {
  const name = unique();
  const repo = new IndexedDbRepository(name);
  const { game } = await repo.load(NOW);
  const fed = applyCommand(game, { type: "feed" }, NOW).game;
  const { workshop: _workshop, ...old } = fed;
  await replace(name, "current", { ...old, schemaVersion: 1 });
  const migrated = await repo.load(NOW);
  expect(migrated.game.schemaVersion).toBe(2);
  expect(migrated.game.hasFed).toBe(true);
  const saved = await repo.save(
    applyCommand(migrated.game, { type: "seat", value: "stool" }, NOW).game,
    0,
  );
  expect(saved.revision).toBe(1);
  expect(saved.hasFed).toBe(true);
  expect((await repo.load(NOW)).game.workshop.seat).toBe("stool");
  await repo.close();
});
