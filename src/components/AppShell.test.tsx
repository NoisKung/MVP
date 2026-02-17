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
    });
  });

  it("opens Conflict Center when conflict status badge is clicked", () => {
    const onOpenConflictCenter = vi.fn();

    render(
      <AppShell
        onCreateClick={() => undefined}
        syncStatus="CONFLICT"
        syncStatusLabel="Needs attention"
        onOpenConflictCenter={onOpenConflictCenter}
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
        onOpenConflictCenter={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    );

    const conflictsButton = screen.getByRole("button", { name: "Conflicts" });
    fireEvent.click(conflictsButton);
    expect(conflictsButton).toHaveClass("active");
  });
});
