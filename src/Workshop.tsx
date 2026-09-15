import type { Artwork, Command, Game } from "./domain";

export function Postcard({
  motif,
  color,
}: {
  motif: "leaf" | "star" | null;
  color: "sage" | "clay" | null;
}) {
  return (
    <svg
      viewBox="0 0 240 160"
      role="img"
      aria-label={`Открытка: ${motif === "leaf" ? "лист" : motif === "star" ? "звезда" : "чистый лист"}, ${color === "sage" ? "шалфей" : color === "clay" ? "глина" : "без цвета"}`}
    >
      <rect
        x="3"
        y="3"
        width="234"
        height="154"
        rx="12"
        fill="#fff6df"
        stroke="#b5a582"
        strokeWidth="3"
      />
      <path d="M19 22H61M180 138H220" stroke="#c9b998" strokeWidth="3" />
      <g
        fill={
          color === "sage" ? "#789877" : color === "clay" ? "#bd795e" : "none"
        }
        stroke="#647462"
        strokeWidth="3"
      >
        {motif === "leaf" && (
          <>
            <path d="M83 113Q58 42 155 32Q175 116 83 113Z" />
            <path d="M79 123L146 44M103 94L102 67M117 79L142 79" fill="none" />
          </>
        )}
        {motif === "star" && (
          <path d="M120 28L137 62L175 68L147 96L154 134L120 115L86 134L93 96L65 68L103 62Z" />
        )}
      </g>
      {color && (
        <g fill="#bc926d">
          <ellipse cx="201" cy="116" rx="8" ry="6" />
          <circle cx="190" cy="107" r="3" />
          <circle cx="200" cy="104" r="3" />
          <circle cx="209" cy="108" r="3" />
        </g>
      )}
    </svg>
  );
}
export function ArtworkLabel({ artwork }: { artwork: Artwork }) {
  return (
    <p>
      Авторы: {artwork.name} и вы ·{" "}
      {new Date(artwork.at).toLocaleDateString("ru")}
    </p>
  );
}
export function Workshop({
  game,
  disabled,
  dispatch,
}: {
  game: Game;
  disabled: boolean;
  dispatch: (command: Command) => Promise<void>;
}) {
  const w = game.workshop;
  return (
    <div className="panel workshop">
      <p className="eyebrow">ВЕЩЬ, КОТОРУЮ ВЫ СОЗДАЛИ</p>
      <h2>Мастерская открыток</h2>
      <p>
        Устройтесь рядом. Выберите рисунок и цвет — сосед оставит на бумаге след
        лапки.
      </p>
      <fieldset disabled={disabled}>
        <legend>1. Где устроимся?</legend>
        <div className="choices">
          {(
            [
              ["cushion", "Мягкая подушка"],
              ["stool", "Деревянный табурет"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={w.seat === value}
              onClick={() => void dispatch({ type: "seat", value })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>2. Чем рисуем?</legend>
        <div className="choices">
          {(
            [
              ["pencils", "Карандаши"],
              ["stamps", "Штампы"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={w.tool === value}
              onClick={() => void dispatch({ type: "tool", value })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="muted">
        Все материалы бесплатны. Любая пара подходит для обоих рисунков.
      </p>
      {!w.draft ? (
        <>
          <button
            className="primary"
            disabled={disabled || w.seat === "none" || w.tool === "none"}
            onClick={() => void dispatch({ type: "create" })}
          >
            Взять чистый лист
          </button>
          {(w.seat === "none" || w.tool === "none") && (
            <p>Сначала выберите место и материалы.</p>
          )}
        </>
      ) : (
        <section aria-label="Текущая открытка">
          <Postcard {...w.draft} />
          <fieldset disabled={disabled}>
            <legend>3. Что нарисуем?</legend>
            <div className="choices">
              <button
                aria-pressed={w.draft.motif === "leaf"}
                onClick={() => void dispatch({ type: "motif", value: "leaf" })}
              >
                Лист
              </button>
              <button
                aria-pressed={w.draft.motif === "star"}
                onClick={() => void dispatch({ type: "motif", value: "star" })}
              >
                Звезда
              </button>
            </div>
          </fieldset>
          <fieldset disabled={disabled || !w.draft.motif}>
            <legend>4. Добавим цвет</legend>
            <div className="choices">
              <button
                aria-pressed={w.draft.color === "sage"}
                onClick={() => void dispatch({ type: "color", value: "sage" })}
              >
                Шалфей
              </button>
              <button
                aria-pressed={w.draft.color === "clay"}
                onClick={() => void dispatch({ type: "color", value: "clay" })}
              >
                Глина
              </button>
            </div>
          </fieldset>
          <p>Черновик сохраняется после каждого шага.</p>
          <button
            className="primary"
            disabled={disabled || !w.draft.motif || !w.draft.color}
            onClick={() => void dispatch({ type: "finish" })}
          >
            Поставить открытку дома
          </button>
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => void dispatch({ type: "cancel" })}
          >
            Отложить этот лист
          </button>
        </section>
      )}
      {w.artwork && (
        <section aria-label="Готовая открытка">
          <h3>На вашей выставке</h3>
          <Postcard {...w.artwork} />
          <ArtworkLabel artwork={w.artwork} />
        </section>
      )}
      <p className="footnote">
        Дома выставлена одна работа. Новая готовая открытка заменит прежнюю. За
        повторы нет монет или XP — только ваши идеи.
      </p>
    </div>
  );
}

export function Workbench({
  seat,
  tool,
}: {
  seat: Game["workshop"]["seat"];
  tool: Game["workshop"]["tool"];
}) {
  return (
    <svg
      viewBox="0 0 250 170"
      role="img"
      aria-label={`Мастерская: ${seat === "cushion" ? "подушка" : "табурет"}, ${tool === "pencils" ? "карандаши" : tool === "stamps" ? "штампы" : "без материалов"}`}
    >
      <ellipse
        cx="140"
        cy="145"
        rx="103"
        ry="16"
        fill="#806c51"
        opacity=".13"
      />
      <path
        d="M106 91L99 142M214 89L223 140"
        stroke="#886446"
        strokeWidth="12"
      />
      <path
        d="M92 76L190 61L237 87L135 107Z"
        fill="#c69b6d"
        stroke="#94734f"
        strokeWidth="4"
      />
      <path d="M119 79L163 71L196 88L151 98Z" fill="#f5e7c8" />
      {seat === "cushion" ? (
        <>
          <ellipse cx="56" cy="135" rx="42" ry="22" fill="#829570" />
          <ellipse cx="56" cy="128" rx="41" ry="20" fill="#b9c69d" />
          <path
            d="M29 129Q55 142 82 128"
            fill="none"
            stroke="#94a27e"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path
            d="M31 110L27 147M74 107L80 146"
            stroke="#886446"
            strokeWidth="8"
          />
          <ellipse
            cx="54"
            cy="106"
            rx="36"
            ry="16"
            fill="#ba9367"
            stroke="#94734f"
            strokeWidth="3"
          />
        </>
      )}
      {tool === "pencils" && (
        <>
          <path
            d="M196 65L191 32M204 64L211 28M199 64L202 23"
            stroke="#638777"
            strokeWidth="5"
          />
          <path d="M186 48H216L212 74Q201 82 190 74Z" fill="#bb795e" />
        </>
      )}
      {tool === "stamps" && (
        <>
          <path d="M196 70V49" stroke="#886446" strokeWidth="8" />
          <ellipse cx="196" cy="46" rx="12" ry="8" fill="#8caa8b" />
          <rect x="179" y="66" width="34" height="10" rx="3" fill="#997655" />
          <rect x="156" y="62" width="20" height="10" rx="3" fill="#7d9072" />
        </>
      )}
    </svg>
  );
}
