import { createStore } from "zustand/vanilla";
import { applyCommand, type Command, type Game, type Story } from "./domain";
import type { SaveRepository } from "./persistence";

type Store = {
  game?: Game;
  busy: boolean;
  error?: string;
  recovery: boolean;
  message: string;
  effect?: string;
  story?: Story;
  effectId: number;
  load: () => Promise<void>;
  dispatch: (command: Command) => Promise<void>;
  recover: () => Promise<void>;
};
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Сохранение недоступно. Попробуйте ещё раз.";
export function createGameStore(
  repository: SaveRepository,
  now = () => Date.now(),
) {
  return createStore<Store>((set, get) => ({
    busy: false,
    recovery: false,
    message: "Здесь вам всегда рады.",
    effectId: 0,
    load: async () => {
      if (get().busy) return;
      set({ busy: true, error: undefined });
      try {
        const loaded = await repository.load(now());
        set({
          ...loaded,
          story: undefined,
          effect: undefined,
          message: loaded.recovery
            ? "Найден резерв. Для продолжения подтвердите восстановление."
            : "Ваш маленький дом на месте.",
        });
      } catch (error) {
        set({ error: errorText(error) });
      } finally {
        set({ busy: false });
      }
    },
    dispatch: async (command) => {
      const { game, busy, recovery } = get();
      if (!game || busy || recovery) return;
      set({ busy: true, error: undefined });
      try {
        const result = applyCommand(game, command, now());
        // Publish the result only AFTER atomic persistence has completed.
        const saved = await repository.save(result.game, game.revision);
        set({
          game: saved,
          message: result.message,
          story: result.story,
          effect: command.type,
          effectId: get().effectId + 1,
        });
      } catch (error) {
        set({ error: errorText(error) });
      } finally {
        set({ busy: false });
      }
    },
    recover: async () => {
      const { game, busy, recovery } = get();
      if (!game || busy || !recovery) return;
      set({ busy: true, error: undefined });
      try {
        const restored = await repository.recover(game.revision);
        set({
          game: restored,
          recovery: false,
          message: "Предыдущее сохранение восстановлено.",
        });
      } catch (error) {
        set({ error: errorText(error) });
      } finally {
        set({ busy: false });
      }
    },
  }));
}
export type GameStore = ReturnType<typeof createGameStore>;
