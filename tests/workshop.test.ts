import { describe, it, expect } from "vitest";
import {
  freshGame,
  applyCommand,
  parseGame,
  type Game,
  type Command,
} from "../src/domain";
import { IndexedDbRepository } from "../src/persistence";
import { createGameStore } from "../src/store";
const NOW = Date.UTC(2026, 8, 15, 12);
const step = (g: Game, command: Command) => applyCommand(g, command, NOW).game;
function prepared(
  seat: "cushion" | "stool" = "cushion",
  tool: "pencils" | "stamps" = "pencils",
) {
  return step(step(freshGame(NOW), { type: "seat", value: seat }), {
    type: "tool",
    value: tool,
  });
}
describe("workshop", () => {
  it.each([
    ["cushion", "pencils"],
    ["cushion", "stamps"],
    ["stool", "pencils"],
    ["stool", "stamps"],
  ] as const)("supports %s and %s without currency", (seat, tool) => {
    let g = step(prepared(seat, tool), { type: "create" });
    g = step(g, { type: "motif", value: "star" });
    g = step(g, { type: "color", value: "clay" });
    g = step(g, { type: "finish" });
    expect(g.workshop.artwork).toMatchObject({
      motif: "star",
      color: "clay",
      name: "Мох",
    });
    expect(g.coins).toBe(120);
    expect(g.xp).toBe(0);
    expect(g.workshop.draft).toBeNull();
    expect(() => step(g, { type: "finish" })).toThrow();
  });
  it("rejects out of order actions and preserves in-progress draft", () => {
    expect(() => step(freshGame(NOW), { type: "create" })).toThrow();
    let g = step(prepared(), { type: "create" });
    expect(() => step(g, { type: "color", value: "sage" })).toThrow();
    expect(() => step(g, { type: "finish" })).toThrow();
    expect(() => step(g, { type: "create" })).toThrow();
    g = step(g, { type: "motif", value: "leaf" });
    expect(
      step(g, { type: "tool", value: "stamps" }).workshop.draft?.motif,
    ).toBe("leaf");
  });
  it("preserves artwork identity after renaming and cancellation", () => {
    let g = step(prepared(), { type: "create" });
    g = step(
      step(step(g, { type: "motif", value: "leaf" }), {
        type: "color",
        value: "sage",
      }),
      { type: "finish" },
    );
    const art = g.workshop.artwork;
    g = step(
      step(step(g, { type: "name", value: "Лис" }), { type: "create" }),
      { type: "cancel" },
    );
    expect(g.workshop.artwork).toEqual(art);
  });
  it("migrates a strict v1 save without changing progress; rejects corrupt data", () => {
    const { workshop: _workshop, ...old } = freshGame(NOW);
    const migrated = parseGame({ ...old, schemaVersion: 1 });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.coins).toBe(old.coins);
    expect(migrated.workshop.draft).toBeNull();
    expect(() => parseGame({ ...old, schemaVersion: 1, coins: 999 })).toThrow();
    expect(() =>
      parseGame({
        ...migrated,
        workshop: {
          ...migrated.workshop,
          draft: { motif: "leaf", color: null },
        },
      }),
    ).toThrow();
  });
  it("restores a partial draft in another repository and saves finished work", async () => {
    const name = `workshop-${crypto.randomUUID()}`;
    const repo = new IndexedDbRepository(name);
    const store = createGameStore(repo, () => NOW);
    await store.getState().load();
    for (const command of [
      { type: "seat", value: "stool" },
      { type: "tool", value: "stamps" },
      { type: "create" },
      { type: "motif", value: "leaf" },
    ] as Command[])
      await store.getState().dispatch(command);
    await repo.close();
    const second = new IndexedDbRepository(name);
    const reloaded = createGameStore(second, () => NOW);
    await reloaded.getState().load();
    expect(reloaded.getState().game?.workshop.draft?.motif).toBe("leaf");
    await reloaded.getState().dispatch({ type: "color", value: "sage" });
    await reloaded.getState().dispatch({ type: "finish" });
    const saved = await second.load(NOW);
    expect(saved.game.workshop.artwork?.color).toBe("sage");
    expect(saved.game.coins).toBe(120);
    await second.close();
  });
});
