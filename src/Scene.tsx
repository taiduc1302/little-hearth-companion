import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Sprite } from "pixi.js";
import type { Game, Story } from "./domain";

type Props = {
  game: Game;
  effect?: string;
  effectId: number;
  story?: Story;
  onPet: () => void;
};
export function Scene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    live.current = props;
  });
  useEffect(() => {
    let disposed = false;
    let initialized = false;
    const app = new Application();
    const pause = () => {
      if (initialized) {
        if (document.hidden) app.stop();
        else app.start();
      }
    };
    void (async () => {
      try {
        await app.init({
          width: 1000,
          height: 680,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: "webgl",
        });
        initialized = true;
        if (disposed) {
          app.destroy(true);
          return;
        }
        const [roomTexture, petTexture, scarfTexture] = await Promise.all([
          Assets.load("/assets/room.svg"),
          Assets.load("/assets/pet.svg"),
          Assets.load("/assets/scarf.svg"),
        ]);
        if (disposed) return;
        host.current?.appendChild(app.canvas);
        app.canvas.setAttribute("aria-hidden", "true");
        const room = new Sprite(roomTexture);
        room.width = 1000;
        room.height = 680;
        app.stage.addChild(room);
        const decor = new Graphics();
        app.stage.addChild(decor);
        const shadow = new Graphics()
          .ellipse(500, 541, 97, 20)
          .fill({ color: 0x75644c, alpha: 0.18 });
        app.stage.addChild(shadow);
        const neighbor = new Container();
        neighbor.position.set(500, 480);
        const pet = new Sprite(petTexture);
        pet.anchor.set(0.5, 0.7);
        pet.scale.set(0.86);
        const scarf = new Sprite(scarfTexture);
        scarf.anchor.copyFrom(pet.anchor);
        scarf.scale.copyFrom(pet.scale);
        neighbor.addChild(pet, scarf);
        app.stage.addChild(neighbor);
        neighbor.eventMode = "static";
        neighbor.cursor = "pointer";
        neighbor.on("pointertap", () => live.current.onPet());
        const sparkles = new Graphics();
        app.stage.addChild(sparkles);
        let oldCorner = "";
        let observedEffect = -1;
        let reaction = 0;
        let elapsed = 0;
        app.ticker.add((ticker) => {
          const { game, effect, effectId, story } = live.current;
          const reduced =
            game.reducedMotion ||
            (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
              false);
          elapsed += ticker.deltaMS / 1000;
          if (effectId !== observedEffect) {
            observedEffect = effectId;
            reaction = 2.7;
          }
          reaction = Math.max(0, reaction - ticker.deltaMS / 1000);
          if (oldCorner !== game.corner) {
            oldCorner = game.corner;
            decor.clear();
            const reading = game.corner === "reading";
            decor
              .ellipse(497, 538, 230, 76)
              .fill(
                game.corner === "bare"
                  ? 0xc6b18f
                  : reading
                    ? 0xbc8d72
                    : 0x92a58a,
              );
            decor
              .ellipse(497, 538, 211, 62)
              .stroke({ color: 0xf2dfb7, width: 3, alpha: 0.5 });
            if (reading) {
              decor.roundRect(221, 411, 121, 19, 8).fill(0x967753);
              decor.rect(236, 426, 9, 82).rect(320, 426, 9, 82).fill(0x856947);
              decor.rect(274, 284, 8, 130).fill(0x9b8156);
              decor
                .poly([242, 300, 253, 245, 304, 245, 320, 300])
                .fill(0xe5ba77);
              decor.ellipse(279, 300, 40, 8).fill(0xf4d493);
              decor.roundRect(613, 494, 83, 16, 3).fill(0x5a7d71);
              decor.roundRect(620, 489, 69, 10, 2).fill(0xf3e5c2);
              decor
                .moveTo(654, 488)
                .lineTo(654, 502)
                .stroke({ width: 2, color: 0xbba781 });
            } else if (game.corner === "meadow") {
              decor.ellipse(302, 455, 67, 32).fill(0xdec5a4);
              decor.ellipse(302, 448, 65, 29).fill(0xe7d5b5);
              decor.roundRect(638, 475, 84, 47, 12).fill(0xbc926d);
              decor.ellipse(681, 474, 44, 13).fill(0xa87953);
              for (let i = 0; i < 5; i++) {
                decor
                  .ellipse(654 + i * 13, 454 - Math.sin(i) * 19, 12, 26)
                  .fill(i % 2 ? 0x879c72 : 0xa6b587);
              }
            }
          }
          scarf.visible = game.scarf;
          const readingHabit = game.habits.reading.length >= 3;
          const quietHabit = game.habits.meadow.length >= 3;
          const active = reaction > 0;
          neighbor.y =
            480 +
            (reduced
              ? 0
              : Math.sin(elapsed * (active ? 7 : quietHabit ? 1.2 : 2)) *
                (active ? 5 : 2));
          neighbor.rotation = reduced
            ? 0
            : active && effect === "pet"
              ? Math.sin(elapsed * 8) * 0.05
              : readingHabit && game.corner === "reading"
                ? -0.03
                : 0;
          sparkles.clear();
          if (active) {
            const color =
              effect === "wash"
                ? 0xe4f3e9
                : effect === "feed"
                  ? 0xeab579
                  : 0xf3e3a3;
            for (let i = 0; i < 5; i++) {
              const x = 360 + i * 64;
              const y =
                250 +
                Math.sin(i * 2) * 25 -
                (reduced ? 0 : (2.7 - reaction) * 17);
              sparkles
                .circle(x, y, effect === "wash" ? 7 : 3 + (i % 3))
                .fill({ color, alpha: Math.min(1, reaction) });
            }
            if (effect === "story" && story === "reading") {
              sparkles
                .poly([
                  452, 448, 489, 455, 526, 448, 526, 482, 489, 490, 452, 482,
                ])
                .fill(0xf8e9c8);
              sparkles
                .moveTo(489, 456)
                .lineTo(489, 486)
                .stroke({ color: 0x9d9478, width: 2 });
            }
          }
        });
        document.addEventListener("visibilitychange", pause);
        pause();
      } catch {
        if (!disposed) setFallback(true);
      }
    })();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", pause);
      if (initialized) app.destroy(true, { children: true, texture: false });
    };
  }, []);
  return (
    <div
      className="scene"
      ref={host}
      data-testid="room-scene"
      role="img"
      aria-label={`Комната питомца ${props.game.name}. ${props.game.corner === "reading" ? "Уголок с книгой и лампой." : props.game.corner === "meadow" ? "Уголок с растениями и ковриком." : "Уютная комната у леса."}`}
    >
      {fallback && (
        <div className="fallback-scene">
          <img src="/assets/room.svg" alt="" />
          <img className="fallback-pet" src="/assets/pet.svg" alt="" />
          <span>Упрощённый вид · все действия доступны ниже</span>
        </div>
      )}
    </div>
  );
}
