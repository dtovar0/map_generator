import { readFileSync } from "node:fs";
import path from "node:path";
import EditorRuntime from "./editor-runtime";

export default function HomePage() {
  // Read per request (not at module scope): the page renders dynamically, so
  // edits to editor-markup.html apply without recompiling/restarting Next.
  const editorMarkup = readFileSync(
    path.join(process.cwd(), "app", "editor-markup.html"),
    "utf8",
  );
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
