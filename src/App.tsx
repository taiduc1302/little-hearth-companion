import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import {
  advance,
  canStory,
  CORNERS,
  level,
  STORIES,
  type Story,
} from "./domain";
import { Workshop, Postcard, Workbench } from "./Workshop";
import { Scene } from "./Scene";
import type { GameStore } from "./store";

export function App({ store }: { store: GameStore }) {
  const {
    game,
    busy,
    error,
    recovery,
    message,
    effect,
    effectId,
    story,
    dispatch,
    load,
    recover,
  } = useStore(store);
  const [tab, setTab] = useState<"home" | "corner" | "album" | "workshop">(
    "home",
  );
  const [name, setName] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [settings, setSettings] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (game) setName(game.name);
  }, [game?.name]);
  useEffect(() => {
    const refresh = () => setClock(Date.now());
    const interval = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    if (settings) dialog.current?.showModal();
    else dialog.current?.close();
  }, [settings]);
  if (!game)
    return (
      <main className="loading">
        <span className="brand-mark">✳</span>
        <h1>Тихолесье</h1>
        <p>
          {error
            ? "Не удалось открыть ваш дом. Сохранение не заменено."
            : "Открываем дверь в маленький дом…"}
        </p>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void load()} disabled={busy}>
              Попробовать снова
            </button>
          </>
        )}
      </main>
    );
  const shown = advance(game, Math.max(clock, game.lastSeen));
  const disabled = busy || recovery;
  const currentStory = game.corner === "bare" ? undefined : game.corner;
  const ready = currentStory && canStory(game, currentStory);
  const exportSave = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(game, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "little-hearth-save.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="shell">
      <header className="header">
        <a className="brand" href="#home" onClick={() => setTab("home")}>
          <span className="brand-mark">✳</span>
          <span>
            тихолесье<small>маленький сосед</small>
          </span>
        </a>
        <div className="header-right">
          <span className="chapter">ПЕРВАЯ ГЛАВА</span>
          <button
            className="icon-button"
            aria-label="Настройки"
            onClick={() => setSettings(true)}
          >
            ⚙
          </button>
        </div>
      </header>
      <main id="home">
        <div className="intro">
          <div>
            <p className="eyebrow">ВАШЕ МАЛЕНЬКОЕ МЕСТО</p>
            <h1>Дома хорошо.</h1>
            <p>Немного заботы. Немного тишины. И вы рядом.</p>
          </div>
          <div className="wallet">
            <span aria-hidden="true">✦</span>
            <strong data-testid="coins">{game.coins}</strong>
            <span>монет</span>
          </div>
        </div>
        {(error || recovery) && (
          <div className="notice" role="alert">
            <p>
              {error ??
                "Основное сохранение повреждено. Показана резервная копия. Продолжение возможно после восстановления."}
            </p>
            <button
              disabled={busy}
              onClick={() => void (recovery ? recover() : load())}
            >
              {recovery
                ? "Восстановить резерв"
                : "Загрузить последнее сохранение"}
            </button>
          </div>
        )}
        <div className="game-layout">
          <section className="home-card" aria-label="Дом питомца">
            <div className="room-title">
              <div>
                <span className="live-dot" />
                <strong>{game.name}</strong>
                <span className="level">Уровень {level(game)}</span>
              </div>
              <span className="save-status" role="status">
                {busy
                  ? "Сохраняем…"
                  : error
                    ? "Изменение не сохранено"
                    : recovery
                      ? "Резервная копия"
                      : "✓ Сохранено на устройстве"}
              </span>
            </div>
            <div className="room-wrap">
              <Scene
                game={game}
                effect={effect}
                effectId={effectId}
                story={story}
                onPet={() => void dispatch({ type: "pet" })}
              />
              {game.workshop.artwork && (
                <div className="displayed-art">
                  <Postcard {...game.workshop.artwork} />
                </div>
              )}
              {game.workshop.seat !== "none" && (
                <div className="workspace-props">
                  <Workbench
                    seat={game.workshop.seat}
                    tool={game.workshop.tool}
                  />
                </div>
              )}
              <div className="room-label">
                {CORNERS[game.corner].name}
                <span>Тихий день у леса</span>
              </div>
            </div>
            <div className="stats">
              {(
                [
                  ["fullness", "Сытость", "◒"],
                  ["energy", "Энергия", "☀"],
                  ["joy", "Радость", "♡"],
                  ["cleanliness", "Чистота", "✧"],
                ] as const
              ).map(([key, label, icon]) => (
                <div className="stat" key={key}>
                  <div>
                    <span>
                      {icon} {label}
                    </span>
                    <strong>{Math.round(shown.stats[key])}</strong>
                  </div>
                  <meter
                    min="0"
                    max="100"
                    value={shown.stats[key]}
                    aria-label={label}
                  />
                </div>
              ))}
            </div>
            <div className="actions">
              {(
                [
                  ["feed", "◒", "Угостить", "Бесплатно"],
                  ["pet", "♡", "Погладить", "Быть рядом"],
                  ["wash", "✧", "Умыть", "Чистые лапки"],
                  ["rest", "☾", "Передохнуть", "Без спешки"],
                ] as const
              ).map(([type, icon, label, help]) => (
                <button
                  key={type}
                  disabled={disabled}
                  onClick={() => void dispatch({ type })}
                >
                  <span>{icon}</span>
                  <strong>{label}</strong>
                  <small>{help}</small>
                </button>
              ))}
            </div>
            <p className="feedback" aria-live="polite" key={effectId}>
              {message}
            </p>
          </section>
          <aside className="journal" aria-label="Занятия и воспоминания">
            <nav className="tabs" aria-label="Ваш дом">
              <button
                aria-pressed={tab === "home"}
                onClick={() => setTab("home")}
              >
                Сегодня
              </button>
              <button
                aria-pressed={tab === "corner"}
                onClick={() => setTab("corner")}
              >
                Уголок
              </button>
              <button
                aria-pressed={tab === "album"}
                onClick={() => setTab("album")}
              >
                Альбом <span>{game.memories.length}</span>
              </button>
              <button
                aria-pressed={tab === "workshop"}
                onClick={() => setTab("workshop")}
              >
                Мастерская
              </button>
            </nav>
            {tab === "workshop" && (
              <>
                <p className="workshop-feedback" role="status">
                  {message}
                </p>
                <Workshop game={game} disabled={disabled} dispatch={dispatch} />
              </>
            )}
            {tab === "home" && (
              <div className="panel">
                <p className="eyebrow">МАЛЕНЬКИЕ ШАГИ</p>
                <h2>Обживаемся вместе</h2>
                <button className="primary" onClick={() => setTab("workshop")}>
                  {game.workshop.draft
                    ? "Продолжить открытку"
                    : "Создать открытку вместе"}
                </button>
                <p className="muted">
                  Здесь нет срочных дел. Выберите то, что хочется сейчас.
                </p>
                <ol className="steps">
                  <li className={game.hasFed ? "done" : ""}>
                    <span>{game.hasFed ? "✓" : "1"}</span>
                    <div>
                      <strong>Угостите соседа</strong>
                      <small>Тёплый приём начинается с заботы.</small>
                    </div>
                  </li>
                  <li className={game.corner !== "bare" ? "done" : ""}>
                    <span>{game.corner !== "bare" ? "✓" : "2"}</span>
                    <div>
                      <strong>Выберите свой уголок</strong>
                      <small>Книга или шорох листьев?</small>
                    </div>
                  </li>
                  <li className={game.memories.length > 0 ? "done" : ""}>
                    <span>{game.memories.length > 0 ? "✓" : "3"}</span>
                    <div>
                      <strong>Разделите маленький момент</strong>
                      <small>Он останется в вашем альбоме.</small>
                    </div>
                  </li>
                </ol>
                {!currentStory ? (
                  <button className="primary" onClick={() => setTab("corner")}>
                    Обустроить уголок <span>→</span>
                  </button>
                ) : (
                  <>
                    <div className="story-card">
                      <span className="story-symbol">
                        {currentStory === "reading" ? "▤" : "❋"}
                      </span>
                      <h3>{STORIES[currentStory].title}</h3>
                      <p>
                        {ready
                          ? CORNERS[currentStory].description
                          : STORIES[currentStory].hint}
                      </p>
                    </div>
                    <button
                      className="primary"
                      disabled={disabled || !ready}
                      onClick={() =>
                        void dispatch({ type: "story", value: currentStory })
                      }
                    >
                      {game.memories.some((m) => m.id === currentStory)
                        ? "Пережить момент снова"
                        : currentStory === "reading"
                          ? "Почитать вместе"
                          : "Посидеть вместе"}
                    </button>
                  </>
                )}
                {story && (
                  <div className="story-result" aria-live="polite">
                    <p className="eyebrow">ВАШ МОМЕНТ</p>
                    <h3>{STORIES[story].title}</h3>
                    <p>{STORIES[story].text}</p>
                    <button
                      className="text-button"
                      onClick={() => setTab("album")}
                    >
                      Открыть альбом →
                    </button>
                  </div>
                )}
                <div className="habit">
                  <p className="eyebrow">ПРИВЫЧКИ ПОЯВЛЯЮТСЯ НЕ СПЕША</p>
                  {(["reading", "meadow"] as Story[]).map((id) => (
                    <div key={id}>
                      <span>
                        {game.habits[id].length >= 3
                          ? STORIES[id].habit
                          : id === "reading"
                            ? "Интерес к историям"
                            : "Любовь к тишине"}
                      </span>
                      <small>{game.habits[id].length}/3 дней</small>
                    </div>
                  ))}
                  <p>
                    Повторите занятие в три разных дня. Пропуск ничего не
                    отнимает.
                  </p>
                </div>
              </div>
            )}
            {tab === "corner" && (
              <div className="panel">
                <p className="eyebrow">ДОМ С ВАШИМ ХАРАКТЕРОМ</p>
                <h2>Уют — в деталях</h2>
                <p className="muted">
                  Оба уголка и шарф уже ваши. Меняйте их сколько хочется.
                </p>
                {(["reading", "meadow"] as const).map((id) => (
                  <button
                    className={`corner-option ${game.corner === id ? "selected" : ""}`}
                    key={id}
                    aria-pressed={game.corner === id}
                    disabled={disabled}
                    onClick={() => void dispatch({ type: "corner", value: id })}
                  >
                    <span className={`swatch ${id}`}>
                      {id === "reading" ? "▤" : "❋"}
                    </span>
                    <span>
                      <strong>{CORNERS[id].name}</strong>
                      <small>{CORNERS[id].description}</small>
                    </span>
                    <span>{game.corner === id ? "✓" : "+"}</span>
                  </button>
                ))}
                <button
                  className="scarf-button"
                  disabled={disabled}
                  aria-pressed={game.scarf}
                  onClick={() => void dispatch({ type: "scarf" })}
                >
                  <span>Мягкий глиняный шарф</span>
                  <strong>{game.scarf ? "Снять" : "Надеть"}</strong>
                </button>
                <button className="primary" onClick={() => setTab("home")}>
                  Вернуться к соседу →
                </button>
                <p className="footnote">
                  Другой уголок — другое совместное занятие.
                </p>
              </div>
            )}
            {tab === "album" && (
              <div className="panel">
                <p className="eyebrow">ТО, ЧТО ОСТАНЕТСЯ С ВАМИ</p>
                <h2>Наши воспоминания</h2>
                <p className="muted">
                  {game.memories.length}/2 маленьких историй первой главы.
                </p>
                {game.memories.length === 0 && (
                  <div className="empty-album">
                    <span>▧</span>
                    <p>Первая страничка пока пуста.</p>
                    <small>
                      Позаботьтесь о соседе, выберите уголок и проведите время
                      вместе.
                    </small>
                  </div>
                )}
                {game.memories.map((memory) => (
                  <article className="memory" key={memory.id}>
                    <div className={`memory-picture ${memory.id}`}>
                      <img src="/assets/pet.svg" alt="" />
                      {memory.scarf && (
                        <img
                          className="memory-scarf"
                          src="/assets/scarf.svg"
                          alt=""
                        />
                      )}
                      <span>{memory.id === "reading" ? "▤" : "❋"}</span>
                    </div>
                    <time dateTime={new Date(memory.at).toISOString()}>
                      {new Date(memory.at).toLocaleDateString("ru", {
                        day: "numeric",
                        month: "long",
                      })}
                    </time>
                    <h3>{STORIES[memory.id].title}</h3>
                    <p>
                      {memory.name} · {CORNERS[memory.id].name}
                      {memory.scarf ? " · в шарфе" : ""}
                    </p>
                    <small>{STORIES[memory.id].text}</small>
                  </article>
                ))}
                <p className="footnote">
                  Повторяйте любимые моменты. Воспоминания не исчезают.
                </p>
              </div>
            )}
          </aside>
        </div>
        <footer>
          <span>Никуда не спешим. Вас здесь ждут.</span>
          <span>Прототип 0.2 · {game.xp} XP · без рекламы</span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        onCancel={() => setSettings(false)}
        onClose={() => setSettings(false)}
      >
        <div className="dialog-header">
          <h2>Ваш маленький дом</h2>
          <button
            className="icon-button"
            aria-label="Закрыть настройки"
            onClick={() => setSettings(false)}
          >
            ×
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void dispatch({ type: "name", value: name });
          }}
        >
          <label htmlFor="pet-name">Как зовут соседа?</label>
          <div className="name-form">
            <input
              id="pet-name"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <button disabled={disabled || !name.trim()}>Сохранить имя</button>
          </div>
        </form>
        <button
          className="setting-row"
          aria-pressed={game.reducedMotion}
          disabled={disabled}
          onClick={() => void dispatch({ type: "motion" })}
        >
          <span>Уменьшить движение</span>
          <strong>{game.reducedMotion ? "Включено" : "Выключено"}</strong>
        </button>
        <button className="setting-row" onClick={exportSave}>
          Скачать копию сохранения <span>↓</span>
        </button>
        <p className="muted">
          Дом хранится в этом браузере. Очистка данных браузера удалит прогресс.
          Копию можно сохранить в файл; загрузка файла в игру появится позже.
        </p>
        <p className="footnote">
          Привычки: новый день начинается в 04:00 UTC. Повторять занятия каждый
          день не обязательно.
        </p>
        <p className="feedback" aria-live="polite">
          {error ?? message}
        </p>
      </dialog>
    </div>
  );
}
