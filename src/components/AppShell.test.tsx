import { fireEvent, render, screen } from "@testing-library/react";
import { AppShell } from "@/components/AppShell";
import { useAppStore } from "@/store/app-store";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

describe("AppShell", () => {
  beforeEach(() => {
    useAppStore.setState({
      activeView: "board",
      editingTask: null,
      isCreateOpen: false,
      taskDetailFocus: {
        mode: "IDLE",
        taskId: null,
        projectId: null,
      },
    });
  });

  it("opens Conflict Center when conflict status badge is clicked", () => {
    const onOpenConflictCenter = vi.fn();

    render(
      <AppShell
        onCreateClick={() => undefined}
        syncStatus="CONFLICT"
        syncStatusLabel="Needs attention"
        autosaveStatus="ready"
        autosaveStatusLabel="Autosave ready"
        onOpenConflictCenter={onOpenConflictCenter}
        onOpenShortcutHelp={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: /needs attention/i }));
    expect(onOpenConflictCenter).toHaveBeenCalledTimes(1);
  });

  it("renders conflict navigation item and allows switching to it", () => {
    render(
      <AppShell
        onCreateClick={() => undefined}
        syncStatus="SYNCED"
        syncStatusLabel="Synced"
        autosaveStatus="ready"
        autosaveStatusLabel="Autosave ready"
        onOpenConflictCenter={() => undefined}
        onOpenShortcutHelp={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    );

    const conflictsButton = screen.getByRole("button", { name: "Conflicts" });
    fireEvent.click(conflictsButton);
    expect(conflictsButton).toHaveClass("active");
  });

  it("opens shortcut help when the footer button is clicked", () => {
    const onOpenShortcutHelp = vi.fn();

    render(
      <AppShell
        onCreateClick={() => undefined}
        syncStatus="SYNCED"
        syncStatusLabel="Synced"
        autosaveStatus="ready"
        autosaveStatusLabel="Autosave ready"
        onOpenConflictCenter={() => undefined}
        onOpenShortcutHelp={onOpenShortcutHelp}
      >
        <div>content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Shortcuts ?" }));
    expect(onOpenShortcutHelp).toHaveBeenCalledTimes(1);
  });

  it("renders autosave status label with detail tooltip", () => {
    render(
      <AppShell
        onCreateClick={() => undefined}
        syncStatus="SYNCED"
        syncStatusLabel="Synced"
        autosaveStatus="error"
        autosaveStatusLabel="Autosave failed"
        autosaveStatusDetail="Disk write failed."
        onOpenConflictCenter={() => undefined}
        onOpenShortcutHelp={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    );

    const autosaveLabel = screen.getByText("Autosave failed");
    expect(autosaveLabel).toBeInTheDocument();
    expect(autosaveLabel.closest(".footer-autosave-error")).not.toBeNull();
    expect(autosaveLabel.closest("[role='status']")).toHaveAttribute(
      "title",
      "Disk write failed.",
    );
  });
});
