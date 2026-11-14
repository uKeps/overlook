// Bundled by the server on first use (/vendor/excalidraw.js, see server.ts): React + Excalidraw for drawing cards.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw } from "@excalidraw/excalidraw";
export function mount(el, props) {
  const root = createRoot(el);
  root.render(createElement(Excalidraw, props));
  return () => root.unmount();
}
