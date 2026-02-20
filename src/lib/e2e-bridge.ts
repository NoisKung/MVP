interface SeededConflictInfo {
  conflict_id: string;
  entity_id: string;
}

export interface SoloStackE2EBridge {
  resetSyncState: () => Promise<void>;
  seedTaskFieldConflict: () => Promise<SeededConflictInfo>;
  listOpenConflictIds: () => Promise<string[]>;
  setSyncFailureBudget: (count: number) => Promise<void>;
  setMigrationSyncWriteBlocked: (
    blocked: boolean,
    reason?: string | null,
  ) => Promise<void>;
}

export interface InstallE2EBridgeInput {
  enabled: boolean;
  onResetSyncState: () => Promise<void> | void;
  onSeedTaskFieldConflict: () =>
    | Promise<SeededConflictInfo>
    | SeededConflictInfo;
  onListOpenConflictIds: () => Promise<string[]> | string[];
  onSetSyncFailureBudget: (count: number) => Promise<void> | void;
  onSetMigrationSyncWriteBlocked: (
    blocked: boolean,
    reason?: string | null,
  ) => Promise<void> | void;
}

declare global {
  interface Window {
    __solostackE2E?: SoloStackE2EBridge;
  }
}

export function installE2EBridge(input: InstallE2EBridgeInput): void {
  if (typeof window === "undefined") return;

  if (!input.enabled) {
    delete window.__solostackE2E;
    return;
  }

  window.__solostackE2E = {
    async resetSyncState() {
      await input.onResetSyncState();
    },
    async seedTaskFieldConflict() {
      return input.onSeedTaskFieldConflict();
    },
    async listOpenConflictIds() {
      return input.onListOpenConflictIds();
    },
    async setSyncFailureBudget(count: number) {
      await input.onSetSyncFailureBudget(count);
    },
  };
}
