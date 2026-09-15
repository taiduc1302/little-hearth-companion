import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createGameStore } from "./store";
import { IndexedDbRepository } from "./persistence";
import "./style.css";

const store = createGameStore(new IndexedDbRepository());
createRoot(document.getElementById("root")!).render(<App store={store} />);
