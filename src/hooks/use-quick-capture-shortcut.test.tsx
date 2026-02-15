import { renderHook } from "@testing-library/react";
import { useQuickCaptureShortcut } from "@/hooks/use-quick-capture-shortcut";

const isTauriMock = vi.fn();
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

describe("useQuickCaptureShortcut", () => {
  beforeEach(() => {
    isTauriMock.mockReset();
    listenMock.mockReset();
  });

  it("does nothing when runtime is not tauri", () => {
    isTauriMock.mockReturnValue(false);
    const onOpen = vi.fn();

    renderHook(() => useQuickCaptureShortcut(onOpen));
    expect(listenMock).not.toHaveBeenCalled();
  });

  it("registers and handles quick capture event in tauri runtime", async () => {
    isTauriMock.mockReturnValue(true);
    const onOpen = vi.fn();
    const detachMock = vi.fn();
    let handlerRef: (() => void) | null = null;

    listenMock.mockImplementation(async (_eventName: string, handler: () => void) => {
      handlerRef = handler;
      return detachMock;
    });

    const { unmount } = renderHook(() => useQuickCaptureShortcut(onOpen));
    await Promise.resolve();

    expect(listenMock).toHaveBeenCalledWith("quick-capture:open", expect.any(Function));
    expect(handlerRef).not.toBeNull();

    handlerRef?.();
    expect(onOpen).toHaveBeenCalledTimes(1);

    unmount();
    expect(detachMock).toHaveBeenCalledTimes(1);
  });

  it("ignores listener registration failures", async () => {
    isTauriMock.mockReturnValue(true);
    listenMock.mockRejectedValue(new Error("not available"));

    expect(() => renderHook(() => useQuickCaptureShortcut(vi.fn()))).not.toThrow();
    await Promise.resolve();
  });

  it("detaches listener when unmounted before register promise resolves", async () => {
    isTauriMock.mockReturnValue(true);

    let resolveListen: ((detach: () => void) => void) | null = null;
    listenMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveListen = resolve;
        }),
    );

    const { unmount } = renderHook(() => useQuickCaptureShortcut(vi.fn()));
    unmount();

    const detachMock = vi.fn();
    resolveListen?.(detachMock);
    await Promise.resolve();

    expect(detachMock).toHaveBeenCalledTimes(1);
  });
});
