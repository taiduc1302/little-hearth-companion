import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "../src/App";
import { IndexedDbRepository } from "../src/persistence";
import { createGameStore } from "../src/store";

vi.mock("../src/Scene", () => ({ Scene: () => <div aria-label="Комната" /> }));

it("completes care → corner → scene → album and restores it on app remount", async () => {
  const repo = new IndexedDbRepository(`ui-${crypto.randomUUID()}`);
  const store = createGameStore(repo);
  const view = render(<App store={store} />);
  fireEvent.click(await screen.findByRole("button", { name: /Угостить/ }));
  await waitFor(() => expect(store.getState().game?.hasFed).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: /Обустроить уголок/ }));
  fireEvent.click(screen.getByRole("button", { name: /Уголок историй/ }));
  await waitFor(() => expect(store.getState().game?.corner).toBe("reading"));
  fireEvent.click(screen.getByRole("button", { name: /Вернуться к соседу/ }));
  fireEvent.click(screen.getByRole("button", { name: /Почитать вместе/ }));
  await waitFor(() =>
    expect(screen.getByTestId("coins").textContent).toBe("140"),
  );
  fireEvent.click(screen.getByRole("button", { name: /Открыть альбом/ }));
  expect(
    screen.getByRole("heading", { name: "Ещё одну страничку" }),
  ).toBeTruthy();
  view.unmount();
  const newStore = createGameStore(repo);
  render(<App store={newStore} />);
  await screen.findByRole("button", { name: /Пережить момент снова/ });
  fireEvent.click(
    screen.getByRole("button", { name: /Пережить момент снова/ }),
  );
  await waitFor(() => expect(newStore.getState().busy).toBe(false));
  expect(screen.getByTestId("coins").textContent).toBe("140");
  fireEvent.click(screen.getByRole("button", { name: /Альбом 1/ }));
  expect(
    screen.getByRole("heading", { name: "Ещё одну страничку" }),
  ).toBeTruthy();
  await repo.close();
});

it("shows an actionable failure without pretending care succeeded", async () => {
  const repo = new IndexedDbRepository(`ui-${crypto.randomUUID()}`);
  const store = createGameStore(repo);
  render(<App store={store} />);
  await screen.findByRole("button", { name: /Угостить/ });
  vi.spyOn(repo, "save").mockRejectedValueOnce(
    new Error("Хранилище заполнено"),
  );
  fireEvent.click(screen.getByRole("button", { name: /Угостить/ }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Хранилище заполнено",
  );
  expect(store.getState().game?.hasFed).toBe(false);
  expect(screen.getByText("Изменение не сохранено")).toBeTruthy();
  await repo.close();
});

it("keeps the draft available when finishing fails, then persists the result on retry", async () => {
  const repo = new IndexedDbRepository(`ui-workshop-${crypto.randomUUID()}`);
  const store = createGameStore(repo);
  render(<App store={store} />);
  fireEvent.click(await screen.findByRole("button", { name: "Мастерская" }));
  for (const label of [
    "Мягкая подушка",
    "Карандаши",
    "Взять чистый лист",
    "Лист",
    "Шалфей",
  ]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(store.getState().busy).toBe(false));
  }
  vi.spyOn(repo, "save").mockRejectedValueOnce(new Error("Диск заполнен"));
  fireEvent.click(
    screen.getByRole("button", {
      name: "Поставить открытку дома",
    }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Диск заполнен",
  );
  expect(store.getState().game?.workshop.artwork).toBeNull();
  expect(store.getState().game?.workshop.draft?.color).toBe("sage");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Поставить открытку дома",
    }),
  );
  await screen.findByRole("region", { name: "Готовая открытка" });
  expect(store.getState().game?.workshop.draft).toBeNull();
  expect((await repo.load(Date.now())).game.workshop.artwork?.motif).toBe(
    "leaf",
  );
  expect(screen.getByTestId("coins").textContent).toBe("120");
  await repo.close();
});
