import { z } from "zod";

export const CORNERS = {
  bare: { name: "Новый дом", description: "Здесь начнётся ваша история." },
  reading: {
    name: "Уголок историй",
    description: "Лампа, книга и время друг для друга.",
  },
  meadow: { name: "Тихий сад", description: "Мягкий коврик и шорох листьев." },
} as const;
export const STORIES = {
  reading: {
    title: "Ещё одну страничку",
    text: "Он придвинулся к книге и положил лапу на страницу. Кажется, у этой истории теперь два читателя.",
    hint: "Угостите соседа и выберите «Уголок историй».",
    habit: "Любитель историй",
  },
  meadow: {
    title: "Можно просто быть рядом",
    text: "Листья тихо зашуршали. Маленький сосед устроился рядом — и ничего больше не нужно было делать.",
    hint: "Погладьте соседа и выберите «Тихий сад».",
    habit: "Ценитель тишины",
  },
} as const;
export type Corner = keyof typeof CORNERS;
export type Story = keyof typeof STORIES;
const timestamp = z.number().int().min(0).max(8.64e15);
const stat = z.number().min(0).max(100);
const dayList = z
  .array(z.number().int().nonnegative())
  .max(3)
  .refine((days) => days.every((day, i) => i === 0 || day > days[i - 1]));
const MemorySchema = z
  .object({
    id: z.enum(["reading", "meadow"]),
    name: z.string().trim().min(1).max(24),
    scarf: z.boolean(),
    at: timestamp,
  })
  .strict();
const LegacySchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    name: z.string().trim().min(1).max(24),
    corner: z.enum(["bare", "reading", "meadow"]),
    scarf: z.boolean(),
    reducedMotion: z.boolean(),
    stats: z
      .object({ fullness: stat, energy: stat, joy: stat, cleanliness: stat })
      .strict(),
    lastSeen: timestamp,
    hasFed: z.boolean(),
    hasPetted: z.boolean(),
    coins: z.number().int().nonnegative(),
    xp: z.number().int().nonnegative(),
    memories: z.array(MemorySchema).max(2),
    habits: z.object({ reading: dayList, meadow: dayList }).strict(),
  })
  .strict()
  .superRefine((state, ctx) => {
    if (new Set(state.memories.map((m) => m.id)).size !== state.memories.length)
      ctx.addIssue({ code: "custom", message: "Duplicate memory" });
    if (
      state.coins !== 120 + 20 * state.memories.length ||
      state.xp !== 20 * state.memories.length
    )
      ctx.addIssue({ code: "custom", message: "Inconsistent rewards" });
    for (const memory of state.memories) {
      if (
        memory.at > state.lastSeen ||
        (memory.id === "reading" ? !state.hasFed : !state.hasPetted)
      )
        ctx.addIssue({ code: "custom", message: "Invalid memory history" });
    }
    for (const id of ["reading", "meadow"] as const) {
      if (
        state.habits[id].length > 0 &&
        !state.memories.some((m) => m.id === id)
      )
        ctx.addIssue({ code: "custom", message: "Habit without experience" });
      if (state.habits[id].some((d) => d > gameDay(state.lastSeen)))
        ctx.addIssue({ code: "custom", message: "Future habit" });
    }
  });

const ArtworkSchema = z
  .object({
    motif: z.enum(["leaf", "star"]),
    color: z.enum(["sage", "clay"]),
    name: z.string().trim().min(1).max(24),
    at: timestamp,
  })
  .strict();
const WorkshopSchema = z
  .object({
    seat: z.enum(["none", "cushion", "stool"]),
    tool: z.enum(["none", "pencils", "stamps"]),
    draft: z
      .object({
        motif: z.enum(["leaf", "star"]).nullable(),
        color: z.enum(["sage", "clay"]).nullable(),
      })
      .strict()
      .nullable(),
    artwork: ArtworkSchema.nullable(),
  })
  .strict();
const emptyWorkshop = () => ({
  seat: "none",
  tool: "none",
  draft: null,
  artwork: null,
});
const StateSchema = LegacySchema.safeExtend({
  schemaVersion: z.literal(2),
  workshop: WorkshopSchema,
}).superRefine((state, ctx) => {
  if (
    state.workshop.draft &&
    (state.workshop.seat === "none" || state.workshop.tool === "none")
  )
    ctx.addIssue({ code: "custom", message: "Draft without workspace" });
  if (state.workshop.artwork && state.workshop.artwork.at > state.lastSeen)
    ctx.addIssue({ code: "custom", message: "Future artwork" });
});
export type Artwork = z.infer<typeof ArtworkSchema>;
export type Game = z.infer<typeof StateSchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type Command =
  | { type: "feed" | "pet" | "wash" | "rest" | "scarf" | "motion" }
  | { type: "name"; value: string }
  | { type: "corner"; value: Corner }
  | { type: "story"; value: Story }
  | { type: "seat"; value: "cushion" | "stool" }
  | { type: "tool"; value: "pencils" | "stamps" }
  | { type: "create" | "finish" | "cancel" }
  | { type: "motif"; value: "leaf" | "star" }
  | { type: "color"; value: "sage" | "clay" };

export const gameDay = (now: number) =>
  Math.max(0, Math.floor((now - 4 * 3600000) / 86400000));
export const level = (game: Game) => (game.xp >= 40 ? 2 : 1);
export const parseGame = (value: unknown): Game => {
  if (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 1
  ) {
    const legacy = LegacySchema.parse(value);
    return StateSchema.parse({
      ...legacy,
      schemaVersion: 2,
      workshop: emptyWorkshop(),
    });
  }
  return StateSchema.parse(value);
};
export const freshGame = (now: number): Game =>
  parseGame({
    schemaVersion: 1,
    revision: 0,
    name: "Мох",
    corner: "bare",
    scarf: false,
    reducedMotion: false,
    stats: { fullness: 65, energy: 80, joy: 70, cleanliness: 75 },
    lastSeen: now,
    hasFed: false,
    hasPetted: false,
    coins: 120,
    xp: 0,
    memories: [],
    habits: { reading: [], meadow: [] },
  });

export function advance(game: Game, now: number): Game {
  timestamp.parse(now);
  const hours = Math.min(24, Math.max(0, now - game.lastSeen) / 3600000);
  const decay = (v: number, rate: number) =>
    v < 20 ? v : Math.max(20, v - hours * rate);
  return {
    ...game,
    lastSeen: Math.max(game.lastSeen, now),
    stats: {
      fullness: decay(game.stats.fullness, 2),
      energy: decay(game.stats.energy, 1),
      joy: decay(game.stats.joy, 1),
      cleanliness: decay(game.stats.cleanliness, 0.5),
    },
  };
}

export function canStory(game: Game, story: Story): boolean {
  return (
    game.corner === story &&
    (story === "reading" ? game.hasFed : game.hasPetted)
  );
}

export function applyCommand(
  previous: Game,
  command: Command,
  now: number,
): { game: Game; message: string; story?: Story } {
  const game = structuredClone(advance(parseGame(previous), now));
  let message = "";
  let story: Story | undefined;
  const raise = (key: keyof Game["stats"], by: number) => {
    game.stats[key] = Math.min(100, game.stats[key] + by);
  };
  switch (command.type) {
    case "seat":
      game.workshop.seat = command.value;
      message = "Место готово. Оба варианта одинаково удобны.";
      break;
    case "tool":
      game.workshop.tool = command.value;
      message = "Материалы на месте. Можно творить вместе.";
      break;
    case "create":
      if (game.workshop.seat === "none" || game.workshop.tool === "none")
        throw new Error("Выберите место и материалы в мастерской.");
      if (game.workshop.draft)
        throw new Error("Сначала закончите или отложите текущий рисунок.");
      game.workshop.draft = { motif: null, color: null };
      message = "Сосед придерживает бумагу. Что нарисуем?";
      break;
    case "motif":
      if (!game.workshop.draft)
        throw new Error("Сначала возьмите чистый лист.");
      game.workshop.draft.motif = command.value;
      message = "Появился контур. Сосед следит за вашей рукой.";
      break;
    case "color":
      if (!game.workshop.draft?.motif)
        throw new Error("Сначала выберите рисунок.");
      game.workshop.draft.color = command.value;
      message = "Сосед добавил маленькую точку своей лапой.";
      break;
    case "cancel":
      game.workshop.draft = null;
      message = "Лист отложен. Готовая открытка осталась на месте.";
      break;
    case "finish": {
      const draft = game.workshop.draft;
      if (!draft?.motif || !draft.color)
        throw new Error("Выберите рисунок и цвет.");
      game.workshop.artwork = {
        motif: draft.motif,
        color: draft.color,
        name: game.name,
        at: game.lastSeen,
      };
      game.workshop.draft = null;
      message = "Ваша открытка теперь дома. Можно сделать новую в любое время.";
      break;
    }
    case "name":
      game.name = command.value.trim();
      message = `Теперь вашего соседа зовут ${game.name}.`;
      break;
    case "feed":
      if (game.stats.fullness >= 90)
        message = "Сосед уже сыт. Можно просто посидеть рядом.";
      else {
        raise("fullness", 25);
        game.hasFed = true;
        message = "Вкусно! Сосед довольно прикрыл глаза.";
      }
      break;
    case "pet":
      raise("joy", 10);
      game.hasPetted = true;
      message = "Он потянулся навстречу вашей ладони.";
      break;
    case "wash":
      raise("cleanliness", 35);
      message = "Чистые лапки — и можно снова исследовать дом.";
      break;
    case "rest":
      raise("energy", 15);
      message = "Небольшая передышка. Здесь можно никуда не спешить.";
      break;
    case "corner":
      game.corner = command.value;
      message = `Дома теперь ${CORNERS[command.value].name.toLowerCase()}.`;
      break;
    case "scarf":
      game.scarf = !game.scarf;
      message = game.scarf
        ? "Мягкий шарф очень ему идёт."
        : "Шарф аккуратно убран.";
      break;
    case "motion":
      game.reducedMotion = !game.reducedMotion;
      message = "Настройка движения сохранена.";
      break;
    case "story": {
      if (!canStory(game, command.value))
        throw new Error(STORIES[command.value].hint);
      story = command.value;
      const seen = game.memories.some((memory) => memory.id === story);
      if (!seen) {
        game.memories.push({
          id: story,
          name: game.name,
          scarf: game.scarf,
          at: game.lastSeen,
        });
        game.coins += 20;
        game.xp += 20;
      }
      const day = gameDay(now);
      const days = game.habits[story];
      if (days.length < 3 && (days.length === 0 || day > days[days.length - 1]))
        days.push(day);
      message = seen
        ? "Знакомый момент. Можно пережить его ещё раз."
        : "Воспоминание сохранено. +20 монет и +20 XP.";
      break;
    }
    default: {
      const neverCommand: never = command;
      throw new Error(`Unknown command: ${String(neverCommand)}`);
    }
  }
  return { game: parseGame(game), message, story };
}
