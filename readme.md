# Project Manager for VS Code

A lightweight VS Code extension for organizing and quickly switching between your projects. Group projects by category, assign custom icons, and open any project in one click.

## Features

- **Welcome Panel** — A clean project overview opens automatically when VS Code starts with no folder, putting your projects front and center
- **Project Groups** — Organize projects into named groups (e.g. "Work", "Personal", "Open Source")
- **Built-in Icons** — Choose from 26 built-in icons (code, web, database, rocket, terminal, and more) to visually distinguish projects and groups
- **Custom Icons** — Use any SVG/PNG/JPG image, `.ico` file, or even extract icons directly from `.exe` files
- **Quick Open** — Press `Ctrl+Alt+P` (`Cmd+Alt+P` on Mac) to fuzzy-search and open any project instantly
- **Drag & Drop** — Reorder projects and move them between groups by dragging
- **Open in New Window or Same Window** — Click to open in the current window, or `Ctrl+Click` from the welcome panel to open in a new window
- **Activity Bar Panel** — Dedicated sidebar panel with your full project tree
- **Cross-Window Sync** — Changes made in one VS Code window are automatically reflected in all other open windows
- **Persistent State** — Group collapse/expand state is remembered across sessions

## Getting Started

1. Install the extension (`.vsix` file or from the marketplace)
2. Click the **Project Manager** icon in the Activity Bar
3. Use the **+** buttons in the panel header to add groups and projects
4. Click any project to open it

When you open VS Code without a folder, the Projects welcome panel will appear automatically in the editor area.

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `Project Manager: Open Project...` | `Ctrl+Alt+P` | Quick-open picker for all projects |
| `Project Manager: Show Projects Welcome` | — | Open the projects welcome panel in the editor |
| `Project Manager: Add Project` | — | Add a new project |
| `Project Manager: Add Group` | — | Create a new project group |
| `Project Manager: Add Project to Group` | — | Add a project directly to a specific group |
| `Project Manager: Edit` | — | Rename or change icon for a project/group |
| `Project Manager: Remove` | — | Remove a project or group |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `projectManager.showWelcomeOnStartup` | `true` | Show the Projects welcome panel when VS Code opens with no folder |

## Icon Picker

When adding or editing a project/group, you can choose from built-in icons:

`code` · `web` · `mobile` · `api` · `database` · `game` · `music` · `design` · `book` · `notes` · `star` · `rocket` · `bolt` · `heart` · `sparkle` · `coffee` · `terminal` · `tools` · `cloud` · `bug` · `home` · `shield` · `flask` · `package` · `camera` · `puzzle`

Or select a custom image file (`.svg`, `.png`, `.jpg`) or extract an icon from an `.exe` or `.ico` file.

## Data Storage

Project data is stored in VS Code's global storage directory, so your project list persists across workspaces and sessions. Multiple VS Code windows share the same data file and stay in sync automatically.

## License

[MIT](LICENSE.txt)
