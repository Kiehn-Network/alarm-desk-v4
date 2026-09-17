import { useEffect, useState } from "react";

export type UiSize = "standard" | "large" | "xlarge";

const STORAGE_KEY = "alarmdesk:ui-size";

function readUiSize(): UiSize {
  if (typeof window === "undefined") return "standard";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "large" || saved === "xlarge") return saved;
  return "standard";
}

export function applyUiSizeToDom(size: UiSize) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ui-size", size);
}

export function useUiSize() {
  const [size, setSizeState] = useState<UiSize>(() => readUiSize());

  useEffect(() => {
    applyUiSizeToDom(size);
    localStorage.setItem(STORAGE_KEY, size);
  }, [size]);

  function setSize(nextSize: UiSize) {
    applyUiSizeToDom(nextSize);
    setSizeState(nextSize);
  }

  return { size, setSize };
}