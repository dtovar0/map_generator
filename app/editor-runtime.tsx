"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Chart?: unknown;
    htmlToImage?: typeof import("html-to-image");
    jsPDF?: typeof import("jspdf").jsPDF;
  }
}

export default function EditorRuntime() {
  const [runtimeReady, setRuntimeReady] = useState(false);

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
      setRuntimeReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!runtimeReady) return null;

  return <Script src="/editor-runtime.js" strategy="afterInteractive" />;
}
