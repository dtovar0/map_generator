import { readFileSync } from "node:fs";
import path from "node:path";
import EditorRuntime from "./editor-runtime";

const editorMarkup = readFileSync(
  path.join(process.cwd(), "app", "editor-markup.html"),
  "utf8",
);

export default function HomePage() {
  return (
    <>
      <div
        id="map-editor-root"
        dangerouslySetInnerHTML={{ __html: editorMarkup }}
      />
      <EditorRuntime />
    </>
  );
}
