import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const QUICK_CAPTURE_OPEN_EVENT = "quick-capture:open";

export function useQuickCaptureShortcut(onOpen: () => void): void {
  useEffect(() => {
    if (typeof window === "undefined" || !isTauri()) return;

    let disposed = false;
    let unlisten: (() => void) | null = null;

    const registerListener = async () => {
      try {
        const detach = await listen(QUICK_CAPTURE_OPEN_EVENT, () => {
          onOpen();
        });

        if (disposed) {
          detach();
          return;
        }

        unlisten = detach;
      } catch {
        // Ignore runtimes where backend event bridge is unavailable.
      }
    };

    void registerListener();

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    };
  }, [onOpen]);
}
