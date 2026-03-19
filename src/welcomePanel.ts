import * as vscode from 'vscode';
import { Storage } from './storage';
import { BUILTIN_ICONS, BUILTIN_PREFIX } from './builtinIcons';

export class WelcomePanel {
    private static currentPanel: WelcomePanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private storage: Storage,
        private extensionUri: vscode.Uri,
    ) {
        this.panel = panel;

        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(
            async (msg) => {
                if (msg.command === 'openProject') {
                    const uri = vscode.Uri.file(msg.folderPath);
                    await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
                } else if (msg.command === 'openProjectNewWindow') {
                    const uri = vscode.Uri.file(msg.folderPath);
                    await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
                } else if (msg.command === 'addProject') {
                    await vscode.commands.executeCommand('projectManager.addProject');
                    this.refresh();
                } else if (msg.command === 'addGroup') {
                    await vscode.commands.executeCommand('projectManager.addGroup');
                    this.refresh();
                }
            },
            undefined,
            this.disposables,
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.disposables.push(
            storage.onDidChange(() => this.refresh()),
        );
    }

    static show(storage: Storage, extensionUri: vscode.Uri): void {
        if (WelcomePanel.currentPanel) {
            WelcomePanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
            WelcomePanel.currentPanel.refresh();
            return;
        }

        // Collect all custom icon directories for localResourceRoots
        const resourceRoots: vscode.Uri[] = [
            vscode.Uri.joinPath(extensionUri, 'resources'),
        ];

        // Add the globalStorage directory for extracted icons
        const data = storage.getData();
        const iconDirs = new Set<string>();
        for (const project of data.projects) {
            if (project.iconPath && !project.iconPath.startsWith(BUILTIN_PREFIX)) {
                const dir = vscode.Uri.file(project.iconPath).with({ path: vscode.Uri.file(project.iconPath).path.replace(/\/[^/]+$/, '') });
                iconDirs.add(dir.toString());
            }
        }
        for (const group of data.groups) {
            if (group.iconPath && !group.iconPath.startsWith(BUILTIN_PREFIX)) {
                const dir = vscode.Uri.file(group.iconPath).with({ path: vscode.Uri.file(group.iconPath).path.replace(/\/[^/]+$/, '') });
                iconDirs.add(dir.toString());
            }
        }
        for (const dirStr of iconDirs) {
            resourceRoots.push(vscode.Uri.parse(dirStr));
        }

        const panel = vscode.window.createWebviewPanel(
            'projectManagerWelcome',
            'Projects',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: resourceRoots,
            },
        );

        panel.iconPath = new vscode.ThemeIcon('folder-library');
        WelcomePanel.currentPanel = new WelcomePanel(panel, storage, extensionUri);
    }

    refresh(): void {
        if (this.panel.visible) {
            this.panel.webview.html = this.getHtml();
        }
    }

    private dispose(): void {
        WelcomePanel.currentPanel = undefined;
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
    }

    private getCodiconForIcon(iconPath: string | undefined): string {
        if (!iconPath || !iconPath.startsWith(BUILTIN_PREFIX)) {
            return 'folder';
        }
        const iconId = iconPath.slice(BUILTIN_PREFIX.length);
        const entry = BUILTIN_ICONS.find(i => i.id === iconId);
        return entry ? entry.codicon : 'folder';
    }

    private isCustomIcon(iconPath: string | undefined): boolean {
        return !!iconPath && !iconPath.startsWith(BUILTIN_PREFIX);
    }

    private getIconHtml(iconPath: string | undefined): string {
        if (this.isCustomIcon(iconPath)) {
            const fileUri = vscode.Uri.file(iconPath!);
            const webviewUri = this.panel.webview.asWebviewUri(fileUri);
            return `<img class="custom-icon" src="${webviewUri}" alt="" />`;
        }
        const codicon = this.getCodiconForIcon(iconPath);
        return `<span class="codicon codicon-${codicon}"></span>`;
    }

    private renderChildren(childIds: string[], depth: number = 0): string {
        let html = '';
        for (const id of childIds) {
            const group = this.storage.getGroup(id);
            if (group) {
                const groupIconHtml = this.getIconHtml(group.iconPath);
                const childrenHtml = this.renderChildren(group.children, depth + 1);
                html += `
                    <div class="group" style="margin-left: ${depth > 0 ? 16 : 0}px">
                        <div class="group-header">
                            ${groupIconHtml}
                            <span class="group-name">${this.escapeHtml(group.name)}</span>
                            <span class="group-count">${group.children.length}</span>
                        </div>
                        <div class="group-children">${childrenHtml}</div>
                    </div>`;
            } else {
                const project = this.storage.getProject(id);
                if (project) {
                    const iconHtml = this.getIconHtml(project.iconPath);
                    html += `
                        <button class="project-item${depth === 0 ? ' root-project' : ''}" data-path="${this.escapeAttr(project.folderPath)}" title="${this.escapeAttr(project.folderPath)}">
                            ${iconHtml}
                            <span class="project-name">${this.escapeHtml(project.name)}</span>
                            <span class="project-path">${this.escapeHtml(this.shortenPath(project.folderPath))}</span>
                        </button>`;
                }
            }
        }
        return html;
    }

    private getHtml(): string {
        const data = this.storage.getData();
        const codiconCssUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'resources', 'codicon.css'),
        );
        const codiconFontUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'resources', 'codicon.ttf'),
        );

        let projectsHtml = this.renderChildren(data.rootOrder);

        if (!projectsHtml) {
            projectsHtml = `
                <div class="empty-state">
                    <span class="codicon codicon-folder-library empty-icon"></span>
                    <p>No projects yet</p>
                    <p class="empty-hint">Add a project or group to get started.</p>
                </div>`;
        }

        return /*html*/`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @font-face {
            font-family: 'codicon';
            font-display: block;
            src: url('${codiconFontUri}') format('truetype');
        }
    </style>
    <link rel="stylesheet" href="${codiconCssUri}" />
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }

        .container {
            max-width: 700px;
            margin: 0 auto;
            padding: 40px 24px;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 32px;
        }

        .header h1 {
            font-size: 22px;
            font-weight: 400;
            margin: 0;
            color: var(--vscode-foreground);
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        .header-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border, transparent));
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: var(--vscode-font-family);
        }

        .header-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .group {
            margin-bottom: 24px;
        }

        .group-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 0;
            margin-bottom: 4px;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .group-header .codicon {
            font-size: 14px;
            opacity: 0.7;
        }

        .group-header .custom-icon {
            width: 14px;
            height: 14px;
            opacity: 0.7;
        }

        .group-count {
            opacity: 0.5;
            font-weight: 400;
        }

        .group-children {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .project-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            border: 1px solid transparent;
            background: transparent;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            text-align: left;
            width: 100%;
            box-sizing: border-box;
        }

        .project-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .project-item:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .project-item .codicon {
            font-size: 20px;
            color: var(--vscode-icon-foreground);
            flex-shrink: 0;
        }

        .project-item .custom-icon {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
            object-fit: contain;
        }

        .project-name {
            font-weight: 500;
            flex-shrink: 0;
        }

        .project-path {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .root-project {
            margin-bottom: 2px;
        }

        .empty-state {
            text-align: center;
            padding: 60px 0;
            color: var(--vscode-descriptionForeground);
        }

        .empty-icon {
            font-size: 48px !important;
            opacity: 0.3;
            display: block;
            margin-bottom: 16px;
        }

        .empty-state p {
            margin: 4px 0;
        }

        .empty-hint {
            font-size: 12px;
            opacity: 0.7;
        }

        .shortcut-hint {
            text-align: center;
            margin-top: 32px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            opacity: 0.7;
        }

        kbd {
            display: inline-block;
            padding: 2px 6px;
            font-size: 11px;
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-keybindingLabel-background, rgba(128,128,128,0.15));
            border: 1px solid var(--vscode-keybindingLabel-border, rgba(128,128,128,0.25));
            border-radius: 3px;
            box-shadow: inset 0 -1px 0 var(--vscode-keybindingLabel-bottomBorder, rgba(128,128,128,0.2));
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Projects</h1>
            <div class="header-actions">
                <button class="header-btn" id="addProject">
                    <span class="codicon codicon-new-folder"></span> Add Project
                </button>
                <button class="header-btn" id="addGroup">
                    <span class="codicon codicon-group-by-ref-type"></span> Add Group
                </button>
            </div>
        </div>
        ${projectsHtml}
        <div class="shortcut-hint">
            Tip: Press <kbd>Ctrl+Alt+P</kbd> to quick-open a project from anywhere
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();

        document.querySelectorAll('.project-item').forEach(el => {
            el.addEventListener('click', (e) => {
                const path = el.getAttribute('data-path');
                if (e.ctrlKey || e.metaKey) {
                    vscode.postMessage({ command: 'openProjectNewWindow', folderPath: path });
                } else {
                    vscode.postMessage({ command: 'openProject', folderPath: path });
                }
            });
        });

        document.getElementById('addProject')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'addProject' });
        });
        document.getElementById('addGroup')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'addGroup' });
        });
    </script>
</body>
</html>`;
    }

    private escapeHtml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    private escapeAttr(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    private shortenPath(p: string): string {
        const home = process.env.USERPROFILE || process.env.HOME || '';
        if (home && p.startsWith(home)) {
            return '~' + p.slice(home.length);
        }
        return p;
    }
}
