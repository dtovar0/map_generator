"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    Chart?: unknown;
    htmlToImage?: typeof import("html-to-image");
    jsPDF?: typeof import("jspdf").jsPDF;
  }
}

// The editor runtime is split by concern across these classic scripts. They
// share one global scope and must run in this order (state/helpers first,
// immediate init last), so they are injected with async=false which guarantees
// in-order execution for dynamically inserted scripts.
const RUNTIME_PARTS = [
  "/editor/core.js",
  "/editor/history.js",
  "/editor/nodes.js",
  "/editor/links.js",
  "/editor/selection.js",
  "/editor/props.js",
  "/editor/ui.js",
  "/editor/maps.js",
  "/editor/tooltips.js",
  "/editor/auth.js",
  "/editor/users.js",
  "/editor/init.js",
];

export default function EditorRuntime() {
  useEffect(() => {
    let active = true;

    Promise.all([
      import("chart.js/auto"),
      import("html-to-image"),
      import("jspdf"),
    ]).then(([{ default: Chart }, htmlToImage, { jsPDF }]) => {
      if (!active) return;
      window.Chart = Chart;
      window.htmlToImage = htmlToImage;
      window.jsPDF = jsPDF;
      // Guard against double-injection (e.g. React strict-mode remount).
      if (document.querySelector('script[data-editor-runtime]')) return;
      // Cache-buster: /public assets get heuristic browser caching, which can
      // serve a stale mix of editor parts after a deploy. Always fetch fresh.
      const version = Date.now();
      for (const src of RUNTIME_PARTS) {
        const script = document.createElement("script");
        script.src = `${src}?v=${version}`;
        script.async = false; // preserve execution order
        script.dataset.editorRuntime = "";
        document.body.appendChild(script);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
