import { describe, expect, it } from "vitest";
import {
  advance,
  applyCommand,
  freshGame,
  gameDay,
  parseGame,
  type Game,
} from "../src/domain";

const NOW = Date.UTC(2026, 8, 14, 12);
const DAY = 86400000;
const command = (
  game: Game,
  action: Parameters<typeof applyCommand>[1],
  now = NOW,
) => applyCommand(game, action, now).game;
function firstReading() {
  return command(
    command(command(freshGame(NOW), { type: "feed" }), {
      type: "corner",
      value: "reading",
    }),
    { type: "story", value: "reading" },
  );
}
describe("meaningful actions and time", () => {
  it("requires both care and the right corner", () => {
    const fresh = freshGame(NOW);
    expect(() => command(fresh, { type: "story", value: "reading" })).toThrow();
    expect(() =>
      command(command(fresh, { type: "corner", value: "reading" }), {
        type: "story",
        value: "reading",
      }),
    ).toThrow();
    expect(() =>
      command(command(fresh, { type: "feed" }), {
        type: "story",
        value: "reading",
      }),
    ).toThrow();
  });
  it("persists one first reward, including on a later day", () => {
    const first = firstReading();
    const repeated = command(
      first,
      { type: "story", value: "reading" },
      NOW + DAY,
    );
    expect(first.coins).toBe(140);
    expect(repeated.coins).toBe(140);
    expect(repeated.xp).toBe(20);
    expect(repeated.memories).toEqual(first.memories);
  });
  it("records immutable appearance and name", () => {
    const old = firstReading();
    const changed = command(command(old, { type: "name", value: "  Ива  " }), {
      type: "scarf",
    });
    expect(changed.name).toBe("Ива");
    expect(changed.memories[0].name).toBe("Мох");
    expect(changed.scarf).toBe(true);
    expect(changed.memories[0].scarf).toBe(false);
  });
  it("does not farm habits by repeating in one day", () => {
    let game = firstReading();
    for (let i = 0; i < 10; i++)
      game = command(game, { type: "story", value: "reading" });
    expect(game.habits.reading).toHaveLength(1);
    game = command(game, { type: "story", value: "reading" }, NOW + 3 * DAY);
    game = command(game, { type: "story", value: "reading" }, NOW + 30 * DAY);
    expect(game.habits.reading).toHaveLength(3);
    expect(game.coins).toBe(140);
  });
  it("does not roll habit dates back when device time goes backwards", () => {
    const game = command(
      firstReading(),
      { type: "story", value: "reading" },
      NOW + 5 * DAY,
    );
    const back = command(game, { type: "story", value: "reading" }, NOW + DAY);
    expect(back.habits).toEqual(game.habits);
    expect(back.lastSeen).toBe(game.lastSeen);
  });
  it("uses the documented 04:00 UTC boundary", () => {
    expect(gameDay(Date.UTC(2026, 8, 15, 3, 59, 59))).toBe(gameDay(NOW));
    expect(gameDay(Date.UTC(2026, 8, 15, 4))).toBe(gameDay(NOW) + 1);
  });
  it("caps offline decay without losing memories or availability", () => {
    const old = firstReading();
    const absent = advance(old, NOW + 100 * DAY);
    expect(absent.stats).toEqual({
      fullness: 42,
      energy: 56,
      joy: 46,
      cleanliness: 63,
    });
    expect(absent.memories).toEqual(old.memories);
    expect(
      command(absent, { type: "story", value: "reading" }, NOW + 100 * DAY)
        .coins,
    ).toBe(140);
    expect(advance(freshGame(NOW), NOW + 8 * 3600000).stats).toEqual({
      fullness: 49,
      energy: 72,
      joy: 62,
      cleanliness: 71,
    });
  });
  it("never creates rewards by spamming free care or exceeding stat caps", () => {
    let game = freshGame(NOW);
    for (let i = 0; i < 20; i++)
      for (const type of ["feed", "pet", "wash", "rest"] as const)
        game = command(game, { type });
    expect(game.stats).toEqual({
      fullness: 90,
      energy: 100,
      joy: 100,
      cleanliness: 100,
    });
    expect(game.coins).toBe(120);
    expect(game.xp).toBe(0);
  });
  it("both moments are possible without an account, deadline or payment", () => {
    let game = command(firstReading(), { type: "pet" });
    game = command(game, { type: "corner", value: "meadow" });
    game = command(game, { type: "story", value: "meadow" }, NOW + 365 * DAY);
    expect(game.memories).toHaveLength(2);
    expect(game.coins).toBe(160);
    expect(game.xp).toBe(40);
  });
  it.each([
    { coins: -1 },
    { xp: Infinity },
    { coins: 999 },
    { schemaVersion: 3 },
    { name: " " },
    { name: "a".repeat(25) },
    { lastSeen: NaN },
    { memories: [{ id: "reading", name: "Мох", at: NOW, scarf: false }] },
    { habits: { reading: [gameDay(NOW)], meadow: [] } },
  ])("rejects invalid save fields %j", (invalid) => {
    expect(() => parseGame({ ...freshGame(NOW), ...invalid })).toThrow();
  });
  it("rejects duplicate memory IDs even if rewards appear consistent", () => {
    const game = firstReading();
    expect(() =>
      parseGame({
        ...game,
        memories: [...game.memories, ...game.memories],
        coins: 160,
        xp: 40,
      }),
    ).toThrow();
  });
  it("does not mutate the input state", () => {
    const game = freshGame(NOW);
    const snapshot = structuredClone(game);
    command(game, { type: "feed" });
    expect(game).toEqual(snapshot);
  });
});
