import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { AppLocale } from "@/lib/types";

const TRANSLATIONS = {
  en: {
    "shell.menu.open": "Open menu",
    "shell.menu.close": "Close menu",
    "shell.brand": "SoloStack",
    "shell.createTask": "New Task",
    "shell.createTask.shortcut": "Cmd/Ctrl+N",
    "shell.workspace": "Workspace",
    "shell.nav.board": "Board",
    "shell.nav.projects": "Projects",
    "shell.nav.calendar": "Calendar",
    "shell.nav.today": "Today",
    "shell.nav.upcoming": "Upcoming",
    "shell.nav.conflicts": "Conflicts",
    "shell.nav.review": "Weekly Review",
    "shell.nav.dashboard": "Dashboard",
    "shell.nav.settings": "Settings",
    "shell.sync.openConflictCenter": "Open Conflict Center",
    "shell.shortcuts.openHelp": "Open keyboard shortcut help",
    "shell.shortcuts.button": "Shortcuts ?",
    "shell.kofi.support": "Support me on Ko-fi",
    "shell.version": "v{version}",
    "sync.status.localOnly": "Local only",
    "sync.status.syncing": "Syncing...",
    "sync.status.synced": "Synced",
    "sync.status.syncedAgo": "Synced {time}",
    "sync.status.offline": "Offline",
    "sync.status.paused": "Sync paused",
    "sync.status.attention": "Needs attention",
    "sync.time.justNow": "just now",
    "sync.time.minutesAgo": "{count}m ago",
    "sync.time.hoursAgo": "{count}h ago",
    "sync.time.daysAgo": "{count}d ago",
    "sync.error.unexpected": "An unexpected sync error occurred.",
    "sync.offline.retryNetworkReturn":
      "You're offline. Sync will retry when network returns.",
    "sync.conflict.part.outboxFailed": "{count} outbox change(s) failed",
    "sync.conflict.part.incomingFailed": "{count} incoming change(s) failed",
    "sync.conflict.part.detected": "{count} conflict(s) detected",
    "sync.warning.providerUnavailable":
      "Selected sync provider is unavailable.",
    "sync.warning.invalidConfigNoLastKnownGood":
      "Sync config is invalid and no fallback transport is available.",
    "sync.warning.usingLastKnownGood":
      "Using last known-good transport. {warning}",
    "sync.warning.completedWithLastKnownGood":
      "Sync completed with last known-good transport. {warning}",
    "sync.migration.writeBlocked":
      "Sync is temporarily blocked by migration guardrails. Resolve migration issue and restart the app.",
    "sync.migration.writeBlockedWithError":
      "Sync is temporarily blocked by migration guardrails: {error}",
    "sync.transport.error.unexpected": "Unexpected transport error.",
    "sync.transport.error.invalidJson":
      "Transport response returned invalid JSON.",
    "sync.transport.error.timeout": "Sync request timed out.",
    "sync.transport.error.requireBothUrls": "Set both push URL and pull URL.",
    "sync.transport.error.invalidUrls":
      "Push URL and Pull URL must be valid http(s) URLs.",
    "sync.transport.warning.providerUnavailable":
      "{provider} is currently unavailable.",
    "sync.transport.warning.providerNotConfigured":
      "{provider} connector is not configured yet.",
    "sync.contract.error.idempotencyKeyRequiresIds":
      "Device ID and change ID are required for idempotency key.",
    "sync.contract.error.deviceIdRequired": "Device ID is required.",
    "sync.contract.error.invalidPullResponse": "Invalid sync pull response.",
    "sync.contract.error.invalidPullMetadata":
      "Invalid sync pull response metadata.",
    "sync.contract.error.invalidPushResponse": "Invalid sync push response.",
    "sync.contract.error.invalidPushMetadata":
      "Invalid sync push response metadata.",
    "sync.contract.error.unknown": "Unknown sync error.",
    "sync.api.error.schemaMismatch":
      "Sync schema mismatch. Please update the app and retry.",
    "sync.api.error.unauthorized":
      "Sync unauthorized. Please sign in again and retry.",
    "sync.api.error.forbidden": "Sync access is forbidden for this account.",
    "sync.api.error.rateLimited":
      "Sync is rate-limited. Please wait and try again.",
    "sync.api.error.invalidCursor":
      "Sync cursor is invalid. Re-sync is required.",
    "sync.api.error.validation": "Sync request validation failed.",
    "sync.api.error.internal": "Sync service encountered an internal error.",
    "sync.api.error.unavailable": "Sync service is currently unavailable.",
    "sync.engine.error.serverCursorRequired":
      "Server cursor is required to advance sync checkpoint.",
    "autosave.ready": "Autosave ready",
    "autosave.saving": "Autosaving...",
    "autosave.saved": "Saved",
    "autosave.savedAgo": "Saved {time}",
    "autosave.failed": "Autosave failed",
    "autosave.detail.saving": "Saving local changes.",
    "autosave.detail.savedAt": "Last autosave at {time}.",
    "autosave.detail.waiting": "Waiting for local changes.",
    "app.error.unexpected": "An unexpected error occurred. Please try again.",
    "app.error.failedLoadTasks": "Failed to load tasks",
    "app.error.failedLoadCalendar": "Failed to load calendar",
    "app.error.restoreBlocked":
      "Restore is blocked: {reason}. Resolve or sync pending state first, or confirm force restore.",
    "app.error.unsupportedSyncEntityType": "Unsupported sync entity type.",
    "app.error.unsupportedSyncOperation": "Unsupported sync operation.",
    "app.error.unsupportedSyncConflictEventType":
      "Unsupported sync conflict event type.",
    "app.error.selectedProjectMissing": "Selected project does not exist.",
    "app.error.unsupportedLocale": "Unsupported app locale.",
    "app.error.conflictIdRequired": "conflict_id is required.",
    "app.error.conflictNotFound": "Conflict not found.",
    "app.error.invalidConflictResolutionStrategy":
      "Invalid conflict resolution strategy.",
    "app.error.manualMergePayloadRequired":
      "Manual merge requires a non-empty resolution payload.",
    "app.error.projectNameExists": "Project name already exists.",
    "app.error.projectNotFound": "Project not found.",
    "app.error.taskNotFound": "Task not found.",
    "app.error.subtaskTitleRequired": "Subtask title is required.",
    "app.error.subtaskNotFound": "Subtask not found.",
    "app.error.templateNameRequired": "Template name is required.",
    "app.error.recurringTemplateDueOffsetRequired":
      "Recurring templates require a due offset.",
    "app.error.reminderOffsetMustBeEarlier":
      "Reminder offset must be earlier than due offset.",
    "app.error.templateNameExists": "Template name already exists.",
    "app.error.invalidBackupPayload": "Invalid backup payload.",
    "app.error.unsupportedBackupVersion": "Unsupported backup version.",
    "app.error.invalidBackupPayloadMissingData":
      "Invalid backup payload: missing data section.",
    "app.error.noLatestBackupSnapshot":
      "No latest backup snapshot found. Export backup first.",
    "app.error.latestBackupSnapshotCorrupted":
      "Latest backup snapshot is corrupted.",
    "common.retry": "Retry",
    "common.error.unableRequest": "Unable to complete the request.",
    "common.never": "Never",
    "common.unknown": "Unknown",
    "undo.pendingAction": "Pending action:",
    "undo.more": "+{count} more",
    "undo.window.seconds": "{count}s",
    "undo.button": "Undo ({time})",
    "quickCapture.title": "Quick Capture",
    "quickCapture.close": "Close quick capture",
    "quickCapture.placeholder": "Type a task and press Enter...",
    "quickCapture.hintEsc": "Esc to close",
    "quickCapture.saving": "Saving...",
    "quickCapture.save": "Save",
    "manualMerge.title": "Manual Merge Editor",
    "manualMerge.useLocal": "Use Local",
    "manualMerge.useRemote": "Use Remote",
    "manualMerge.useCombined": "Use Combined",
    "manualMerge.appendLocalOnly": "Append Local-only",
    "manualMerge.appendRemoteOnly": "Append Remote-only",
    "manualMerge.local": "Local",
    "manualMerge.remote": "Remote",
    "manualMerge.emptyDiff": "No diff content available.",
    "manualMerge.truncated":
      "Diff is truncated to first {count} rows for readability.",
    "manualMerge.mergedContent": "Merged content",
    "manualMerge.cancel": "Cancel",
    "manualMerge.applying": "Applying...",
    "manualMerge.apply": "Apply Merge",
    "app.undo.restoreLatestBackup": "Restore latest backup",
    "app.undo.importBackupNamed": 'Import backup "{name}"',
    "app.undo.importBackupFile": "Import backup file",
    "app.undo.error.backupRestorePending":
      "A backup restore already has a pending undo action.",
    "app.undo.error.backupImportPending":
      "A backup import already has a pending undo action.",
    "app.sync.conflictsResolvedLocally":
      "Conflicts resolved locally. Run Sync now to confirm.",
    "app.undo.retryConflict": "Retry conflict {id}",
    "app.undo.resolveConflict": "Resolve conflict {id}",
    "app.undo.error.conflictPending":
      "This conflict already has a pending undo action.",
    "app.undo.deleteTask": "Delete task",
    "app.undo.deleteTaskNamed": 'Delete task "{name}"',
    "app.undo.error.taskPending":
      "This task already has a pending undo action.",
    "app.undo.deleteProjectNamed": 'Delete project "{name}"',
    "app.undo.error.projectPending":
      "This project already has a pending undo action.",
    "app.e2e.syncNeedsAttention": "Sync requires attention.",
    "app.e2e.conflictsDetected": "{count} conflict(s) detected.",
    "app.e2e.simulatedFailure": "E2E simulated transport failure.",
    "app.e2e.transport.invalidJson": "E2E transport returned invalid JSON.",
    "app.e2e.transport.requestFailed":
      "E2E transport request failed ({status}).",
    "reminder.title": "SoloStack Reminder",
    "reminder.dueAt": "Due {dueAt}",
    "reminder.action.snooze15m": "Snooze 15m",
    "reminder.action.snooze1h": "Snooze 1h",
    "reminder.action.snoozeTomorrow": "Snooze to tomorrow",
    "taskForm.error.invalidDueFormat": "Due date format is invalid.",
    "taskForm.error.invalidReminderFormat": "Reminder format is invalid.",
    "taskForm.error.reminderAfterDue":
      "Reminder must be set before the due date.",
    "taskForm.error.recurringNeedsDue": "Recurring tasks require a due date.",
    "taskForm.error.recurringTemplateNeedsDue":
      "Recurring templates require a due date.",
    "taskForm.error.naturalParseFailed":
      "Could not parse due date. Try phrases like 'tomorrow 9am' or 'next monday'.",
    "taskForm.template.word": "Template",
    "taskForm.template.defaultName": "My Template",
    "taskForm.template.promptName": "Template name",
    "taskForm.template.deleteConfirm": 'Delete template "{name}" permanently?',
    "taskForm.project.word": "Project",
    "taskForm.project.promptName": "Project name",
    "taskForm.title.edit": "Edit Task",
    "taskForm.title.new": "New Task",
    "taskForm.closeAria": "Close task form",
    "taskForm.field.title": "Title",
    "taskForm.placeholder.title": "What needs to be done?",
    "taskForm.field.description": "Description",
    "taskForm.optional": "optional",
    "taskForm.placeholder.description": "Add details...",
    "taskForm.field.notes": "Notes",
    "taskForm.badge.markdown": "Markdown",
    "taskForm.mode.edit": "Edit",
    "taskForm.mode.preview": "Preview",
    "taskForm.placeholder.notesMarkdown":
      "Use markdown: # heading, - list, **bold**, [link](https://...)",
    "taskForm.preview.empty":
      "Nothing to preview yet. Add markdown in Edit mode.",
    "taskForm.field.template": "Template",
    "taskForm.template.select": "Select a template...",
    "taskForm.template.apply": "Apply",
    "taskForm.template.save": "Save Template",
    "taskForm.template.saving": "Saving...",
    "taskForm.template.delete": "Delete",
    "taskForm.template.deleting": "Deleting...",
    "taskForm.field.project": "Project",
    "taskForm.project.none": "No project",
    "taskForm.project.new": "New",
    "taskForm.project.creating": "Creating...",
    "taskForm.field.checklist": "Checklist",
    "taskForm.checklist.doneSuffix": "done",
    "taskForm.checklist.placeholder": "Add checklist item...",
    "taskForm.checklist.add": "Add",
    "taskForm.checklist.loading": "Loading checklist...",
    "taskForm.checklist.empty": "No checklist items yet.",
    "taskForm.field.dueAt": "Due date & time",
    "taskForm.field.reminder": "Reminder",
    "taskForm.field.smartDue": "Smart due input",
    "taskForm.badge.beta": "beta",
    "taskForm.smartDue.placeholder": "tomorrow 9am, next monday, in 3 days...",
    "taskForm.smartDue.apply": "Apply",
    "taskForm.smartDue.examples":
      "Examples: tomorrow 9am, next monday, in 3 days, 2026-03-01 14:30",
    "taskForm.field.repeat": "Repeat",
    "taskForm.field.priority": "Priority",
    "taskForm.field.importance": "Importance",
    "taskForm.importance.on": "Important",
    "taskForm.importance.mark": "Mark important",
    "taskForm.priority.urgent": "Urgent",
    "taskForm.priority.normal": "Normal",
    "taskForm.priority.low": "Low",
    "taskForm.status.todo": "To Do",
    "taskForm.status.doing": "In Progress",
    "taskForm.status.done": "Done",
    "taskForm.status.archived": "Archived",
    "taskForm.recurrence.none": "Does not repeat",
    "taskForm.recurrence.daily": "Daily",
    "taskForm.recurrence.weekly": "Weekly",
    "taskForm.recurrence.monthly": "Monthly",
    "taskForm.changelog.title": "Recent Changes",
    "taskForm.changelog.loading": "Loading changelog...",
    "taskForm.changelog.empty": "No changes recorded yet.",
    "taskForm.changelog.field.status": "Status",
    "taskForm.changelog.field.priority": "Priority",
    "taskForm.changelog.field.title": "Title",
    "taskForm.changelog.field.description": "Description",
    "taskForm.changelog.field.notes": "Notes",
    "taskForm.changelog.field.importance": "Importance",
    "taskForm.changelog.field.dueAt": "Due date",
    "taskForm.changelog.field.reminder": "Reminder",
    "taskForm.changelog.field.recurrence": "Repeat",
    "taskForm.changelog.field.project": "Project",
    "taskForm.changelog.field.task": "Task",
    "taskForm.changelog.projectShort": "Project ({id})",
    "taskForm.changelog.noProject": "No project",
    "taskForm.changelog.emptyValue": "Empty",
    "taskForm.changelog.important": "Important",
    "taskForm.changelog.notImportant": "Not important",
    "taskForm.changelog.created": "Task created: {value}",
    "taskForm.changelog.changed": "{field} changed from {from} to {to}",
    "taskForm.relative.justNow": "Just now",
    "taskForm.relative.minutesAgo": "{count}m ago",
    "taskForm.relative.hoursAgo": "{count}h ago",
    "taskForm.relative.daysAgo": "{count}d ago",
    "taskForm.action.cancel": "Cancel",
    "taskForm.action.saveChanges": "Save Changes",
    "taskForm.action.createTask": "Create Task",
    "projectView.error.projectNameRequired": "Project name is required.",
    "projectView.loadingProjects": "Loading projects...",
    "projectView.empty.title": "No projects yet",
    "projectView.empty.subtitle":
      "Create your first project to group tasks and track progress.",
    "projectView.field.name": "Name",
    "projectView.field.color": "Color",
    "projectView.field.description": "Description",
    "projectView.placeholder.name": "Project name",
    "projectView.placeholder.description": "What is this project for?",
    "projectView.action.clearFilters": "Clear Filters",
    "projectView.action.close": "Close",
    "projectView.action.newProject": "New Project",
    "projectView.action.cancel": "Cancel",
    "projectView.action.create": "Create",
    "projectView.action.createProject": "Create Project",
    "projectView.action.creating": "Creating...",
    "projectView.search.placeholder": "Search project...",
    "projectView.search.clear": "Clear project search",
    "projectView.statusFilter.all": "All",
    "projectView.statusFilter.active": "Active",
    "projectView.statusFilter.completed": "Completed",
    "projectView.empty.filtered": "No projects match current filters.",
    "projectView.status.active": "Active",
    "projectView.status.completed": "Completed",
    "projectView.metric.done": "done",
    "projectView.metric.overdue": "overdue",
    "projectView.metric.open": "open",
    "projectView.notice.deleteArm":
      'Click "Confirm Delete" to queue deleting "{name}". You can undo from the Undo bar for a few seconds.',
    "projectView.notice.deleteQueued":
      "Delete queued. This project will be removed in {seconds}s unless you click Undo.",
    "projectView.error.deletePending":
      "This project already has a pending undo action.",
    "projectView.header.title": "Projects",
    "projectView.subtitle.filtered": "Showing {shown} of {total} projects",
    "projectView.subtitle.tracked": "{count} projects tracked",
    "projectView.detail.taskCount": "{count} task(s) in this project",
    "projectView.action.edit": "Edit",
    "projectView.action.editing": "Editing...",
    "projectView.action.save": "Save",
    "projectView.action.saving": "Saving...",
    "projectView.action.markActive": "Mark Active",
    "projectView.action.markCompleted": "Mark Completed",
    "projectView.action.delete": "Delete",
    "projectView.action.confirmDelete": "Confirm Delete",
    "projectView.action.deleting": "Deleting...",
    "projectView.action.queued": "Queued...",
    "projectView.action.newTask": "New Task",
    "projectView.kpi.progress": "Progress",
    "projectView.kpi.total": "Total",
    "projectView.kpi.open": "Open",
    "projectView.kpi.overdue": "Overdue",
    "projectView.deliveryProgress": "Delivery Progress",
    "projectView.loadingTasks": "Loading tasks...",
    "projectView.empty.tasksInProject": "No tasks in this project yet.",
    "projectView.action.addFirstTask": "Add First Task",
    "projectView.empty.tasksInSection": "No tasks",
    "projectView.empty.selectProject": "Select a project to see details.",
    "schedule.title.today": "Today",
    "schedule.title.upcoming": "Upcoming",
    "schedule.subtitle.today": "{count} task(s) due now or today",
    "schedule.subtitle.upcoming": "{count} task(s) due in the next 7 days",
    "schedule.empty.today.title": "No tasks due today",
    "schedule.empty.today.desc":
      "Plan the next task and set a due time so it appears here.",
    "schedule.empty.upcoming.title": "No upcoming tasks",
    "schedule.empty.upcoming.desc":
      "Tasks with a due date in the next 7 days will show up here.",
    "schedule.action.createTask": "Create Task",
    "schedule.section.overdue": "Overdue",
    "schedule.section.dueToday": "Due Today",
    "schedule.day.noDate": "No date",
    "shortcutHelp.aria": "Keyboard shortcuts",
    "shortcutHelp.title": "Keyboard Shortcuts",
    "shortcutHelp.closeAria": "Close shortcut help",
    "shortcutHelp.close": "Close",
    "shortcutHelp.subtitle": "Power actions for faster daily workflow.",
    "shortcutHelp.row.newTask": "Create a new task",
    "shortcutHelp.row.commandPalette": "Open command palette",
    "shortcutHelp.row.openSettings": "Open Settings",
    "shortcutHelp.row.openConflictCenter": "Open Conflict Center",
    "shortcutHelp.row.syncNow": "Run Sync now",
    "shortcutHelp.row.openShortcutHelp": "Open keyboard shortcut help",
    "shortcutHelp.row.closeUi": "Close modal/palette/form",
    "shortcutHelp.combo.newTask": "Cmd/Ctrl + N",
    "shortcutHelp.combo.commandPalette": "Cmd/Ctrl + K",
    "shortcutHelp.combo.openSettings": "Cmd/Ctrl + ,",
    "shortcutHelp.combo.openConflictCenter": "Cmd/Ctrl + Shift + C",
    "shortcutHelp.combo.syncNow": "Cmd/Ctrl + Shift + S",
    "shortcutHelp.combo.openShortcutHelp": "?",
    "shortcutHelp.combo.closeUi": "Esc",
    "commandPalette.group.actions": "Actions",
    "commandPalette.group.navigation": "Navigation",
    "commandPalette.group.tasks": "Tasks",
    "commandPalette.input.placeholder": "Type a command...",
    "commandPalette.empty": "No matching commands.",
    "commandPalette.footerHint":
      "Enter to run • Arrow keys to navigate • Esc to close",
    "commandPalette.action.createTask": "Create new task",
    "commandPalette.action.quickCapture": "Open quick capture",
    "commandPalette.action.syncNow": "Run Sync now",
    "commandPalette.action.exportBackup": "Export backup",
    "commandPalette.action.openSyncDiagnostics": "Open Sync diagnostics",
    "commandPalette.action.openRestorePreflight": "Open Restore preflight",
    "commandPalette.shortcut.quickCapture": "Cmd/Ctrl + Shift + N",
    "commandPalette.nav.goTo": "Go to {view}",
    "commandPalette.meta.current": "Current",
    "commandPalette.task.edit": "Edit task: {title}",
    "commandPalette.task.setTodo": "Set To Do: {title}",
    "commandPalette.task.setDoing": "Set In Progress: {title}",
    "commandPalette.task.setDone": "Set Done: {title}",
    "conflictCenter.title": "Conflict Center",
    "conflictCenter.subtitle":
      "Review, resolve, and export sync conflicts safely.",
    "conflictCenter.action.openSyncSettings": "Open Sync Settings",
    "conflictCenter.action.exporting": "Exporting...",
    "conflictCenter.action.exportReport": "Export Report",
    "conflictCenter.action.keepLocal": "Keep Local",
    "conflictCenter.action.keepRemote": "Keep Remote",
    "conflictCenter.action.manualMerge": "Manual Merge",
    "conflictCenter.action.applyDefault": "Apply Default",
    "conflictCenter.action.details": "Details",
    "conflictCenter.loading": "Loading conflicts...",
    "conflictCenter.empty.title": "No open conflicts",
    "conflictCenter.empty.subtitle":
      "Sync is clear. New conflicts will appear here when detected.",
    "conflictCenter.selected": "Selected",
    "conflictCenter.meta.detected": "Detected",
    "conflictCenter.detail.title": "Conflict Detail",
    "conflictCenter.detail.localPayload": "Local payload",
    "conflictCenter.detail.remotePayload": "Remote payload",
    "conflictCenter.detail.timeline": "Timeline",
    "conflictCenter.detail.loadingTimeline": "Loading timeline...",
    "conflictCenter.detail.noEvents": "No events yet.",
    "conflictCenter.error.mergeEmpty": "Merged content must not be empty.",
    "conflictCenter.feedback.retryQueued":
      "Conflict retry queued. Undo is available for 5 seconds.",
    "conflictCenter.feedback.resolveQueued":
      "Conflict resolution queued. Undo is available for 5 seconds.",
    "conflictCenter.feedback.exported":
      "Conflict report exported ({count} conflict record(s)).",
    "conflictCenter.confirm.retry":
      "Retry will re-queue this conflict in the next sync cycle. Continue?",
    "conflictCenter.defaultStrategy": "Default strategy: {strategy}",
    "conflictCenter.strategy.keepLocal": "Keep Local",
    "conflictCenter.strategy.keepRemote": "Keep Remote",
    "conflictCenter.strategy.manualMerge": "Manual Merge",
    "conflictCenter.entity.project": "Project",
    "conflictCenter.entity.task": "Task",
    "conflictCenter.entity.taskSubtask": "Checklist Item",
    "conflictCenter.entity.taskTemplate": "Task Template",
    "conflictCenter.entity.setting": "Setting",
    "conflictCenter.reason.missingProjectName":
      "Project name is missing in incoming payload.",
    "conflictCenter.reason.missingTaskTitle":
      "Task title is missing in incoming payload.",
    "conflictCenter.reason.taskNotesCollision":
      "Incoming task notes collide with local edits.",
    "conflictCenter.reason.taskProjectNotFound":
      "Incoming task references a project that does not exist locally.",
    "conflictCenter.reason.invalidSubtaskPayload":
      "Subtask payload must include both task_id and title.",
    "conflictCenter.reason.subtaskTaskNotFound":
      "Incoming subtask references a task that does not exist locally.",
    "conflictCenter.reason.missingTemplateName":
      "Task template name is missing in incoming payload.",
    "conflictCenter.type.deleteVsUpdate": "Delete vs Update",
    "conflictCenter.type.notesCollision": "Notes Collision",
    "conflictCenter.type.validationError": "Validation Error",
    "conflictCenter.type.fieldConflict": "Field Conflict",
    "conflictCenter.event.detected": "Detected",
    "conflictCenter.event.resolved": "Resolved",
    "conflictCenter.event.ignored": "Ignored",
    "conflictCenter.event.retried": "Retried",
    "conflictCenter.event.exported": "Exported",
    "conflictCenter.payload.empty": "(empty)",
    "weeklyReview.error.unableLoad": "Unable to load weekly review.",
    "weeklyReview.error.title": "Failed to load weekly review",
    "weeklyReview.range.thisWeek": "This week",
    "weeklyReview.date.unknown": "Unknown",
    "weeklyReview.date.noDue": "No due date",
    "weeklyReview.date.invalidDue": "Invalid due date",
    "weeklyReview.title": "Weekly Review",
    "weeklyReview.updatedAt": "Updated {time}",
    "weeklyReview.action.refresh": "Refresh",
    "weeklyReview.action.refreshing": "Refreshing...",
    "weeklyReview.headline.overdue":
      "{count} overdue {taskWord} need recovery attention.",
    "weeklyReview.headline.momentum":
      "Great momentum: you closed {count} more {taskWord} than you created this week.",
    "weeklyReview.headline.balanced":
      "Balanced week: completions and new tasks are currently in sync.",
    "weeklyReview.headline.backlogGrowth":
      "Backlog grew by {count} {taskWord} this week. Focus on priority items next.",
    "weeklyReview.word.task": "task",
    "weeklyReview.word.tasks": "tasks",
    "weeklyReview.stat.completed.label": "Completed",
    "weeklyReview.stat.completed.subtitle": "Moved to Done this week",
    "weeklyReview.stat.pending.label": "Pending",
    "weeklyReview.stat.pending.subtitle": "Open and not overdue",
    "weeklyReview.stat.overdue.label": "Overdue",
    "weeklyReview.stat.overdue.subtitle": "Need immediate recovery",
    "weeklyReview.stat.created.label": "Created",
    "weeklyReview.stat.created.subtitle": "New tasks added this week",
    "weeklyReview.progress.completionRatio": "Completion ratio",
    "weeklyReview.progress.carryOverOpen": "{count} carry-over open",
    "weeklyReview.progress.dueThisWeekOpen":
      "{count} due this week and still open",
    "weeklyReview.section.completed.title": "Completed This Week",
    "weeklyReview.section.completed.shown": "{count} shown",
    "weeklyReview.section.completed.empty":
      "No completed tasks yet in this week.",
    "weeklyReview.section.completed.doneAt": "Done {time}",
    "weeklyReview.section.overdue.title": "Overdue",
    "weeklyReview.section.overdue.total": "{count} total",
    "weeklyReview.section.overdue.empty": "No overdue tasks. Keep this trend.",
    "weeklyReview.section.overdue.dueAt": "Due {time}",
    "weeklyReview.section.pending.title": "Pending Focus",
    "weeklyReview.section.pending.total": "{count} total",
    "weeklyReview.section.pending.empty": "No pending tasks in the queue.",
    "weeklyReview.section.pending.createTask": "Create task",
    "weeklyReview.action.start": "Start",
    "weeklyReview.action.pause": "Pause",
    "taskFilters.due.all": "All due",
    "taskFilters.due.overdue": "Overdue",
    "taskFilters.due.today": "Today",
    "taskFilters.due.next7Days": "Next 7 days",
    "taskFilters.due.noDue": "No due date",
    "taskFilters.sort.createdDesc": "Newest created",
    "taskFilters.sort.updatedDesc": "Recently updated",
    "taskFilters.sort.dueAsc": "Due date (earliest)",
    "taskFilters.sort.priorityDesc": "Priority (high to low)",
    "taskFilters.sort.titleAsc": "Title (A-Z)",
    "taskFilters.prompt.saveViewName": "Name this saved view",
    "taskFilters.prompt.defaultViewName": "My View",
    "taskFilters.search.placeholder": "Search title or description...",
    "taskFilters.search.clear": "Clear search",
    "taskFilters.action.saveView": "Save View",
    "taskFilters.action.clear": "Clear",
    "taskFilters.action.showFilters": "Show Filters",
    "taskFilters.action.hideFilters": "Hide Filters",
    "taskFilters.summary.showing": "Showing {shown} / {total}",
    "taskFilters.label.project": "Project",
    "taskFilters.label.status": "Status",
    "taskFilters.label.priority": "Priority",
    "taskFilters.label.due": "Due",
    "taskFilters.label.sort": "Sort",
    "taskFilters.label.important": "Important",
    "taskFilters.label.savedViews": "Saved Views",
    "taskFilters.bulk.selectShown": "Select shown",
    "taskFilters.bulk.unselectShown": "Unselect shown",
    "taskFilters.bulk.clearSelected": "Clear selected",
    "taskFilters.bulk.selectedCount": "{count} selected",
    "taskFilters.bulk.title": "Bulk edit",
    "taskFilters.bulk.statusPlaceholder": "Set status...",
    "taskFilters.bulk.priorityPlaceholder": "Set priority...",
    "taskFilters.bulk.projectPlaceholder": "Move to project...",
    "taskFilters.bulk.projectClear": "No project",
    "taskFilters.bulk.markImportant": "Mark important",
    "taskFilters.bulk.unmarkImportant": "Clear important",
    "taskFilters.bulk.duePlaceholder": "Set due...",
    "taskFilters.bulk.setDue": "Apply due",
    "taskFilters.bulk.clearDue": "Clear due",
    "taskFilters.bulk.reminderPlaceholder": "Set reminder...",
    "taskFilters.bulk.setReminder": "Apply reminder",
    "taskFilters.bulk.clearReminder": "Clear reminder",
    "taskFilters.bulk.recurrencePlaceholder": "Set repeat...",
    "taskFilters.bulk.confirm.title":
      "Apply changes to {count} selected task(s)?",
    "taskFilters.bulk.confirm.question":
      "This action updates multiple tasks. Continue?",
    "taskFilters.empty.noProjects": "No projects available for filtering.",
    "taskFilters.empty.savedViews":
      "Save your favorite filter combinations here.",
    "taskFilters.savedView.applyTitle": "Apply saved view",
    "taskCard.action.delete": "Delete",
    "taskCard.action.moveTo": "Move to {status}",
    "taskCard.action.selectTask": "Select task",
    "taskCard.action.unselectTask": "Unselect task",
    "taskCard.focus.start": "Start focus session",
    "taskCard.focus.stop": "Stop and save focus session",
    "taskCard.focus.runningAnotherTask":
      "Focus session is running on another task",
    "taskCard.focus.elapsed": "Focus {duration}",
    "taskCard.due.overdue": "Overdue • {date} {time}",
    "taskCard.due.today": "Due today • {time}",
    "taskCard.due.default": "Due • {date} {time}",
    "taskCard.recurrence.daily": "Repeats daily",
    "taskCard.recurrence.weekly": "Repeats weekly",
    "taskCard.recurrence.monthly": "Repeats monthly",
    "taskCard.checklist.progress": "Checklist {done}/{total}",
    "calendar.title": "Calendar",
    "calendar.subtitle.withDueTasks": "{count} task(s) with due dates",
    "calendar.action.previous": "Previous",
    "calendar.action.next": "Next",
    "calendar.action.today": "Today",
    "calendar.mode.month": "Month",
    "calendar.mode.week": "Week",
    "calendar.empty.noDueTasksOnDay": "No due tasks on this day.",
    "calendar.error.unableLoadData": "Unable to load calendar data.",
    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Your productivity overview",
    "dashboard.error.title": "Failed to load dashboard",
    "dashboard.error.tryAgain": "Please try again.",
    "dashboard.stat.totalTasks": "Total Tasks",
    "dashboard.stat.completed": "Completed",
    "dashboard.momentum.dueToday": "Due Today",
    "dashboard.momentum.overdue": "Overdue",
    "dashboard.momentum.completedThisWeek": "Completed This Week",
    "dashboard.progress.overallCompletion": "Overall Completion",
    "dashboard.empty.title": "Ready to get productive?",
    "dashboard.empty.description":
      "Create your first task using the sidebar button or press",
    "dashboard.empty.shortcut": "Cmd/Ctrl+N",
    "taskBoard.title": "Board",
    "taskBoard.subtitle": "{tasks} task(s) across {columns} columns",
    "taskBoard.action.addTask": "Add task",
    "taskBoard.empty.noTasks": "No tasks",
    "settings.title": "Settings",
    "settings.subtitle":
      "Control reminders, notification access, and local data safety",
    "settings.language.title": "Language",
    "settings.language.desc":
      "Choose display language for app UI (TH/EN). Changes apply immediately.",
    "settings.language.field": "Display language",
    "settings.language.save": "Save Language",
    "settings.language.saving": "Saving...",
    "settings.language.saved": "Language preference saved.",
    "settings.language.error.same": "Language is already selected.",
    "settings.language.option.en": "English",
    "settings.language.option.th": "ไทย (Thai)",
    "settings.reminders.title": "Task Reminders",
    "settings.reminders.desc":
      "Turn reminder notifications on or off globally.",
    "settings.reminders.toggle.title": "Enable reminders",
    "settings.reminders.toggle.desc":
      "When enabled, tasks with due reminders can trigger desktop notifications.",
    "settings.permission.title": "Notification Permission",
    "settings.permission.desc":
      "Check current permission and reset permission cache/history.",
    "settings.permission.state.granted": "Granted",
    "settings.permission.state.denied": "Denied",
    "settings.permission.action.request": "Request Permission",
    "settings.permission.action.refresh": "Refresh Status",
    "settings.permission.action.reset": "Reset Permission + History",
    "settings.permission.feedback.enabled": "Notifications are enabled.",
    "settings.permission.feedback.notGranted":
      "Permission is not granted. You may need OS settings to allow notifications.",
    "settings.permission.feedback.reset":
      "Permission cache and reminder history were reset. Existing reminders can notify again.",
    "settings.sync.title": "Sync",
    "settings.sync.desc": "Manually sync now and check latest sync health.",
    "settings.sync.lastSynced": "Last synced: {time}",
    "settings.sync.localOnlyHint":
      "Local-only mode is active. Server is not required for single-device usage.",
    "settings.sync.transportHint":
      "To sync across devices, set both endpoints below.",
    "settings.sync.action.syncing": "Syncing...",
    "settings.sync.action.syncNow": "Sync now",
    "settings.sync.action.retryLastFailed": "Retry Last Failed Sync",
    "settings.sync.action.saveEndpoints": "Save Endpoints",
    "settings.sync.action.saving": "Saving...",
    "settings.sync.config.error.requireBoth":
      "Set both Push and Pull URLs, or leave both empty.",
    "settings.sync.config.error.invalidPush":
      "Push URL must be a valid http(s) URL.",
    "settings.sync.config.error.invalidPull":
      "Pull URL must be a valid http(s) URL.",
    "settings.sync.config.error.invalidServerBase":
      "Server base URL must be a valid http(s) URL.",
    "settings.sync.config.feedback.saved": "Sync endpoints were saved.",
    "settings.sync.config.feedback.cleared":
      "Sync endpoints were cleared. App is now local-only.",
    "settings.sync.config.feedback.serverApplied":
      "Server base URL was applied to Push/Pull endpoints.",
    "settings.sync.config.feedback.localhostApplied":
      "Applied localhost preset (127.0.0.1:8787) to Push/Pull endpoints.",
    "settings.sync.provider.title": "Sync Provider",
    "settings.sync.provider.desc":
      "Select provider from UI. Core sync contract remains provider-neutral.",
    "settings.sync.provider.field": "Provider",
    "settings.sync.provider.authRequirement": "Auth requirement: {value}",
    "settings.sync.provider.endpointMode": "Endpoint mode: {value}",
    "settings.sync.provider.endpointMode.managed": "Managed",
    "settings.sync.provider.endpointMode.custom": "Custom",
    "settings.sync.provider.save": "Save Provider",
    "settings.sync.provider.managed.title": "Managed Connector Settings",
    "settings.sync.provider.managed.desc":
      "Optional pilot settings for managed connector gateway and OAuth tokens.",
    "settings.sync.provider.managed.securityHint":
      "Sensitive tokens are redacted from SQLite/backup. On Tauri desktop/iOS/Android, tokens are stored in OS secure keystore; other runtimes fall back to session-only memory.",
    "settings.sync.provider.managed.baseUrl": "Connector Base URL",
    "settings.sync.provider.managed.baseUrlPlaceholder":
      "https://connector.example.com",
    "settings.sync.provider.managed.accessToken": "Access Token",
    "settings.sync.provider.managed.tokenType": "Token Type",
    "settings.sync.provider.managed.refreshToken": "Refresh Token",
    "settings.sync.provider.managed.refreshUrl": "Token Refresh URL",
    "settings.sync.provider.managed.expiresAt": "Access Token Expires At (ISO)",
    "settings.sync.provider.managed.expiresAtPlaceholder":
      "2026-01-01T00:00:00.000Z",
    "settings.sync.provider.managed.scope": "OAuth Scope",
    "settings.sync.provider.managed.clientId": "Client ID",
    "settings.sync.provider.managed.clientSecret": "Client Secret",
    "settings.sync.provider.managed.test.action": "Test Connector",
    "settings.sync.provider.managed.test.testing": "Testing Connector...",
    "settings.sync.provider.managed.test.feedback.success":
      "{provider} connector is reachable.",
    "settings.sync.provider.managed.test.error.unsupported":
      "Selected provider does not support managed connector testing.",
    "settings.sync.provider.managed.test.error.notConfigured":
      "Set connector base URL before testing.",
    "settings.sync.provider.managed.secureStoreTest.action":
      "Verify Secure Store",
    "settings.sync.provider.managed.secureStoreTest.testing":
      "Verifying Secure Store...",
    "settings.sync.provider.managed.secureStoreTest.feedback.success":
      "Secure store self-test passed ({backend}).",
    "settings.sync.provider.managed.secureStoreTest.error.unavailable":
      "Secure store is unavailable in this runtime ({backend}).",
    "settings.sync.provider.managed.secureStoreTest.error.failed":
      "Secure store self-test failed ({backend}): {detail}",
    "settings.sync.provider.feedback.saved": "Sync provider was saved.",
    "settings.sync.provider.endpointModeHint.managed":
      "Managed provider selected (custom URLs are still used in current build).",
    "settings.sync.provider.endpointModeHint.custom":
      "Custom endpoints required.",
    "settings.sync.provider.serverBaseUrl": "Server Base URL",
    "settings.sync.provider.serverBaseUrlPlaceholder":
      "http://127.0.0.1:8787 or https://sync.example.com",
    "settings.sync.provider.serverHelper":
      "Set one server URL, then apply to auto-fill Push/Pull. Scheme is optional (localhost/LAN defaults to http, others default to https).",
    "settings.sync.provider.serverApply": "Apply Server URL",
    "settings.sync.provider.serverUseLocalhost": "Use Localhost Preset",
    "settings.sync.provider.pushUrl": "Push URL",
    "settings.sync.provider.pullUrl": "Pull URL",
    "settings.sync.provider.pushPlaceholder":
      "https://sync.example.com/v1/sync/push",
    "settings.sync.provider.pullPlaceholder":
      "https://sync.example.com/v1/sync/pull",
    "settings.sync.provider.capability.provider_neutral.label":
      "Provider Neutral",
    "settings.sync.provider.capability.provider_neutral.summary":
      "Use custom push/pull endpoints you control.",
    "settings.sync.provider.capability.provider_neutral.auth":
      "No provider account required",
    "settings.sync.provider.capability.provider_neutral.warning1":
      "You must set both Push URL and Pull URL.",
    "settings.sync.provider.capability.provider_neutral.warning2":
      "Best fit for self-hosted sync gateways.",
    "settings.sync.provider.capability.google_appdata.label": "Google AppData",
    "settings.sync.provider.capability.google_appdata.summary":
      "Managed Google Drive appDataFolder connector.",
    "settings.sync.provider.capability.google_appdata.auth":
      "Google OAuth required",
    "settings.sync.provider.capability.google_appdata.warning1":
      "Managed connector rollout is in progress; custom URLs are still used now.",
    "settings.sync.provider.capability.google_appdata.warning2":
      "Subject to Google API quota/rate limits.",
    "settings.sync.provider.capability.onedrive_approot.label":
      "Microsoft OneDrive AppRoot",
    "settings.sync.provider.capability.onedrive_approot.summary":
      "Managed OneDrive AppRoot connector.",
    "settings.sync.provider.capability.onedrive_approot.auth":
      "Microsoft OAuth required",
    "settings.sync.provider.capability.onedrive_approot.warning1":
      "Managed connector rollout is in progress; custom URLs are still used now.",
    "settings.sync.provider.capability.onedrive_approot.warning2":
      "Graph API throttling may delay sync retries.",
    "settings.sync.provider.capability.icloud_cloudkit.label":
      "Apple iCloud CloudKit",
    "settings.sync.provider.capability.icloud_cloudkit.summary":
      "Managed CloudKit-backed connector.",
    "settings.sync.provider.capability.icloud_cloudkit.auth":
      "Apple ID + iCloud permission required",
    "settings.sync.provider.capability.icloud_cloudkit.warning1":
      "Managed connector rollout is in progress; custom URLs are still used now.",
    "settings.sync.provider.capability.icloud_cloudkit.warning2":
      "Platform/account constraints may apply outside Apple ecosystem.",
    "settings.sync.provider.capability.solostack_cloud_aws.label":
      "SoloStack Cloud (AWS)",
    "settings.sync.provider.capability.solostack_cloud_aws.summary":
      "Managed SoloStack-hosted cloud endpoints.",
    "settings.sync.provider.capability.solostack_cloud_aws.auth":
      "SoloStack Cloud account required",
    "settings.sync.provider.capability.solostack_cloud_aws.warning1":
      "Availability may vary by region during rollout.",
    "settings.sync.provider.capability.solostack_cloud_aws.warning2":
      "Network outages fall back to local-only retries.",
    "settings.sync.runtime.title": "Sync Runtime Profile",
    "settings.sync.runtime.desc":
      "Tune sync behavior for desktop/mobile beta workloads.",
    "settings.sync.runtime.profile.desktop": "Desktop",
    "settings.sync.runtime.profile.mobile": "Mobile Beta",
    "settings.sync.runtime.profile.custom": "Custom",
    "settings.sync.runtime.field.profile": "Profile",
    "settings.sync.runtime.field.foreground": "Foreground Interval (s)",
    "settings.sync.runtime.field.background": "Background Interval (s)",
    "settings.sync.runtime.field.pushLimit": "Push Limit",
    "settings.sync.runtime.field.pullLimit": "Pull Limit",
    "settings.sync.runtime.field.maxPullPages": "Max Pull Pages",
    "settings.sync.runtime.action.desktopPreset": "Desktop Preset",
    "settings.sync.runtime.action.mobilePreset": "Mobile Beta Preset",
    "settings.sync.runtime.action.resetRecommended": "Reset Recommended",
    "settings.sync.runtime.action.save": "Save Runtime",
    "settings.sync.runtime.validation.invalidInt":
      "All runtime fields must be valid integers.",
    "settings.sync.runtime.validation.foregroundRange":
      "Foreground interval must be between 15 and 3600 seconds.",
    "settings.sync.runtime.validation.backgroundRange":
      "Background interval must be between 30 and 7200 seconds.",
    "settings.sync.runtime.validation.backgroundGte":
      "Background interval must be >= foreground interval.",
    "settings.sync.runtime.validation.pushRange":
      "Push limit must be between 20 and 500.",
    "settings.sync.runtime.validation.pullRange":
      "Pull limit must be between 20 and 500.",
    "settings.sync.runtime.validation.maxPullPagesRange":
      "Max pull pages must be between 1 and 20.",
    "settings.sync.runtime.validation.incomplete":
      "Runtime values are incomplete.",
    "settings.sync.runtime.impact.highBattery":
      "High battery/network impact: short intervals can drain battery faster.",
    "settings.sync.runtime.impact.highData":
      "High data load: large push/pull limits can increase transfer cost.",
    "settings.sync.runtime.impact.balanced":
      "Balanced profile: good responsiveness with moderate resource usage.",
    "settings.sync.runtime.impact.low":
      "Low impact profile: fewer sync cycles with slower propagation.",
    "settings.sync.runtime.feedback.resetRecommended":
      "Runtime reset to recommended {profile} profile.",
    "settings.sync.runtime.feedback.saved":
      "Sync runtime profile ({profile}) was saved.",
    "settings.sync.conflictDefaults.title": "Conflict Strategy Defaults",
    "settings.sync.conflictDefaults.desc":
      "Set one default strategy per conflict type. You can still override per item.",
    "settings.sync.conflictDefaults.loading":
      "Loading conflict strategy defaults...",
    "settings.sync.conflictDefaults.save": "Save Conflict Defaults",
    "settings.sync.conflictDefaults.feedback.saved":
      "Conflict strategy defaults were saved.",
    "settings.sync.diagnostics.title": "Sync Diagnostics (Session)",
    "settings.sync.diagnostics.runtimePreset":
      "Runtime preset: {preset} (detected)",
    "settings.sync.diagnostics.runtimePresetSource":
      "Runtime preset source: {source}",
    "settings.sync.diagnostics.runtimePresetSource.userAgentData":
      "Navigator userAgentData.mobile",
    "settings.sync.diagnostics.runtimePresetSource.userAgent":
      "User-Agent pattern match",
    "settings.sync.diagnostics.runtimePresetSource.platform":
      "Platform pattern match",
    "settings.sync.diagnostics.runtimePresetSource.iPadHeuristic":
      "iPadOS desktop UA + touch heuristic",
    "settings.sync.diagnostics.runtimePresetSource.fallbackDesktop":
      "Desktop fallback",
    "settings.sync.diagnostics.runtimePresetSource.unknown": "Unknown",
    "settings.sync.diagnostics.runtimeProfile": "Runtime profile: {profile}",
    "settings.sync.diagnostics.provider": "Provider (sync loop): {provider}",
    "settings.sync.diagnostics.notSelectedYet": "Not selected yet",
    "settings.sync.diagnostics.successRate":
      "Success rate: {rate}% ({success}/{total})",
    "settings.sync.diagnostics.lastCycleDuration":
      "Last cycle duration: {value}",
    "settings.sync.diagnostics.averageCycleDuration":
      "Average cycle duration: {value}",
    "settings.sync.diagnostics.failedCycles":
      "Failed cycles: {failed} (streak: {streak})",
    "settings.sync.diagnostics.conflictCycles": "Conflict cycles: {count}",
    "settings.sync.diagnostics.providerEvents":
      "Provider selected events: {count}",
    "settings.sync.diagnostics.profileChangeEvents":
      "Runtime profile change events: {count}",
    "settings.sync.diagnostics.validationRejectedEvents":
      "Validation rejected events: {count}",
    "settings.sync.diagnostics.lastWarning": "Last warning: {value}",
    "settings.sync.diagnostics.history.title": "Diagnostics History (Latest 5)",
    "settings.sync.diagnostics.history.loading":
      "Loading diagnostics history...",
    "settings.sync.diagnostics.history.empty":
      "No diagnostics history captured yet.",
    "settings.sync.diagnostics.history.emptyFiltered":
      "No snapshots match the selected filter.",
    "settings.sync.diagnostics.history.capturedAt": "Captured: {time}",
    "settings.sync.diagnostics.history.snapshot":
      "Success {rate}% • Failed {failed} • Conflicts {conflicts} • Source {source}",
    "settings.sync.diagnostics.history.profileProvider":
      "Profile {profile} • Provider {provider}",
    "settings.sync.diagnostics.history.field.search": "Search",
    "settings.sync.diagnostics.history.field.source": "Source Filter",
    "settings.sync.diagnostics.history.field.limit": "Rows",
    "settings.sync.diagnostics.history.field.fromDate": "From Date",
    "settings.sync.diagnostics.history.field.toDate": "To Date",
    "settings.sync.diagnostics.history.placeholder.search":
      "Search provider, source, warning...",
    "settings.sync.diagnostics.history.filter.all": "All Sources",
    "settings.sync.diagnostics.history.meta":
      "Showing {shown} of {total} snapshot(s).",
    "settings.sync.diagnostics.history.action.expand": "View Full History",
    "settings.sync.diagnostics.history.action.collapse": "Hide Full History",
    "settings.sync.diagnostics.history.action.clearFilters": "Clear Filters",
    "settings.sync.diagnostics.history.action.exportFiltered":
      "Export Filtered JSON",
    "settings.sync.diagnostics.history.action.exporting": "Exporting...",
    "settings.sync.diagnostics.history.feedback.exported":
      "Diagnostics history exported ({count} snapshot(s)).",
    "settings.sync.diagnostics.history.validation.dateRange":
      "From Date must be earlier than or equal to To Date.",
    "settings.sync.diagnostics.history.error":
      "Unable to load diagnostics history.",
    "settings.sync.diagnostics.history.error.export":
      "Unable to export diagnostics history.",
    "settings.sync.duration.na": "N/A",
    "settings.sync.duration.ms": "{value} ms",
    "settings.sync.duration.seconds": "{value} s",
    "settings.sync.duration.minutes": "{value} min",
    "settings.sync.duration.hours": "{value} h",
    "settings.sync.observability.title": "Conflict Observability",
    "settings.sync.observability.loading": "Loading counters...",
    "settings.sync.observability.total": "Total conflicts: {count}",
    "settings.sync.observability.openResolvedIgnored":
      "Open/Resolved/Ignored: {open}/{resolved}/{ignored}",
    "settings.sync.observability.resolutionRate": "Resolution rate: {rate}%",
    "settings.sync.observability.medianResolve":
      "Median time to resolve: {value}",
    "settings.sync.observability.retriedEvents": "Retried events: {count}",
    "settings.sync.observability.exportedEvents": "Exported events: {count}",
    "settings.sync.observability.lastDetected": "Last detected: {time}",
    "settings.sync.observability.lastResolved": "Last resolved: {time}",
    "settings.sync.observability.unavailable":
      "Conflict observability is unavailable.",
    "settings.sync.observability.error":
      "Unable to load conflict observability counters.",
    "settings.backup.title": "Data Backup & Restore",
    "settings.backup.desc":
      "Export all local data to JSON and restore it later on this or another machine.",
    "settings.backup.warning.replaceLocal":
      "Restore will replace all current local data.",
    "settings.backup.preflight.loading": "Checking restore preflight...",
    "settings.backup.preflight.unavailable":
      "Restore preflight is unavailable. Please try again.",
    "settings.backup.preflight.latestInternal":
      "Latest internal backup: {time}",
    "settings.backup.preflight.latestSummary":
      "Latest backup includes {projects} projects, {tasks} tasks, {templates} templates.",
    "settings.backup.preflight.pendingOutbox":
      "Pending outbox changes: {count}",
    "settings.backup.preflight.openConflicts": "Open conflicts: {count}",
    "settings.backup.preflight.requiresForce":
      "Restore currently requires force because {reason} are present.",
    "settings.backup.preflight.error":
      "Unable to load restore preflight details.",
    "settings.backup.confirm.replaceData":
      "Restore will replace all local data and reset sync state (outbox/conflicts). Continue?",
    "settings.backup.confirm.forceReason":
      "Restore requires force because {reason} currently exist.",
    "settings.backup.confirm.forceDiscard":
      "Force restore will discard pending outbox changes and clear open conflicts.",
    "settings.backup.confirm.forceContinue": "Continue with force restore?",
    "settings.backup.confirm.dryRunTitle": "Restore dry-run summary:",
    "settings.backup.confirm.dryRunData":
      "Will restore {projects} projects, {tasks} tasks, {templates} templates.",
    "settings.backup.confirm.dryRunDataUnknown":
      "Unable to estimate projects/tasks/templates from this backup.",
    "settings.backup.confirm.dryRunClears":
      "Will clear {outbox} pending outbox changes and {conflicts} open conflicts.",
    "settings.backup.confirm.source.latest":
      "Source: latest internal backup ({time})",
    "settings.backup.confirm.source.latestUnknown":
      "Source: latest internal backup",
    "settings.backup.confirm.source.file": "Source file: {name}",
    "settings.backup.reason.pendingOutbox": "pending outbox changes",
    "settings.backup.reason.openConflicts": "open conflicts",
    "settings.backup.reason.activeGuardrails": "active restore guardrails",
    "settings.backup.reason.and": "and",
    "settings.backup.action.export": "Export Backup",
    "settings.backup.action.exporting": "Exporting...",
    "settings.backup.action.restoreLatest": "Restore Latest Backup",
    "settings.backup.action.restoreFromFile": "Restore from File",
    "settings.backup.action.restoreQueued": "Restore Queued...",
    "settings.backup.feedback.exported":
      "Backup exported successfully ({tasks} tasks, {projects} projects).",
    "settings.backup.feedback.restoreFileQueued":
      "Restore from file queued. Undo is available for 5 seconds.",
    "settings.backup.feedback.restoreLatestQueued":
      "Restore latest backup queued. Undo is available for 5 seconds.",
  },
  th: {
    "shell.menu.open": "เปิดเมนู",
    "shell.menu.close": "ปิดเมนู",
    "shell.brand": "SoloStack",
    "shell.createTask": "งานใหม่",
    "shell.createTask.shortcut": "Cmd/Ctrl+N",
    "shell.workspace": "พื้นที่ทำงาน",
    "shell.nav.board": "บอร์ด",
    "shell.nav.projects": "โปรเจกต์",
    "shell.nav.calendar": "ปฏิทิน",
    "shell.nav.today": "วันนี้",
    "shell.nav.upcoming": "ถัดไป",
    "shell.nav.conflicts": "คอนฟลิกต์",
    "shell.nav.review": "ทบทวนรายสัปดาห์",
    "shell.nav.dashboard": "แดชบอร์ด",
    "shell.nav.settings": "ตั้งค่า",
    "shell.sync.openConflictCenter": "เปิดศูนย์จัดการคอนฟลิกต์",
    "shell.shortcuts.openHelp": "เปิดคู่มือคีย์ลัด",
    "shell.shortcuts.button": "คีย์ลัด ?",
    "shell.kofi.support": "สนับสนุนฉันบน Ko-fi",
    "shell.version": "v{version}",
    "sync.status.localOnly": "เฉพาะเครื่องนี้",
    "sync.status.syncing": "กำลังซิงก์...",
    "sync.status.synced": "ซิงก์แล้ว",
    "sync.status.syncedAgo": "ซิงก์แล้ว {time}",
    "sync.status.offline": "ออฟไลน์",
    "sync.status.paused": "พักการซิงก์",
    "sync.status.attention": "ต้องตรวจสอบ",
    "sync.time.justNow": "เมื่อสักครู่",
    "sync.time.minutesAgo": "{count} นาทีที่แล้ว",
    "sync.time.hoursAgo": "{count} ชั่วโมงที่แล้ว",
    "sync.time.daysAgo": "{count} วันที่แล้ว",
    "sync.error.unexpected": "เกิดข้อผิดพลาดการซิงก์ที่ไม่คาดคิด",
    "sync.offline.retryNetworkReturn":
      "คุณออฟไลน์อยู่ ระบบจะลองซิงก์อีกครั้งเมื่อกลับมาออนไลน์",
    "sync.conflict.part.outboxFailed": "รายการคิวขาออกล้มเหลว {count} รายการ",
    "sync.conflict.part.incomingFailed": "รายการขาเข้าล้มเหลว {count} รายการ",
    "sync.conflict.part.detected": "ตรวจพบคอนฟลิกต์ {count} รายการ",
    "sync.warning.providerUnavailable":
      "ผู้ให้บริการซิงก์ที่เลือกยังไม่พร้อมใช้งาน",
    "sync.warning.invalidConfigNoLastKnownGood":
      "การตั้งค่าซิงก์ไม่ถูกต้องและไม่มีช่องทางรับส่งสำรองล่าสุดที่ใช้งานได้",
    "sync.warning.usingLastKnownGood":
      "กำลังใช้ช่องทางรับส่งสำรองล่าสุดที่ใช้งานได้ {warning}",
    "sync.warning.completedWithLastKnownGood":
      "ซิงก์เสร็จสิ้นด้วยช่องทางรับส่งสำรองล่าสุดที่ใช้งานได้ {warning}",
    "sync.migration.writeBlocked":
      "ระบบบล็อกการซิงก์ชั่วคราวตามเงื่อนไข migration กรุณาแก้ปัญหา migration และเปิดแอปใหม่",
    "sync.migration.writeBlockedWithError":
      "ระบบบล็อกการซิงก์ชั่วคราวตามเงื่อนไข migration: {error}",
    "sync.transport.error.unexpected":
      "เกิดข้อผิดพลาดของ transport ที่ไม่คาดคิด",
    "sync.transport.error.invalidJson":
      "ข้อมูลตอบกลับจาก transport เป็น JSON ไม่ถูกต้อง",
    "sync.transport.error.timeout": "คำขอซิงก์หมดเวลา",
    "sync.transport.error.requireBothUrls":
      "กรุณาตั้งค่า Push URL และ Pull URL ให้ครบทั้งคู่",
    "sync.transport.error.invalidUrls":
      "Push URL และ Pull URL ต้องเป็น URL แบบ http(s) ที่ถูกต้อง",
    "sync.transport.warning.providerUnavailable":
      "{provider} ยังไม่พร้อมใช้งานในขณะนี้",
    "sync.transport.warning.providerNotConfigured":
      "{provider} ยังไม่ได้ตั้งค่า",
    "sync.contract.error.idempotencyKeyRequiresIds":
      "จำเป็นต้องมี Device ID และ Change ID เพื่อสร้าง idempotency key",
    "sync.contract.error.deviceIdRequired":
      "จำเป็นต้องมีรหัสอุปกรณ์ (Device ID)",
    "sync.contract.error.invalidPullResponse":
      "ข้อมูลตอบกลับของ sync pull ไม่ถูกต้อง",
    "sync.contract.error.invalidPullMetadata":
      "metadata ของ sync pull ไม่ถูกต้อง",
    "sync.contract.error.invalidPushResponse":
      "ข้อมูลตอบกลับของ sync push ไม่ถูกต้อง",
    "sync.contract.error.invalidPushMetadata":
      "metadata ของ sync push ไม่ถูกต้อง",
    "sync.contract.error.unknown": "เกิดข้อผิดพลาดซิงก์ที่ไม่ทราบสาเหตุ",
    "sync.api.error.schemaMismatch":
      "เวอร์ชัน schema ของ sync ไม่ตรงกัน กรุณาอัปเดตแอปแล้วลองใหม่",
    "sync.api.error.unauthorized":
      "ไม่ได้รับอนุญาตให้ซิงก์ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง",
    "sync.api.error.forbidden": "บัญชีนี้ไม่มีสิทธิ์เข้าถึงการซิงก์",
    "sync.api.error.rateLimited":
      "การซิงก์ถูกจำกัดอัตราการใช้งาน กรุณารอสักครู่แล้วลองใหม่",
    "sync.api.error.invalidCursor":
      "sync cursor ไม่ถูกต้อง จำเป็นต้องซิงก์ใหม่",
    "sync.api.error.validation": "ข้อมูลคำขอซิงก์ไม่ผ่านการตรวจสอบ",
    "sync.api.error.internal": "บริการซิงก์เกิดข้อผิดพลาดภายใน",
    "sync.api.error.unavailable": "บริการซิงก์ไม่พร้อมใช้งานในขณะนี้",
    "sync.engine.error.serverCursorRequired":
      "จำเป็นต้องมี server cursor เพื่อเลื่อนจุดตรวจซิงก์",
    "autosave.ready": "พร้อมบันทึกอัตโนมัติ",
    "autosave.saving": "กำลังบันทึกอัตโนมัติ...",
    "autosave.saved": "บันทึกแล้ว",
    "autosave.savedAgo": "บันทึกแล้ว {time}",
    "autosave.failed": "บันทึกอัตโนมัติล้มเหลว",
    "autosave.detail.saving": "กำลังบันทึกการเปลี่ยนแปลงภายในเครื่อง",
    "autosave.detail.savedAt": "บันทึกอัตโนมัติล่าสุดเมื่อ {time}",
    "autosave.detail.waiting": "รอการเปลี่ยนแปลงภายในเครื่อง",
    "app.error.unexpected": "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง",
    "app.error.failedLoadTasks": "โหลดงานไม่สำเร็จ",
    "app.error.failedLoadCalendar": "โหลดปฏิทินไม่สำเร็จ",
    "app.error.restoreBlocked":
      "การกู้คืนถูกบล็อก: {reason}. โปรดจัดการหรือซิงก์รายการค้างก่อน หรือยืนยันการกู้คืนแบบบังคับ",
    "app.error.unsupportedSyncEntityType": "ไม่รองรับประเภทข้อมูลซิงก์นี้",
    "app.error.unsupportedSyncOperation": "ไม่รองรับการดำเนินการซิงก์นี้",
    "app.error.unsupportedSyncConflictEventType":
      "ไม่รองรับประเภทอีเวนต์คอนฟลิกต์ของซิงก์นี้",
    "app.error.selectedProjectMissing": "ไม่พบโปรเจกต์ที่เลือก",
    "app.error.unsupportedLocale": "ไม่รองรับภาษาแอปที่เลือก",
    "app.error.conflictIdRequired": "จำเป็นต้องระบุรหัสคอนฟลิกต์ (conflict_id)",
    "app.error.conflictNotFound": "ไม่พบคอนฟลิกต์",
    "app.error.invalidConflictResolutionStrategy":
      "กลยุทธ์การแก้คอนฟลิกต์ไม่ถูกต้อง",
    "app.error.manualMergePayloadRequired":
      "การรวมแบบกำหนดเองต้องมีข้อมูลผลลัพธ์ที่ไม่ว่าง",
    "app.error.projectNameExists": "มีชื่อโปรเจกต์นี้อยู่แล้ว",
    "app.error.projectNotFound": "ไม่พบโปรเจกต์",
    "app.error.taskNotFound": "ไม่พบงาน",
    "app.error.subtaskTitleRequired": "จำเป็นต้องระบุชื่อหัวข้องานย่อย",
    "app.error.subtaskNotFound": "ไม่พบงานย่อย",
    "app.error.templateNameRequired": "จำเป็นต้องระบุชื่อเทมเพลต",
    "app.error.recurringTemplateDueOffsetRequired":
      "เทมเพลตแบบทำซ้ำต้องตั้งค่า due offset",
    "app.error.reminderOffsetMustBeEarlier":
      "reminder offset ต้องอยู่ก่อน due offset",
    "app.error.templateNameExists": "มีชื่อเทมเพลตนี้อยู่แล้ว",
    "app.error.invalidBackupPayload": "ข้อมูลแบ็กอัปไม่ถูกต้อง",
    "app.error.unsupportedBackupVersion": "ไม่รองรับเวอร์ชันแบ็กอัปนี้",
    "app.error.invalidBackupPayloadMissingData":
      "ข้อมูลแบ็กอัปไม่ถูกต้อง: ไม่มีส่วน data",
    "app.error.noLatestBackupSnapshot":
      "ไม่พบแบ็กอัปล่าสุด กรุณาส่งออกแบ็กอัปก่อน",
    "app.error.latestBackupSnapshotCorrupted": "แบ็กอัปล่าสุดเสียหาย",
    "common.retry": "ลองอีกครั้ง",
    "common.error.unableRequest": "ไม่สามารถดำเนินการคำขอได้",
    "common.never": "ไม่เคย",
    "common.unknown": "ไม่ทราบ",
    "undo.pendingAction": "รายการที่รออยู่:",
    "undo.more": "+{count} รายการ",
    "undo.window.seconds": "{count} วินาที",
    "undo.button": "ยกเลิก ({time})",
    "quickCapture.title": "บันทึกด่วน",
    "quickCapture.close": "ปิดหน้าบันทึกด่วน",
    "quickCapture.placeholder": "พิมพ์ชื่องานแล้วกดปุ่ม Enter...",
    "quickCapture.hintEsc": "กดปุ่ม Esc เพื่อปิด",
    "quickCapture.saving": "กำลังบันทึก...",
    "quickCapture.save": "บันทึก",
    "manualMerge.title": "ตัวแก้ไขการรวมด้วยตนเอง",
    "manualMerge.useLocal": "ใช้ฝั่งเครื่อง",
    "manualMerge.useRemote": "ใช้ฝั่งเซิร์ฟเวอร์",
    "manualMerge.useCombined": "รวมทั้งสองฝั่ง",
    "manualMerge.appendLocalOnly": "เพิ่มเฉพาะฝั่งเครื่อง",
    "manualMerge.appendRemoteOnly": "เพิ่มเฉพาะฝั่งเซิร์ฟเวอร์",
    "manualMerge.local": "ฝั่งเครื่อง",
    "manualMerge.remote": "ฝั่งเซิร์ฟเวอร์",
    "manualMerge.emptyDiff": "ไม่มีข้อมูลเปรียบเทียบให้แสดง",
    "manualMerge.truncated":
      "ตัดแสดง diff เฉพาะ {count} บรรทัดแรกเพื่อให้อ่านง่าย",
    "manualMerge.mergedContent": "เนื้อหาหลังรวม",
    "manualMerge.cancel": "ยกเลิก",
    "manualMerge.applying": "กำลังใช้งาน...",
    "manualMerge.apply": "ยืนยันการรวม",
    "app.undo.restoreLatestBackup": "กู้คืนแบ็กอัปล่าสุด",
    "app.undo.importBackupNamed": 'นำเข้าแบ็กอัป "{name}"',
    "app.undo.importBackupFile": "นำเข้าไฟล์แบ็กอัป",
    "app.undo.error.backupRestorePending":
      "มีคำสั่งกู้คืนแบ็กอัปที่รอ Undo อยู่แล้ว",
    "app.undo.error.backupImportPending":
      "มีคำสั่งนำเข้าแบ็กอัปที่รอ Undo อยู่แล้ว",
    "app.sync.conflictsResolvedLocally":
      "แก้คอนฟลิกต์ในเครื่องแล้ว กดซิงก์อีกครั้งเพื่อยืนยัน",
    "app.undo.retryConflict": "ลองใหม่คอนฟลิกต์ {id}",
    "app.undo.resolveConflict": "แก้คอนฟลิกต์ {id}",
    "app.undo.error.conflictPending":
      "คอนฟลิกต์นี้มีคำสั่งที่รอการยกเลิก (Undo) อยู่แล้ว",
    "app.undo.deleteTask": "ลบงาน",
    "app.undo.deleteTaskNamed": 'ลบงาน "{name}"',
    "app.undo.error.taskPending":
      "งานนี้มีคำสั่งที่รอการยกเลิก (Undo) อยู่แล้ว",
    "app.undo.deleteProjectNamed": 'ลบโปรเจกต์ "{name}"',
    "app.undo.error.projectPending":
      "โปรเจกต์นี้มีคำสั่งที่รอการยกเลิก (Undo) อยู่แล้ว",
    "app.e2e.syncNeedsAttention": "การซิงก์ต้องการการตรวจสอบ",
    "app.e2e.conflictsDetected": "ตรวจพบคอนฟลิกต์ {count} รายการ",
    "app.e2e.simulatedFailure": "การทดสอบ E2E จำลองความล้มเหลวของการส่งข้อมูล",
    "app.e2e.transport.invalidJson":
      "E2E transport ส่ง JSON ที่ไม่ถูกต้องกลับมา",
    "app.e2e.transport.requestFailed":
      "คำขอ E2E ตัวรับส่งข้อมูลล้มเหลว ({status})",
    "reminder.title": "การแจ้งเตือน SoloStack",
    "reminder.dueAt": "ครบกำหนด {dueAt}",
    "reminder.action.snooze15m": "เลื่อนเตือน 15 นาที",
    "reminder.action.snooze1h": "เลื่อนเตือน 1 ชั่วโมง",
    "reminder.action.snoozeTomorrow": "เลื่อนเตือนไปพรุ่งนี้",
    "taskForm.error.invalidDueFormat": "รูปแบบกำหนดส่งไม่ถูกต้อง",
    "taskForm.error.invalidReminderFormat": "รูปแบบเวลาเตือนไม่ถูกต้อง",
    "taskForm.error.reminderAfterDue": "ต้องตั้งเวลาเตือนก่อนกำหนดส่ง",
    "taskForm.error.recurringNeedsDue": "งานที่ทำซ้ำต้องมีกำหนดส่ง",
    "taskForm.error.recurringTemplateNeedsDue": "เทมเพลตที่ทำซ้ำต้องมีกำหนดส่ง",
    "taskForm.error.naturalParseFailed":
      "ไม่สามารถตีความกำหนดส่งได้ ลองใช้คำเช่น 'พรุ่งนี้ 9โมง' หรือ 'วันจันทร์หน้า'",
    "taskForm.template.word": "เทมเพลต",
    "taskForm.template.defaultName": "เทมเพลตของฉัน",
    "taskForm.template.promptName": "ชื่อเทมเพลต",
    "taskForm.template.deleteConfirm": 'ลบเทมเพลต "{name}" แบบถาวรหรือไม่?',
    "taskForm.project.word": "โปรเจกต์",
    "taskForm.project.promptName": "ชื่อโปรเจกต์",
    "taskForm.title.edit": "แก้ไขงาน",
    "taskForm.title.new": "งานใหม่",
    "taskForm.closeAria": "ปิดฟอร์มงาน",
    "taskForm.field.title": "ชื่อเรื่อง",
    "taskForm.placeholder.title": "งานนี้ต้องทำอะไร?",
    "taskForm.field.description": "คำอธิบาย",
    "taskForm.optional": "ไม่บังคับ",
    "taskForm.placeholder.description": "เพิ่มรายละเอียด...",
    "taskForm.field.notes": "โน้ต",
    "taskForm.badge.markdown": "มาร์กดาวน์",
    "taskForm.mode.edit": "แก้ไข",
    "taskForm.mode.preview": "พรีวิว",
    "taskForm.placeholder.notesMarkdown":
      "ใช้ markdown: # หัวข้อ, - รายการ, **ตัวหนา**, [ลิงก์](https://...)",
    "taskForm.preview.empty":
      "ยังไม่มีข้อมูลพรีวิว เพิ่ม markdown ในโหมดแก้ไขก่อน",
    "taskForm.field.template": "เทมเพลต",
    "taskForm.template.select": "เลือกเทมเพลต...",
    "taskForm.template.apply": "ใช้งาน",
    "taskForm.template.save": "บันทึกเทมเพลต",
    "taskForm.template.saving": "กำลังบันทึก...",
    "taskForm.template.delete": "ลบ",
    "taskForm.template.deleting": "กำลังลบ...",
    "taskForm.field.project": "โปรเจกต์",
    "taskForm.project.none": "ไม่เลือกโปรเจกต์",
    "taskForm.project.new": "ใหม่",
    "taskForm.project.creating": "กำลังสร้าง...",
    "taskForm.field.checklist": "เช็กลิสต์",
    "taskForm.checklist.doneSuffix": "เสร็จแล้ว",
    "taskForm.checklist.placeholder": "เพิ่มรายการเช็กลิสต์...",
    "taskForm.checklist.add": "เพิ่ม",
    "taskForm.checklist.loading": "กำลังโหลดเช็กลิสต์...",
    "taskForm.checklist.empty": "ยังไม่มีรายการเช็กลิสต์",
    "taskForm.field.dueAt": "วันและเวลาครบกำหนด",
    "taskForm.field.reminder": "เตือน",
    "taskForm.field.smartDue": "ป้อนกำหนดส่งอัจฉริยะ",
    "taskForm.badge.beta": "เบตา",
    "taskForm.smartDue.placeholder":
      "พรุ่งนี้ 9โมง, วันจันทร์หน้า, อีก 3 วัน...",
    "taskForm.smartDue.apply": "นำไปใช้",
    "taskForm.smartDue.examples":
      "ตัวอย่าง: พรุ่งนี้ 9โมง, วันจันทร์หน้า, อีก 3 วัน, 2026-03-01 14:30",
    "taskForm.field.repeat": "ทำซ้ำ",
    "taskForm.field.priority": "ความสำคัญ",
    "taskForm.field.importance": "ความสำคัญพิเศษ",
    "taskForm.importance.on": "สำคัญ",
    "taskForm.importance.mark": "ทำเครื่องหมายว่าสำคัญ",
    "taskForm.priority.urgent": "ด่วน",
    "taskForm.priority.normal": "ปกติ",
    "taskForm.priority.low": "ต่ำ",
    "taskForm.status.todo": "ต้องทำ",
    "taskForm.status.doing": "กำลังทำ",
    "taskForm.status.done": "เสร็จแล้ว",
    "taskForm.status.archived": "เก็บถาวร",
    "taskForm.recurrence.none": "ไม่ทำซ้ำ",
    "taskForm.recurrence.daily": "ทุกวัน",
    "taskForm.recurrence.weekly": "ทุกสัปดาห์",
    "taskForm.recurrence.monthly": "ทุกเดือน",
    "taskForm.changelog.title": "การเปลี่ยนแปลงล่าสุด",
    "taskForm.changelog.loading": "กำลังโหลดประวัติการเปลี่ยนแปลง...",
    "taskForm.changelog.empty": "ยังไม่มีประวัติการเปลี่ยนแปลง",
    "taskForm.changelog.field.status": "สถานะ",
    "taskForm.changelog.field.priority": "ความสำคัญ",
    "taskForm.changelog.field.title": "ชื่อเรื่อง",
    "taskForm.changelog.field.description": "คำอธิบาย",
    "taskForm.changelog.field.notes": "โน้ต",
    "taskForm.changelog.field.importance": "ความสำคัญพิเศษ",
    "taskForm.changelog.field.dueAt": "กำหนดส่ง",
    "taskForm.changelog.field.reminder": "การเตือน",
    "taskForm.changelog.field.recurrence": "การทำซ้ำ",
    "taskForm.changelog.field.project": "โปรเจกต์",
    "taskForm.changelog.field.task": "งาน",
    "taskForm.changelog.projectShort": "โปรเจกต์ ({id})",
    "taskForm.changelog.noProject": "ไม่มีโปรเจกต์",
    "taskForm.changelog.emptyValue": "ว่าง",
    "taskForm.changelog.important": "สำคัญ",
    "taskForm.changelog.notImportant": "ไม่สำคัญ",
    "taskForm.changelog.created": "สร้างงานแล้ว: {value}",
    "taskForm.changelog.changed": "{field} เปลี่ยนจาก {from} เป็น {to}",
    "taskForm.relative.justNow": "เมื่อสักครู่",
    "taskForm.relative.minutesAgo": "{count} นาทีที่แล้ว",
    "taskForm.relative.hoursAgo": "{count} ชั่วโมงที่แล้ว",
    "taskForm.relative.daysAgo": "{count} วันที่แล้ว",
    "taskForm.action.cancel": "ยกเลิก",
    "taskForm.action.saveChanges": "บันทึกการเปลี่ยนแปลง",
    "taskForm.action.createTask": "สร้างงาน",
    "projectView.error.projectNameRequired": "จำเป็นต้องระบุชื่อโปรเจกต์",
    "projectView.loadingProjects": "กำลังโหลดโปรเจกต์...",
    "projectView.empty.title": "ยังไม่มีโปรเจกต์",
    "projectView.empty.subtitle":
      "สร้างโปรเจกต์แรกเพื่อจัดกลุ่มงานและติดตามความคืบหน้า",
    "projectView.field.name": "ชื่อ",
    "projectView.field.color": "สี",
    "projectView.field.description": "คำอธิบาย",
    "projectView.placeholder.name": "ชื่อโปรเจกต์",
    "projectView.placeholder.description": "โปรเจกต์นี้ใช้สำหรับอะไร?",
    "projectView.action.clearFilters": "ล้างฟิลเตอร์",
    "projectView.action.close": "ปิด",
    "projectView.action.newProject": "โปรเจกต์ใหม่",
    "projectView.action.cancel": "ยกเลิก",
    "projectView.action.create": "สร้าง",
    "projectView.action.createProject": "สร้างโปรเจกต์",
    "projectView.action.creating": "กำลังสร้าง...",
    "projectView.search.placeholder": "ค้นหาโปรเจกต์...",
    "projectView.search.clear": "ล้างการค้นหาโปรเจกต์",
    "projectView.statusFilter.all": "ทั้งหมด",
    "projectView.statusFilter.active": "กำลังใช้งาน",
    "projectView.statusFilter.completed": "เสร็จสิ้น",
    "projectView.empty.filtered": "ไม่มีโปรเจกต์ที่ตรงกับฟิลเตอร์ปัจจุบัน",
    "projectView.status.active": "กำลังใช้งาน",
    "projectView.status.completed": "เสร็จสิ้น",
    "projectView.metric.done": "เสร็จแล้ว",
    "projectView.metric.overdue": "เลยกำหนด",
    "projectView.metric.open": "เปิดอยู่",
    "projectView.notice.deleteArm":
      'กด "ยืนยันการลบ" เพื่อจัดคิวลบ "{name}" และสามารถ Undo จากแถบ Undo ได้ภายในไม่กี่วินาที',
    "projectView.notice.deleteQueued":
      "จัดคิวลบแล้ว โปรเจกต์นี้จะถูกลบใน {seconds} วินาที หากไม่กด Undo",
    "projectView.error.deletePending":
      "โปรเจกต์นี้มีคำสั่งที่รอการยกเลิก (Undo) อยู่แล้ว",
    "projectView.header.title": "โปรเจกต์",
    "projectView.subtitle.filtered": "แสดง {shown} จาก {total} โปรเจกต์",
    "projectView.subtitle.tracked": "{count} โปรเจกต์ที่ติดตาม",
    "projectView.detail.taskCount": "{count} งานในโปรเจกต์นี้",
    "projectView.action.edit": "แก้ไข",
    "projectView.action.editing": "กำลังแก้ไข...",
    "projectView.action.save": "บันทึก",
    "projectView.action.saving": "กำลังบันทึก...",
    "projectView.action.markActive": "ตั้งเป็นกำลังใช้งาน",
    "projectView.action.markCompleted": "ตั้งเป็นเสร็จสิ้น",
    "projectView.action.delete": "ลบ",
    "projectView.action.confirmDelete": "ยืนยันการลบ",
    "projectView.action.deleting": "กำลังลบ...",
    "projectView.action.queued": "เข้าคิวแล้ว...",
    "projectView.action.newTask": "งานใหม่",
    "projectView.kpi.progress": "ความคืบหน้า",
    "projectView.kpi.total": "ทั้งหมด",
    "projectView.kpi.open": "เปิดอยู่",
    "projectView.kpi.overdue": "เลยกำหนด",
    "projectView.deliveryProgress": "ความคืบหน้าการส่งมอบ",
    "projectView.loadingTasks": "กำลังโหลดงาน...",
    "projectView.empty.tasksInProject": "ยังไม่มีงานในโปรเจกต์นี้",
    "projectView.action.addFirstTask": "เพิ่มงานแรก",
    "projectView.empty.tasksInSection": "ไม่มีงาน",
    "projectView.empty.selectProject": "เลือกโปรเจกต์เพื่อดูรายละเอียด",
    "schedule.title.today": "วันนี้",
    "schedule.title.upcoming": "ถัดไป",
    "schedule.subtitle.today": "{count} งานที่ครบกำหนดวันนี้หรือเลยกำหนดแล้ว",
    "schedule.subtitle.upcoming": "{count} งานที่ครบกำหนดใน 7 วันข้างหน้า",
    "schedule.empty.today.title": "ไม่มีงานที่ครบกำหนดวันนี้",
    "schedule.empty.today.desc":
      "วางแผนงานถัดไปและตั้งวันครบกำหนดเพื่อให้แสดงที่นี่",
    "schedule.empty.upcoming.title": "ไม่มีงานที่กำลังจะมาถึง",
    "schedule.empty.upcoming.desc":
      "งานที่มีวันครบกำหนดใน 7 วันข้างหน้าจะแสดงที่นี่",
    "schedule.action.createTask": "สร้างงาน",
    "schedule.section.overdue": "เลยกำหนด",
    "schedule.section.dueToday": "ครบกำหนดวันนี้",
    "schedule.day.noDate": "ไม่มีวันที่",
    "shortcutHelp.aria": "คีย์ลัดแป้นพิมพ์",
    "shortcutHelp.title": "คีย์ลัดแป้นพิมพ์",
    "shortcutHelp.closeAria": "ปิดหน้าคีย์ลัด",
    "shortcutHelp.close": "ปิด",
    "shortcutHelp.subtitle": "คำสั่งลัดเพื่อให้ทำงานประจำวันได้เร็วขึ้น",
    "shortcutHelp.row.newTask": "สร้างงานใหม่",
    "shortcutHelp.row.commandPalette": "เปิดพาเลตคำสั่ง",
    "shortcutHelp.row.openSettings": "เปิดหน้าตั้งค่า",
    "shortcutHelp.row.openConflictCenter": "เปิดศูนย์จัดการคอนฟลิกต์",
    "shortcutHelp.row.syncNow": "สั่งซิงก์ทันที",
    "shortcutHelp.row.openShortcutHelp": "เปิดคู่มือคีย์ลัด",
    "shortcutHelp.row.closeUi": "ปิดหน้าต่าง/พาเลต/ฟอร์ม",
    "shortcutHelp.combo.newTask": "Cmd/Ctrl + N",
    "shortcutHelp.combo.commandPalette": "Cmd/Ctrl + K",
    "shortcutHelp.combo.openSettings": "Cmd/Ctrl + ,",
    "shortcutHelp.combo.openConflictCenter": "Cmd/Ctrl + Shift + C",
    "shortcutHelp.combo.syncNow": "Cmd/Ctrl + Shift + S",
    "shortcutHelp.combo.openShortcutHelp": "?",
    "shortcutHelp.combo.closeUi": "Esc",
    "commandPalette.group.actions": "การทำงาน",
    "commandPalette.group.navigation": "นำทาง",
    "commandPalette.group.tasks": "งาน",
    "commandPalette.input.placeholder": "พิมพ์คำสั่ง...",
    "commandPalette.empty": "ไม่พบคำสั่งที่ตรงกัน",
    "commandPalette.footerHint":
      "กด Enter เพื่อเรียกใช้ • ปุ่มลูกศรเพื่อเลื่อน • Esc เพื่อปิด",
    "commandPalette.action.createTask": "สร้างงานใหม่",
    "commandPalette.action.quickCapture": "เปิดบันทึกด่วน",
    "commandPalette.action.syncNow": "ซิงก์ตอนนี้",
    "commandPalette.action.exportBackup": "ส่งออกแบ็กอัป",
    "commandPalette.action.openSyncDiagnostics": "เปิดการวิเคราะห์ซิงก์",
    "commandPalette.action.openRestorePreflight": "เปิดการตรวจสอบก่อนกู้คืน",
    "commandPalette.shortcut.quickCapture": "Cmd/Ctrl + Shift + N",
    "commandPalette.nav.goTo": "ไปที่ {view}",
    "commandPalette.meta.current": "หน้าปัจจุบัน",
    "commandPalette.task.edit": "แก้ไขงาน: {title}",
    "commandPalette.task.setTodo": "ตั้งเป็น ต้องทำ: {title}",
    "commandPalette.task.setDoing": "ตั้งเป็น กำลังทำ: {title}",
    "commandPalette.task.setDone": "ตั้งเป็น เสร็จแล้ว: {title}",
    "conflictCenter.title": "ศูนย์จัดการคอนฟลิกต์",
    "conflictCenter.subtitle":
      "ตรวจสอบ แก้ไข และส่งออกคอนฟลิกต์ซิงก์อย่างปลอดภัย",
    "conflictCenter.action.openSyncSettings": "เปิดตั้งค่าซิงก์",
    "conflictCenter.action.exporting": "กำลังส่งออก...",
    "conflictCenter.action.exportReport": "ส่งออกรายงาน",
    "conflictCenter.action.keepLocal": "เก็บฝั่งเครื่อง",
    "conflictCenter.action.keepRemote": "เก็บฝั่งเซิร์ฟเวอร์",
    "conflictCenter.action.manualMerge": "รวมแบบกำหนดเอง",
    "conflictCenter.action.applyDefault": "ใช้ค่าเริ่มต้น",
    "conflictCenter.action.details": "รายละเอียด",
    "conflictCenter.loading": "กำลังโหลดคอนฟลิกต์...",
    "conflictCenter.empty.title": "ไม่มีคอนฟลิกต์ที่เปิดอยู่",
    "conflictCenter.empty.subtitle":
      "สถานะซิงก์ปกติ คอนฟลิกต์ใหม่จะแสดงที่นี่เมื่อระบบตรวจพบ",
    "conflictCenter.selected": "เลือกอยู่",
    "conflictCenter.meta.detected": "ตรวจพบ",
    "conflictCenter.detail.title": "รายละเอียดคอนฟลิกต์",
    "conflictCenter.detail.localPayload": "ข้อมูลฝั่งเครื่อง",
    "conflictCenter.detail.remotePayload": "ข้อมูลฝั่งเซิร์ฟเวอร์",
    "conflictCenter.detail.timeline": "ไทม์ไลน์",
    "conflictCenter.detail.loadingTimeline": "กำลังโหลดไทม์ไลน์...",
    "conflictCenter.detail.noEvents": "ยังไม่มีอีเวนต์",
    "conflictCenter.error.mergeEmpty": "เนื้อหาที่รวมแล้วต้องไม่ว่างเปล่า",
    "conflictCenter.feedback.retryQueued":
      "จัดคิวลองคอนฟลิกต์ใหม่แล้ว สามารถ Undo ได้ภายใน 5 วินาที",
    "conflictCenter.feedback.resolveQueued":
      "จัดคิวการแก้คอนฟลิกต์แล้ว สามารถ Undo ได้ภายใน 5 วินาที",
    "conflictCenter.feedback.exported":
      "ส่งออกรายงานคอนฟลิกต์แล้ว ({count} รายการ)",
    "conflictCenter.confirm.retry":
      "ระบบจะจัดคิวคอนฟลิกต์นี้ใหม่ในรอบซิงก์ถัดไป ต้องการดำเนินการต่อหรือไม่?",
    "conflictCenter.defaultStrategy": "กลยุทธ์ค่าเริ่มต้น: {strategy}",
    "conflictCenter.strategy.keepLocal": "เก็บฝั่งเครื่อง",
    "conflictCenter.strategy.keepRemote": "เก็บฝั่งเซิร์ฟเวอร์",
    "conflictCenter.strategy.manualMerge": "รวมแบบกำหนดเอง",
    "conflictCenter.entity.project": "โปรเจกต์",
    "conflictCenter.entity.task": "งาน",
    "conflictCenter.entity.taskSubtask": "รายการเช็กลิสต์",
    "conflictCenter.entity.taskTemplate": "เทมเพลตงาน",
    "conflictCenter.entity.setting": "การตั้งค่า",
    "conflictCenter.reason.missingProjectName": "ข้อมูลขาเข้าไม่มีชื่อโปรเจกต์",
    "conflictCenter.reason.missingTaskTitle": "ข้อมูลขาเข้าไม่มีชื่องาน",
    "conflictCenter.reason.taskNotesCollision":
      "โน้ตของงานจากข้อมูลขาเข้าชนกับโน้ตที่แก้ไขในเครื่อง",
    "conflictCenter.reason.taskProjectNotFound":
      "งานจากข้อมูลขาเข้าอ้างถึงโปรเจกต์ที่ไม่มีอยู่ในเครื่อง",
    "conflictCenter.reason.invalidSubtaskPayload":
      "ข้อมูล subtask ต้องมีทั้ง task_id และ title",
    "conflictCenter.reason.subtaskTaskNotFound":
      "subtask จากข้อมูลขาเข้าอ้างถึง task ที่ไม่มีอยู่ในเครื่อง",
    "conflictCenter.reason.missingTemplateName":
      "ข้อมูลขาเข้าไม่มีชื่อเทมเพลตงาน",
    "conflictCenter.type.deleteVsUpdate": "ลบชนกับแก้ไข",
    "conflictCenter.type.notesCollision": "โน้ตชนกัน",
    "conflictCenter.type.validationError": "ข้อมูลไม่ผ่านการตรวจสอบ",
    "conflictCenter.type.fieldConflict": "ฟิลด์ชนกัน",
    "conflictCenter.event.detected": "ตรวจพบ",
    "conflictCenter.event.resolved": "แก้ไขแล้ว",
    "conflictCenter.event.ignored": "ละเว้น",
    "conflictCenter.event.retried": "ลองใหม่แล้ว",
    "conflictCenter.event.exported": "ส่งออกแล้ว",
    "conflictCenter.payload.empty": "(ว่าง)",
    "weeklyReview.error.unableLoad": "ไม่สามารถโหลดสรุปรายสัปดาห์ได้",
    "weeklyReview.error.title": "โหลดสรุปรายสัปดาห์ไม่สำเร็จ",
    "weeklyReview.range.thisWeek": "สัปดาห์นี้",
    "weeklyReview.date.unknown": "ไม่ทราบเวลา",
    "weeklyReview.date.noDue": "ไม่มีวันครบกำหนด",
    "weeklyReview.date.invalidDue": "วันครบกำหนดไม่ถูกต้อง",
    "weeklyReview.title": "ทบทวนรายสัปดาห์",
    "weeklyReview.updatedAt": "อัปเดต {time}",
    "weeklyReview.action.refresh": "รีเฟรช",
    "weeklyReview.action.refreshing": "กำลังรีเฟรช...",
    "weeklyReview.headline.overdue":
      "มีงานเลยกำหนด {count} งานที่ต้องเร่งจัดการ",
    "weeklyReview.headline.momentum":
      "สัปดาห์นี้ปิดงานได้มากกว่างานใหม่ {count} งาน",
    "weeklyReview.headline.balanced":
      "สัปดาห์นี้สมดุลดี งานที่เสร็จและงานใหม่ใกล้เคียงกัน",
    "weeklyReview.headline.backlogGrowth":
      "งานค้างเพิ่มขึ้น {count} งานในสัปดาห์นี้ ควรโฟกัสงานสำคัญก่อน",
    "weeklyReview.word.task": "งาน",
    "weeklyReview.word.tasks": "งาน",
    "weeklyReview.stat.completed.label": "เสร็จแล้ว",
    "weeklyReview.stat.completed.subtitle": "ย้ายเป็นเสร็จแล้วในสัปดาห์นี้",
    "weeklyReview.stat.pending.label": "ค้างอยู่",
    "weeklyReview.stat.pending.subtitle": "ยังเปิดและไม่เลยกำหนด",
    "weeklyReview.stat.overdue.label": "เลยกำหนด",
    "weeklyReview.stat.overdue.subtitle": "ต้องเร่งจัดการทันที",
    "weeklyReview.stat.created.label": "สร้างใหม่",
    "weeklyReview.stat.created.subtitle": "งานใหม่ที่เพิ่มในสัปดาห์นี้",
    "weeklyReview.progress.completionRatio": "อัตราความสำเร็จ",
    "weeklyReview.progress.carryOverOpen": "{count} งานค้างจากรอบก่อน",
    "weeklyReview.progress.dueThisWeekOpen":
      "{count} งานครบกำหนดสัปดาห์นี้และยังเปิดอยู่",
    "weeklyReview.section.completed.title": "งานที่เสร็จสัปดาห์นี้",
    "weeklyReview.section.completed.shown": "แสดง {count}",
    "weeklyReview.section.completed.empty": "ยังไม่มีงานที่เสร็จในสัปดาห์นี้",
    "weeklyReview.section.completed.doneAt": "เสร็จเมื่อ {time}",
    "weeklyReview.section.overdue.title": "เลยกำหนด",
    "weeklyReview.section.overdue.total": "ทั้งหมด {count}",
    "weeklyReview.section.overdue.empty": "ไม่มีงานเลยกำหนด รักษาแนวโน้มนี้ไว้",
    "weeklyReview.section.overdue.dueAt": "ครบกำหนด {time}",
    "weeklyReview.section.pending.title": "งานค้างที่ควรโฟกัส",
    "weeklyReview.section.pending.total": "ทั้งหมด {count}",
    "weeklyReview.section.pending.empty": "ไม่มีงานค้างในคิวตอนนี้",
    "weeklyReview.section.pending.createTask": "สร้างงาน",
    "weeklyReview.action.start": "เริ่ม",
    "weeklyReview.action.pause": "พัก",
    "taskFilters.due.all": "ครบกำหนดทั้งหมด",
    "taskFilters.due.overdue": "เลยกำหนด",
    "taskFilters.due.today": "วันนี้",
    "taskFilters.due.next7Days": "7 วันถัดไป",
    "taskFilters.due.noDue": "ไม่มีวันครบกำหนด",
    "taskFilters.sort.createdDesc": "สร้างล่าสุด",
    "taskFilters.sort.updatedDesc": "อัปเดตล่าสุด",
    "taskFilters.sort.dueAsc": "วันครบกำหนด (เร็วสุด)",
    "taskFilters.sort.priorityDesc": "ความสำคัญ (สูงไปต่ำ)",
    "taskFilters.sort.titleAsc": "ชื่อเรื่อง (ก-ฮ/A-Z)",
    "taskFilters.prompt.saveViewName": "ตั้งชื่อมุมมองที่บันทึกไว้",
    "taskFilters.prompt.defaultViewName": "มุมมองของฉัน",
    "taskFilters.search.placeholder": "ค้นหาจากชื่อหรือตัวอธิบาย...",
    "taskFilters.search.clear": "ล้างคำค้นหา",
    "taskFilters.action.saveView": "บันทึกมุมมอง",
    "taskFilters.action.clear": "ล้าง",
    "taskFilters.action.showFilters": "แสดงฟิลเตอร์",
    "taskFilters.action.hideFilters": "ซ่อนฟิลเตอร์",
    "taskFilters.summary.showing": "แสดง {shown} / {total}",
    "taskFilters.label.project": "โปรเจกต์",
    "taskFilters.label.status": "สถานะ",
    "taskFilters.label.priority": "ความสำคัญ",
    "taskFilters.label.due": "กำหนดส่ง",
    "taskFilters.label.sort": "เรียง",
    "taskFilters.label.important": "สำคัญ",
    "taskFilters.label.savedViews": "มุมมองที่บันทึกไว้",
    "taskFilters.bulk.selectShown": "เลือกที่แสดงอยู่",
    "taskFilters.bulk.unselectShown": "ยกเลิกที่แสดงอยู่",
    "taskFilters.bulk.clearSelected": "ล้างรายการที่เลือก",
    "taskFilters.bulk.selectedCount": "เลือกแล้ว {count} รายการ",
    "taskFilters.bulk.title": "แก้ไขหลายงาน",
    "taskFilters.bulk.statusPlaceholder": "ตั้งค่าสถานะ...",
    "taskFilters.bulk.priorityPlaceholder": "ตั้งค่าความสำคัญ...",
    "taskFilters.bulk.projectPlaceholder": "ย้ายไปโปรเจกต์...",
    "taskFilters.bulk.projectClear": "ไม่ผูกโปรเจกต์",
    "taskFilters.bulk.markImportant": "ทำเป็นงานสำคัญ",
    "taskFilters.bulk.unmarkImportant": "ยกเลิกงานสำคัญ",
    "taskFilters.bulk.duePlaceholder": "ตั้งกำหนดส่ง...",
    "taskFilters.bulk.setDue": "ยืนยันกำหนดส่ง",
    "taskFilters.bulk.clearDue": "ล้างกำหนดส่ง",
    "taskFilters.bulk.reminderPlaceholder": "ตั้งเตือน...",
    "taskFilters.bulk.setReminder": "ยืนยันเตือน",
    "taskFilters.bulk.clearReminder": "ล้างเตือน",
    "taskFilters.bulk.recurrencePlaceholder": "ตั้งการทำซ้ำ...",
    "taskFilters.bulk.confirm.title": "ยืนยันแก้ไข {count} งานที่เลือก?",
    "taskFilters.bulk.confirm.question":
      "การกระทำนี้จะแก้ไขหลายงานพร้อมกัน ต้องการทำต่อหรือไม่?",
    "taskFilters.empty.noProjects": "ยังไม่มีโปรเจกต์สำหรับใช้กรอง",
    "taskFilters.empty.savedViews": "บันทึกชุดฟิลเตอร์ที่ใช้บ่อยไว้ที่นี่",
    "taskFilters.savedView.applyTitle": "เรียกใช้มุมมองที่บันทึกไว้",
    "taskCard.action.delete": "ลบ",
    "taskCard.action.moveTo": "ย้ายไป {status}",
    "taskCard.action.selectTask": "เลือกงานนี้",
    "taskCard.action.unselectTask": "ยกเลิกเลือกงานนี้",
    "taskCard.focus.start": "เริ่มจับเวลาโฟกัส",
    "taskCard.focus.stop": "หยุดและบันทึกโฟกัส",
    "taskCard.focus.runningAnotherTask": "กำลังจับเวลาโฟกัสอยู่ในงานอื่น",
    "taskCard.focus.elapsed": "โฟกัส {duration}",
    "taskCard.due.overdue": "เลยกำหนด • {date} {time}",
    "taskCard.due.today": "ครบกำหนดวันนี้ • {time}",
    "taskCard.due.default": "ครบกำหนด • {date} {time}",
    "taskCard.recurrence.daily": "ทำซ้ำทุกวัน",
    "taskCard.recurrence.weekly": "ทำซ้ำทุกสัปดาห์",
    "taskCard.recurrence.monthly": "ทำซ้ำทุกเดือน",
    "taskCard.checklist.progress": "เช็กลิสต์ {done}/{total}",
    "calendar.title": "ปฏิทิน",
    "calendar.subtitle.withDueTasks": "{count} งานที่มีวันครบกำหนด",
    "calendar.action.previous": "ก่อนหน้า",
    "calendar.action.next": "ถัดไป",
    "calendar.action.today": "วันนี้",
    "calendar.mode.month": "เดือน",
    "calendar.mode.week": "สัปดาห์",
    "calendar.empty.noDueTasksOnDay": "ไม่มีงานครบกำหนดในวันนี้",
    "calendar.error.unableLoadData": "ไม่สามารถโหลดข้อมูลปฏิทินได้",
    "dashboard.title": "แดชบอร์ด",
    "dashboard.subtitle": "ภาพรวมประสิทธิภาพการทำงานของคุณ",
    "dashboard.error.title": "โหลดแดชบอร์ดไม่สำเร็จ",
    "dashboard.error.tryAgain": "กรุณาลองใหม่อีกครั้ง",
    "dashboard.stat.totalTasks": "งานทั้งหมด",
    "dashboard.stat.completed": "เสร็จแล้ว",
    "dashboard.momentum.dueToday": "ครบกำหนดวันนี้",
    "dashboard.momentum.overdue": "เลยกำหนด",
    "dashboard.momentum.completedThisWeek": "เสร็จสัปดาห์นี้",
    "dashboard.progress.overallCompletion": "ความคืบหน้ารวม",
    "dashboard.empty.title": "พร้อมเริ่มทำงานให้มีประสิทธิภาพหรือยัง?",
    "dashboard.empty.description": "สร้างงานแรกของคุณจากปุ่มด้านข้างหรือกด",
    "dashboard.empty.shortcut": "Cmd/Ctrl+N",
    "taskBoard.title": "บอร์ด",
    "taskBoard.subtitle": "{tasks} งานใน {columns} คอลัมน์",
    "taskBoard.action.addTask": "เพิ่มงาน",
    "taskBoard.empty.noTasks": "ยังไม่มีงาน",
    "settings.title": "ตั้งค่า",
    "settings.subtitle":
      "จัดการการเตือน สิทธิ์การแจ้งเตือน และความปลอดภัยข้อมูลภายในเครื่อง",
    "settings.language.title": "ภาษา",
    "settings.language.desc":
      "เลือกภาษาที่ใช้แสดงผลในแอป (TH/EN) การเปลี่ยนแปลงมีผลทันที",
    "settings.language.field": "ภาษาแสดงผล",
    "settings.language.save": "บันทึกภาษา",
    "settings.language.saving": "กำลังบันทึก...",
    "settings.language.saved": "บันทึกภาษาสำเร็จแล้ว",
    "settings.language.error.same": "ภาษานี้ถูกเลือกอยู่แล้ว",
    "settings.language.option.en": "อังกฤษ (English)",
    "settings.language.option.th": "ไทย",
    "settings.reminders.title": "การเตือนงาน",
    "settings.reminders.desc": "เปิดหรือปิดการแจ้งเตือนงานทั้งระบบ",
    "settings.reminders.toggle.title": "เปิดใช้งานการเตือน",
    "settings.reminders.toggle.desc":
      "เมื่อเปิดใช้งาน งานที่ตั้งเวลาเตือนสามารถส่งการแจ้งเตือนบนเดสก์ท็อปได้",
    "settings.permission.title": "สิทธิ์การแจ้งเตือน",
    "settings.permission.desc":
      "ตรวจสอบสถานะสิทธิ์ปัจจุบันและรีเซ็ตแคช/ประวัติการอนุญาต",
    "settings.permission.state.granted": "อนุญาตแล้ว",
    "settings.permission.state.denied": "ถูกปฏิเสธ",
    "settings.permission.action.request": "ขอสิทธิ์",
    "settings.permission.action.refresh": "รีเฟรชสถานะ",
    "settings.permission.action.reset": "รีเซ็ตสิทธิ์ + ประวัติ",
    "settings.permission.feedback.enabled": "เปิดการแจ้งเตือนแล้ว",
    "settings.permission.feedback.notGranted":
      "ยังไม่ได้รับสิทธิ์ อาจต้องไปอนุญาตในตั้งค่าระบบปฏิบัติการ",
    "settings.permission.feedback.reset":
      "รีเซ็ตแคชสิทธิ์และประวัติการเตือนแล้ว งานเดิมสามารถแจ้งเตือนได้อีกครั้ง",
    "settings.sync.title": "ซิงก์",
    "settings.sync.desc": "สั่งซิงก์ทันทีและตรวจสอบสถานะซิงก์ล่าสุด",
    "settings.sync.lastSynced": "ซิงก์ล่าสุด: {time}",
    "settings.sync.localOnlyHint":
      "กำลังใช้โหมดเฉพาะเครื่อง ไม่ต้องมีเซิร์ฟเวอร์หากใช้งานเครื่องเดียว",
    "settings.sync.transportHint":
      "หากต้องการซิงก์ข้ามอุปกรณ์ ให้ตั้งค่าปลายทางทั้งสองช่องด้านล่าง",
    "settings.sync.action.syncing": "กำลังซิงก์...",
    "settings.sync.action.syncNow": "ซิงก์ตอนนี้",
    "settings.sync.action.retryLastFailed": "ลองซิงก์รอบที่ล้มเหลวอีกครั้ง",
    "settings.sync.action.saveEndpoints": "บันทึกปลายทางซิงก์",
    "settings.sync.action.saving": "กำลังบันทึก...",
    "settings.sync.config.error.requireBoth":
      "ต้องใส่ทั้ง URL ส่งข้อมูลขึ้น และ URL ดึงข้อมูลลง หรือปล่อยว่างทั้งคู่",
    "settings.sync.config.error.invalidPush":
      "URL ส่งข้อมูลขึ้นต้องเป็น URL แบบ http(s) ที่ถูกต้อง",
    "settings.sync.config.error.invalidPull":
      "URL ดึงข้อมูลลงต้องเป็น URL แบบ http(s) ที่ถูกต้อง",
    "settings.sync.config.error.invalidServerBase":
      "Server Base URL ต้องเป็น URL แบบ http(s) ที่ถูกต้อง",
    "settings.sync.config.feedback.saved": "บันทึกปลายทางซิงก์แล้ว",
    "settings.sync.config.feedback.cleared":
      "ล้างปลายทางซิงก์แล้ว แอปจะทำงานแบบเฉพาะเครื่อง",
    "settings.sync.config.feedback.serverApplied":
      "นำ Server Base URL ไปเติมปลายทางส่งขึ้น/ดึงลงให้อัตโนมัติแล้ว",
    "settings.sync.config.feedback.localhostApplied":
      "เติมค่า localhost preset (127.0.0.1:8787) ให้ปลายทางส่งขึ้น/ดึงลงแล้ว",
    "settings.sync.provider.title": "ผู้ให้บริการซิงก์",
    "settings.sync.provider.desc":
      "เลือกผู้ให้บริการจากหน้าแอป โดยสัญญาการซิงก์หลักยังคงไม่ผูกผู้ให้บริการ",
    "settings.sync.provider.field": "ผู้ให้บริการ",
    "settings.sync.provider.authRequirement": "ข้อกำหนดการยืนยันตัวตน: {value}",
    "settings.sync.provider.endpointMode": "โหมดปลายทาง: {value}",
    "settings.sync.provider.endpointMode.managed": "จัดการโดยระบบ",
    "settings.sync.provider.endpointMode.custom": "กำหนดเอง",
    "settings.sync.provider.save": "บันทึกผู้ให้บริการ",
    "settings.sync.provider.managed.title": "การตั้งค่า Managed Connector",
    "settings.sync.provider.managed.desc":
      "การตั้งค่าทดลองสำหรับเกตเวย์ตัวเชื่อมต่อแบบระบบจัดการและโทเค็น OAuth",
    "settings.sync.provider.managed.securityHint":
      "โทเค็นที่อ่อนไหวจะไม่บันทึกลง SQLite/backup และใน Tauri desktop/iOS/Android จะเก็บใน secure keystore ของระบบปฏิบัติการ (runtime อื่นจะ fallback เป็นหน่วยความจำเฉพาะ session)",
    "settings.sync.provider.managed.baseUrl": "Base URL ของ Connector",
    "settings.sync.provider.managed.baseUrlPlaceholder":
      "https://connector.example.com",
    "settings.sync.provider.managed.accessToken": "Access Token",
    "settings.sync.provider.managed.tokenType": "ประเภทโทเค็น",
    "settings.sync.provider.managed.refreshToken": "Refresh Token",
    "settings.sync.provider.managed.refreshUrl": "URL รีเฟรชโทเค็น",
    "settings.sync.provider.managed.expiresAt":
      "เวลาหมดอายุ Access Token (ISO)",
    "settings.sync.provider.managed.expiresAtPlaceholder":
      "2026-01-01T00:00:00.000Z",
    "settings.sync.provider.managed.scope": "OAuth Scope",
    "settings.sync.provider.managed.clientId": "Client ID",
    "settings.sync.provider.managed.clientSecret": "Client Secret",
    "settings.sync.provider.managed.test.action": "ทดสอบ Connector",
    "settings.sync.provider.managed.test.testing": "กำลังทดสอบ Connector...",
    "settings.sync.provider.managed.test.feedback.success":
      "เชื่อมต่อ {provider} connector ได้",
    "settings.sync.provider.managed.test.error.unsupported":
      "ผู้ให้บริการที่เลือกไม่รองรับการทดสอบ managed connector",
    "settings.sync.provider.managed.test.error.notConfigured":
      "โปรดตั้งค่า Connector Base URL ก่อนทดสอบ",
    "settings.sync.provider.managed.secureStoreTest.action":
      "ตรวจสอบ Secure Store",
    "settings.sync.provider.managed.secureStoreTest.testing":
      "กำลังตรวจสอบ Secure Store...",
    "settings.sync.provider.managed.secureStoreTest.feedback.success":
      "การทดสอบ Secure Store ผ่าน ({backend})",
    "settings.sync.provider.managed.secureStoreTest.error.unavailable":
      "Secure Store ไม่พร้อมใช้งานใน runtime นี้ ({backend})",
    "settings.sync.provider.managed.secureStoreTest.error.failed":
      "การทดสอบ Secure Store ล้มเหลว ({backend}): {detail}",
    "settings.sync.provider.feedback.saved": "บันทึกผู้ให้บริการซิงก์แล้ว",
    "settings.sync.provider.endpointModeHint.managed":
      "เลือกผู้ให้บริการแบบระบบจัดการแล้ว (รุ่นปัจจุบันยังใช้ URL แบบกำหนดเองอยู่)",
    "settings.sync.provider.endpointModeHint.custom":
      "ต้องใช้ปลายทางแบบกำหนดเอง",
    "settings.sync.provider.serverBaseUrl": "Server Base URL",
    "settings.sync.provider.serverBaseUrlPlaceholder":
      "http://127.0.0.1:8787 หรือ https://sync.example.com",
    "settings.sync.provider.serverHelper":
      "ตั้ง URL ของ server ครั้งเดียวแล้วกด Apply เพื่อเติม URL ส่งขึ้น/ดึงลงอัตโนมัติ (ไม่จำเป็นต้องใส่ scheme: localhost/LAN จะใช้ http, host อื่นจะใช้ https)",
    "settings.sync.provider.serverApply": "Apply Server URL",
    "settings.sync.provider.serverUseLocalhost": "ใช้ Localhost Preset",
    "settings.sync.provider.pushUrl": "URL ส่งข้อมูลขึ้น",
    "settings.sync.provider.pullUrl": "URL ดึงข้อมูลลง",
    "settings.sync.provider.pushPlaceholder":
      "https://sync.example.com/v1/sync/push",
    "settings.sync.provider.pullPlaceholder":
      "https://sync.example.com/v1/sync/pull",
    "settings.sync.provider.capability.provider_neutral.label":
      "ไม่ผูกผู้ให้บริการ",
    "settings.sync.provider.capability.provider_neutral.summary":
      "ใช้ปลายทางส่งขึ้น/ดึงลงที่คุณควบคุมเอง",
    "settings.sync.provider.capability.provider_neutral.auth":
      "ไม่ต้องมีบัญชีผู้ให้บริการ",
    "settings.sync.provider.capability.provider_neutral.warning1":
      "ต้องตั้งทั้ง URL ส่งข้อมูลขึ้นและ URL ดึงข้อมูลลง",
    "settings.sync.provider.capability.provider_neutral.warning2":
      "เหมาะกับการใช้ซิงก์เกตเวย์ที่โฮสต์เอง",
    "settings.sync.provider.capability.google_appdata.label": "Google AppData",
    "settings.sync.provider.capability.google_appdata.summary":
      "ตัวเชื่อมต่อ Google Drive appDataFolder แบบระบบจัดการ",
    "settings.sync.provider.capability.google_appdata.auth":
      "ต้องใช้ Google OAuth",
    "settings.sync.provider.capability.google_appdata.warning1":
      "กำลังทยอยเปิดใช้งานตัวเชื่อมต่อแบบระบบจัดการ; ตอนนี้ยังใช้ URL แบบกำหนดเองอยู่",
    "settings.sync.provider.capability.google_appdata.warning2":
      "อาจได้รับผลจากโควตา/อัตราจำกัดของ Google API",
    "settings.sync.provider.capability.onedrive_approot.label":
      "Microsoft OneDrive AppRoot",
    "settings.sync.provider.capability.onedrive_approot.summary":
      "ตัวเชื่อมต่อ OneDrive AppRoot แบบระบบจัดการ",
    "settings.sync.provider.capability.onedrive_approot.auth":
      "ต้องใช้ Microsoft OAuth",
    "settings.sync.provider.capability.onedrive_approot.warning1":
      "กำลังทยอยเปิดใช้งานตัวเชื่อมต่อแบบระบบจัดการ; ตอนนี้ยังใช้ URL แบบกำหนดเองอยู่",
    "settings.sync.provider.capability.onedrive_approot.warning2":
      "การจำกัดอัตรา (throttle) ของ Graph API อาจทำให้การลองใหม่ช้าลง",
    "settings.sync.provider.capability.icloud_cloudkit.label":
      "Apple iCloud CloudKit",
    "settings.sync.provider.capability.icloud_cloudkit.summary":
      "ตัวเชื่อมต่อ CloudKit แบบระบบจัดการ",
    "settings.sync.provider.capability.icloud_cloudkit.auth":
      "ต้องใช้ Apple ID และอนุญาต iCloud",
    "settings.sync.provider.capability.icloud_cloudkit.warning1":
      "กำลังทยอยเปิดใช้งานตัวเชื่อมต่อแบบระบบจัดการ; ตอนนี้ยังใช้ URL แบบกำหนดเองอยู่",
    "settings.sync.provider.capability.icloud_cloudkit.warning2":
      "อาจมีข้อจำกัดด้านแพลตฟอร์มหรือบัญชีนอกระบบ Apple",
    "settings.sync.provider.capability.solostack_cloud_aws.label":
      "SoloStack Cloud (AWS)",
    "settings.sync.provider.capability.solostack_cloud_aws.summary":
      "ปลายทางแบบระบบจัดการที่โฮสต์โดย SoloStack",
    "settings.sync.provider.capability.solostack_cloud_aws.auth":
      "ต้องมีบัญชี SoloStack Cloud",
    "settings.sync.provider.capability.solostack_cloud_aws.warning1":
      "ความพร้อมใช้งานอาจต่างกันตามภูมิภาคระหว่างช่วงเปิดใช้งานแบบค่อยเป็นค่อยไป",
    "settings.sync.provider.capability.solostack_cloud_aws.warning2":
      "เมื่อเครือข่ายมีปัญหา ระบบจะถอยกลับเป็นการลองใหม่แบบเฉพาะเครื่อง",
    "settings.sync.runtime.title": "โปรไฟล์รันไทม์การซิงก์",
    "settings.sync.runtime.desc":
      "ปรับพฤติกรรมซิงก์ให้เหมาะกับงานบนเดสก์ท็อป/มือถือเบตา",
    "settings.sync.runtime.profile.desktop": "เดสก์ท็อป",
    "settings.sync.runtime.profile.mobile": "มือถือเบตา",
    "settings.sync.runtime.profile.custom": "กำหนดเอง",
    "settings.sync.runtime.field.profile": "โปรไฟล์",
    "settings.sync.runtime.field.foreground": "ช่วงเวลาหน้าแอป (วินาที)",
    "settings.sync.runtime.field.background": "ช่วงเวลาฉากหลัง (วินาที)",
    "settings.sync.runtime.field.pushLimit": "ขีดจำกัดการส่งขึ้น",
    "settings.sync.runtime.field.pullLimit": "ขีดจำกัดการดึงลง",
    "settings.sync.runtime.field.maxPullPages": "จำนวนหน้าดึงลงสูงสุด",
    "settings.sync.runtime.action.desktopPreset": "พรีเซ็ตเดสก์ท็อป",
    "settings.sync.runtime.action.mobilePreset": "พรีเซ็ตมือถือเบตา",
    "settings.sync.runtime.action.resetRecommended": "รีเซ็ตเป็นค่าที่แนะนำ",
    "settings.sync.runtime.action.save": "บันทึกรันไทม์",
    "settings.sync.runtime.validation.invalidInt":
      "ทุกช่องของรันไทม์ต้องเป็นจำนวนเต็มที่ถูกต้อง",
    "settings.sync.runtime.validation.foregroundRange":
      "ช่วงเวลาหน้าแอปต้องอยู่ระหว่าง 15 ถึง 3600 วินาที",
    "settings.sync.runtime.validation.backgroundRange":
      "ช่วงเวลาฉากหลังต้องอยู่ระหว่าง 30 ถึง 7200 วินาที",
    "settings.sync.runtime.validation.backgroundGte":
      "ช่วงเวลาฉากหลังต้องมากกว่าหรือเท่ากับช่วงเวลาหน้าแอป",
    "settings.sync.runtime.validation.pushRange":
      "ขีดจำกัดการส่งขึ้นต้องอยู่ระหว่าง 20 ถึง 500",
    "settings.sync.runtime.validation.pullRange":
      "ขีดจำกัดการดึงลงต้องอยู่ระหว่าง 20 ถึง 500",
    "settings.sync.runtime.validation.maxPullPagesRange":
      "จำนวนหน้าดึงลงสูงสุดต้องอยู่ระหว่าง 1 ถึง 20",
    "settings.sync.runtime.validation.incomplete": "ค่ารันไทม์ยังไม่ครบถ้วน",
    "settings.sync.runtime.impact.highBattery":
      "ผลกระทบแบตเตอรี่/เครือข่ายสูง: ช่วงเวลาสั้นอาจทำให้แบตหมดเร็วขึ้น",
    "settings.sync.runtime.impact.highData":
      "โหลดข้อมูลสูง: ค่าปลายทางส่งขึ้น/ดึงลงที่มากอาจเพิ่มต้นทุนการรับส่ง",
    "settings.sync.runtime.impact.balanced":
      "โปรไฟล์สมดุล: ตอบสนองดีและใช้ทรัพยากรระดับปานกลาง",
    "settings.sync.runtime.impact.low":
      "โปรไฟล์ผลกระทบต่ำ: ซิงก์น้อยลงแต่กระจายการเปลี่ยนแปลงช้าลง",
    "settings.sync.runtime.feedback.resetRecommended":
      "รีเซ็ตรันไทม์เป็นโปรไฟล์ที่แนะนำ ({profile}) แล้ว",
    "settings.sync.runtime.feedback.saved":
      "บันทึกโปรไฟล์รันไทม์การซิงก์ ({profile}) แล้ว",
    "settings.sync.conflictDefaults.title": "ค่าเริ่มต้นกลยุทธ์คอนฟลิกต์",
    "settings.sync.conflictDefaults.desc":
      "ตั้งกลยุทธ์เริ่มต้นแยกตามประเภทคอนฟลิกต์ และยังปรับรายรายการได้",
    "settings.sync.conflictDefaults.loading":
      "กำลังโหลดค่าเริ่มต้นกลยุทธ์คอนฟลิกต์...",
    "settings.sync.conflictDefaults.save": "บันทึกค่าเริ่มต้นคอนฟลิกต์",
    "settings.sync.conflictDefaults.feedback.saved":
      "บันทึกค่าเริ่มต้นกลยุทธ์คอนฟลิกต์แล้ว",
    "settings.sync.diagnostics.title": "การวิเคราะห์ซิงก์ (เซสชัน)",
    "settings.sync.diagnostics.runtimePreset":
      "พรีเซ็ตรันไทม์: {preset} (ตรวจพบอัตโนมัติ)",
    "settings.sync.diagnostics.runtimePresetSource":
      "ที่มาพรีเซ็ตรันไทม์: {source}",
    "settings.sync.diagnostics.runtimePresetSource.userAgentData":
      "ค่า userAgentData.mobile ของ Navigator",
    "settings.sync.diagnostics.runtimePresetSource.userAgent":
      "จับคู่จากรูปแบบ User-Agent",
    "settings.sync.diagnostics.runtimePresetSource.platform":
      "จับคู่จากรูปแบบ Platform",
    "settings.sync.diagnostics.runtimePresetSource.iPadHeuristic":
      "ฮิวริสติก iPadOS แบบ UA เดสก์ท็อป + หน้าจอสัมผัส",
    "settings.sync.diagnostics.runtimePresetSource.fallbackDesktop":
      "ค่าถอยกลับเดสก์ท็อป",
    "settings.sync.diagnostics.runtimePresetSource.unknown": "ไม่ทราบ",
    "settings.sync.diagnostics.runtimeProfile": "โปรไฟล์รันไทม์: {profile}",
    "settings.sync.diagnostics.provider": "ผู้ให้บริการ (ลูปซิงก์): {provider}",
    "settings.sync.diagnostics.notSelectedYet": "ยังไม่ถูกเลือก",
    "settings.sync.diagnostics.successRate":
      "อัตราสำเร็จ: {rate}% ({success}/{total})",
    "settings.sync.diagnostics.lastCycleDuration": "ระยะเวลารอบล่าสุด: {value}",
    "settings.sync.diagnostics.averageCycleDuration":
      "ระยะเวลารอบเฉลี่ย: {value}",
    "settings.sync.diagnostics.failedCycles":
      "รอบที่ล้มเหลว: {failed} (ต่อเนื่อง: {streak})",
    "settings.sync.diagnostics.conflictCycles": "รอบที่มีคอนฟลิกต์: {count}",
    "settings.sync.diagnostics.providerEvents":
      "อีเวนต์เลือกผู้ให้บริการ: {count}",
    "settings.sync.diagnostics.profileChangeEvents":
      "อีเวนต์เปลี่ยนโปรไฟล์รันไทม์: {count}",
    "settings.sync.diagnostics.validationRejectedEvents":
      "อีเวนต์การตรวจสอบที่ถูกปฏิเสธ: {count}",
    "settings.sync.diagnostics.lastWarning": "คำเตือนล่าสุด: {value}",
    "settings.sync.diagnostics.history.title":
      "ประวัติการวิเคราะห์ (ล่าสุด 5 รายการ)",
    "settings.sync.diagnostics.history.loading":
      "กำลังโหลดประวัติการวิเคราะห์...",
    "settings.sync.diagnostics.history.empty":
      "ยังไม่มีการบันทึกประวัติการวิเคราะห์",
    "settings.sync.diagnostics.history.emptyFiltered":
      "ไม่มี snapshot ที่ตรงกับตัวกรองที่เลือก",
    "settings.sync.diagnostics.history.capturedAt": "บันทึกเมื่อ: {time}",
    "settings.sync.diagnostics.history.snapshot":
      "สำเร็จ {rate}% • ล้มเหลว {failed} • คอนฟลิกต์ {conflicts} • ที่มา {source}",
    "settings.sync.diagnostics.history.profileProvider":
      "โปรไฟล์ {profile} • ผู้ให้บริการ {provider}",
    "settings.sync.diagnostics.history.field.search": "ค้นหา",
    "settings.sync.diagnostics.history.field.source": "ตัวกรองที่มา",
    "settings.sync.diagnostics.history.field.limit": "จำนวนแถว",
    "settings.sync.diagnostics.history.field.fromDate": "วันที่เริ่มต้น",
    "settings.sync.diagnostics.history.field.toDate": "วันที่สิ้นสุด",
    "settings.sync.diagnostics.history.placeholder.search":
      "ค้นหาผู้ให้บริการ ที่มา หรือคำเตือน...",
    "settings.sync.diagnostics.history.filter.all": "ทุกที่มา",
    "settings.sync.diagnostics.history.meta":
      "แสดง {shown} จากทั้งหมด {total} รายการ",
    "settings.sync.diagnostics.history.action.expand": "ดูประวัติทั้งหมด",
    "settings.sync.diagnostics.history.action.collapse": "ซ่อนประวัติทั้งหมด",
    "settings.sync.diagnostics.history.action.clearFilters": "ล้างตัวกรอง",
    "settings.sync.diagnostics.history.action.exportFiltered":
      "ส่งออก JSON ตามตัวกรอง",
    "settings.sync.diagnostics.history.action.exporting": "กำลังส่งออก...",
    "settings.sync.diagnostics.history.feedback.exported":
      "ส่งออกประวัติการวิเคราะห์แล้ว ({count} รายการ)",
    "settings.sync.diagnostics.history.validation.dateRange":
      "วันที่เริ่มต้นต้องไม่ช้ากว่าวันที่สิ้นสุด",
    "settings.sync.diagnostics.history.error":
      "ไม่สามารถโหลดประวัติการวิเคราะห์ได้",
    "settings.sync.diagnostics.history.error.export":
      "ไม่สามารถส่งออกประวัติการวิเคราะห์ได้",
    "settings.sync.duration.na": "ไม่มีข้อมูล",
    "settings.sync.duration.ms": "{value} มิลลิวินาที",
    "settings.sync.duration.seconds": "{value} วินาที",
    "settings.sync.duration.minutes": "{value} นาที",
    "settings.sync.duration.hours": "{value} ชั่วโมง",
    "settings.sync.observability.title": "การสังเกตการณ์คอนฟลิกต์",
    "settings.sync.observability.loading": "กำลังโหลดตัวนับ...",
    "settings.sync.observability.total": "คอนฟลิกต์ทั้งหมด: {count}",
    "settings.sync.observability.openResolvedIgnored":
      "เปิดอยู่/แก้ไขแล้ว/ละเว้น: {open}/{resolved}/{ignored}",
    "settings.sync.observability.resolutionRate":
      "อัตราการแก้ไขสำเร็จ: {rate}%",
    "settings.sync.observability.medianResolve":
      "เวลามัธยฐานในการแก้ไข: {value}",
    "settings.sync.observability.retriedEvents": "อีเวนต์ลองใหม่: {count}",
    "settings.sync.observability.exportedEvents": "อีเวนต์ส่งออก: {count}",
    "settings.sync.observability.lastDetected": "ตรวจพบล่าสุด: {time}",
    "settings.sync.observability.lastResolved": "แก้ไขล่าสุด: {time}",
    "settings.sync.observability.unavailable":
      "ข้อมูลการสังเกตการณ์คอนฟลิกต์ยังไม่พร้อมใช้งาน",
    "settings.sync.observability.error":
      "ไม่สามารถโหลดตัวนับการสังเกตการณ์คอนฟลิกต์ได้",
    "settings.backup.title": "สำรองและกู้คืนข้อมูล",
    "settings.backup.desc":
      "ส่งออกข้อมูลภายในเครื่องทั้งหมดเป็น JSON และกู้คืนภายหลังบนเครื่องนี้หรือเครื่องอื่น",
    "settings.backup.warning.replaceLocal":
      "การกู้คืนจะเขียนทับข้อมูลภายในเครื่องปัจจุบันทั้งหมด",
    "settings.backup.preflight.loading": "กำลังตรวจสอบก่อนกู้คืน...",
    "settings.backup.preflight.unavailable":
      "ไม่พบข้อมูลการตรวจสอบก่อนกู้คืน กรุณาลองใหม่อีกครั้ง",
    "settings.backup.preflight.latestInternal": "แบ็กอัปภายในล่าสุด: {time}",
    "settings.backup.preflight.latestSummary":
      "แบ็กอัปล่าสุดมี {projects} โปรเจกต์, {tasks} งาน, {templates} เทมเพลต",
    "settings.backup.preflight.pendingOutbox":
      "การเปลี่ยนแปลงในคิวขาออกที่รออยู่: {count}",
    "settings.backup.preflight.openConflicts": "คอนฟลิกต์ที่เปิดอยู่: {count}",
    "settings.backup.preflight.requiresForce":
      "ขณะนี้ต้องใช้การกู้คืนแบบบังคับ เพราะยังมี {reason}",
    "settings.backup.preflight.error":
      "ไม่สามารถโหลดรายละเอียดการตรวจสอบก่อนกู้คืนได้",
    "settings.backup.confirm.replaceData":
      "การกู้คืนจะเขียนทับข้อมูลภายในเครื่องทั้งหมดและรีเซ็ตสถานะซิงก์ (คิวขาออก/คอนฟลิกต์) ต้องการดำเนินการต่อหรือไม่?",
    "settings.backup.confirm.forceReason":
      "ต้องใช้การกู้คืนแบบบังคับ เพราะยังมี {reason}",
    "settings.backup.confirm.forceDiscard":
      "การกู้คืนแบบบังคับจะทิ้งการเปลี่ยนแปลงคิวขาออกที่รออยู่และล้างคอนฟลิกต์ที่เปิดอยู่",
    "settings.backup.confirm.forceContinue":
      "ต้องการดำเนินการกู้คืนแบบบังคับต่อหรือไม่?",
    "settings.backup.confirm.dryRunTitle": "สรุปการจำลองก่อนกู้คืน:",
    "settings.backup.confirm.dryRunData":
      "จะกู้คืน {projects} โปรเจกต์, {tasks} งาน, {templates} เทมเพลต",
    "settings.backup.confirm.dryRunDataUnknown":
      "ไม่สามารถประเมินจำนวนโปรเจกต์/งาน/เทมเพลตจากแบ็กอัปนี้ได้",
    "settings.backup.confirm.dryRunClears":
      "จะล้างคิวขาออกที่รออยู่ {outbox} รายการ และคอนฟลิกต์ที่เปิดอยู่ {conflicts} รายการ",
    "settings.backup.confirm.source.latest":
      "แหล่งข้อมูล: แบ็กอัปภายในล่าสุด ({time})",
    "settings.backup.confirm.source.latestUnknown":
      "แหล่งข้อมูล: แบ็กอัปภายในล่าสุด",
    "settings.backup.confirm.source.file": "ไฟล์ต้นทาง: {name}",
    "settings.backup.reason.pendingOutbox": "การเปลี่ยนแปลงคิวขาออกที่รออยู่",
    "settings.backup.reason.openConflicts": "คอนฟลิกต์ที่เปิดอยู่",
    "settings.backup.reason.activeGuardrails":
      "เงื่อนไขป้องกันการกู้คืนที่ทำงานอยู่",
    "settings.backup.reason.and": "และ",
    "settings.backup.action.export": "ส่งออกแบ็กอัป",
    "settings.backup.action.exporting": "กำลังส่งออก...",
    "settings.backup.action.restoreLatest": "กู้คืนแบ็กอัปล่าสุด",
    "settings.backup.action.restoreFromFile": "กู้คืนจากไฟล์",
    "settings.backup.action.restoreQueued": "จัดคิวกู้คืนแล้ว...",
    "settings.backup.feedback.exported":
      "ส่งออกแบ็กอัปสำเร็จ ({tasks} งาน, {projects} โปรเจกต์)",
    "settings.backup.feedback.restoreFileQueued":
      "จัดคิวกู้คืนจากไฟล์แล้ว สามารถ Undo ได้ภายใน 5 วินาที",
    "settings.backup.feedback.restoreLatestQueued":
      "จัดคิวกู้คืนแบ็กอัปล่าสุดแล้ว สามารถ Undo ได้ภายใน 5 วินาที",
  },
} as const;

export const I18N_CATALOG = TRANSLATIONS;

export type TranslationKey = keyof (typeof TRANSLATIONS)["en"];
type TranslationParams = Record<string, string | number>;

function applyTranslationParams(
  template: string,
  params?: TranslationParams,
): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function normalizeAppLocale(
  value: string | null | undefined,
): AppLocale {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.startsWith("th")) return "th";
  return "en";
}

export function detectSystemAppLocale(): AppLocale {
  if (typeof navigator === "undefined") return "en";
  const prioritized = navigator.languages?.[0] ?? navigator.language;
  return normalizeAppLocale(prioritized);
}

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const localeMessages = TRANSLATIONS[locale] ?? TRANSLATIONS.en;
  const template = localeMessages[key] ?? TRANSLATIONS.en[key] ?? key;
  return applyTranslationParams(template, params);
}

interface I18nContextValue {
  locale: AppLocale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const defaultLocale: AppLocale = "en";
const defaultContext: I18nContextValue = {
  locale: defaultLocale,
  t: (key, params) => translate(defaultLocale, key, params),
};

const I18nContext = createContext<I18nContextValue>(defaultContext);

interface I18nProviderProps {
  locale: AppLocale;
  children: ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
