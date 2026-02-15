# ⚡ SoloStack

A minimal, beautiful solo task management app built with **Tauri + React + TypeScript**.

Designed for individual developers who want a distraction-free, lightning-fast kanban board running natively on their desktop.

## ✨ Features

- 📋 **Kanban Board** — Drag-and-drop tasks across To Do, In Progress, and Done columns
- 🔎 **Search + Filters + Sort** — Quickly narrow tasks by text, status, priority, importance, due window, and per-view ordering
- 💾 **Saved Views** — Save and reapply custom filter combinations
- 🧩 **Task Templates** — Save reusable presets for recurring task patterns
- 🗓️ **Today & Upcoming Views** — Focus on overdue/today tasks and the next 7 days at a glance
- ⏰ **Due Dates & Reminders** — Add schedule metadata directly in task form
- 🔁 **Recurring Tasks** — Repeat tasks daily, weekly, or monthly
- 🔔 **Desktop Notifications** — Native reminder notifications via Tauri plugin (click to open task)
- 📊 **Dashboard** — Visualize your productivity at a glance
- 📈 **Momentum Metrics** — Track due today, overdue, and completed-this-week trends
- ⚙️ **Reminder Settings** — Toggle reminders and reset permission/history from Settings
- 💾 **Local-first** — All data stored locally via SQLite, no account needed
- ⚡ **Blazing fast** — Powered by Tauri for near-native performance
- 🎨 **Beautiful UI** — Dark-themed, modern design with smooth animations
- ⌨️ **Keyboard shortcuts** — `⌘/Ctrl + N` for full form and `⌘/Ctrl + Shift + N` for Quick Capture

## 🛠️ Tech Stack

| Layer      | Technology                |
|------------|---------------------------|
| Framework  | Tauri 2                   |
| Frontend   | React 19 + TypeScript     |
| Styling    | CSS Variables + Lucide Icons |
| State      | Zustand + React Query     |
| Database   | SQLite (via tauri-plugin-sql) |
| Build      | Vite 7                    |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

The built application will be available in `src-tauri/target/release/bundle/`.

## 📂 Project Structure

```
MVP/
├── src/                    # React frontend
│   ├── components/         # UI components (AppShell, TaskBoard, Dashboard, etc.)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Types and utilities
│   └── store/              # Zustand state management
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/                # Rust source (lib.rs, db.rs)
│   ├── icons/              # App icons
│   └── tauri.conf.json     # Tauri configuration
└── package.json
```

## ☕ Support

If you find SoloStack useful and want to support its development, consider buying me a coffee!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8Y71U8RJO)

Your support helps keep this project alive and motivates future improvements. Every coffee counts! ❤️

## 📄 License

MIT

---

<p align="center">
  Built with ❤️ by a solo developer, for solo developers.
</p>
