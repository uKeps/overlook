// Bundled by the server on first use (/vendor/excalidraw.js, see server.ts): React + Excalidraw for the canvas sketch
// layer, and the Mermaid converter that turns an agent's `overlook draw` into shapes.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, convertToExcalidrawElements, restoreElements } from "@excalidraw/excalidraw";
export { restoreElements }; // fills in a hand-built element (the canvas's Alt quick ink)
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
export function mount(el, props) {
  const root = createRoot(el);
  root.render(createElement(Excalidraw, props));
  return () => root.unmount();
}
// Mermaid source -> Excalidraw elements (top-left at 0,0).
export async function fromMermaid(src) {
  const { elements } = await parseMermaidToExcalidraw(src, { themeVariables: { fontSize: "16px" } });
  return convertToExcalidrawElements(elements, { regenerateIds: true });
}
