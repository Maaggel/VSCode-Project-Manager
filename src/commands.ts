import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import { Project, Group } from './types';
import { Storage } from './storage';
import { ProjectTreeProvider } from './treeDataProvider';
import { BUILTIN_ICONS, BUILTIN_PREFIX } from './builtinIcons';
import { extractIcon } from './iconExtractor';

let _storageUri: vscode.Uri | undefined;

export function setStorageUri(uri: vscode.Uri): void {
    _storageUri = uri;
}

interface IconQuickPickItem extends vscode.QuickPickItem {
    value: 'none' | 'builtin' | 'file';
    builtinId?: string;
}

async function pickIcon(): Promise<string | undefined> {
    const items: IconQuickPickItem[] = [
        {
            label: '$(close) No icon (use default)',
            value: 'none',
        },
        {
            label: 'Built-in Icons',
            kind: vscode.QuickPickItemKind.Separator,
            value: 'none',
        },
        ...BUILTIN_ICONS.map(icon => ({
            label: `$(${icon.codicon}) ${icon.label}`,
            value: 'builtin' as const,
            builtinId: icon.id,
        })),
        {
            label: '',
            kind: vscode.QuickPickItemKind.Separator,
            value: 'none' as const,
        },
        {
            label: '$(file-media) Choose icon from file...',
            value: 'file' as const,
        },
    ];

    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Choose an icon for this item',
    });

    if (!pick) { return undefined; }

    if (pick.value === 'builtin' && pick.builtinId) {
        return `${BUILTIN_PREFIX}${pick.builtinId}`;
    }

    if (pick.value === 'file') {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Images': ['svg', 'png', 'jpg', 'jpeg', 'gif'],
                'Icons': ['ico'],
                'Executables': ['exe'],
            },
            title: 'Select an icon (or .exe to extract its icon)',
        });
        if (uris && uris.length > 0) {
            const filePath = uris[0].fsPath;
            const ext = path.extname(filePath).toLowerCase();
            if ((ext === '.ico' || ext === '.exe') && _storageUri) {
                return await extractIcon(filePath, _storageUri);
            }
            return filePath;
        }
    }

    return undefined;
}

export async function addProject(storage: Storage, tree: ProjectTreeProvider): Promise<void> {
    const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select project folder',
    });
    if (!folderUris || folderUris.length === 0) { return; }

    const folderPath = folderUris[0].fsPath;
    const defaultName = path.basename(folderPath);

    const name = await vscode.window.showInputBox({
        prompt: 'Project name',
        value: defaultName,
        validateInput: (v) => v.trim() ? null : 'Name is required',
    });
    if (!name) { return; }

    const iconPath = await pickIcon();

    const project: Project = {
        id: crypto.randomUUID(),
        type: 'project',
        name: name.trim(),
        folderPath,
        iconPath,
    };

    await storage.addProject(project);
    tree.refresh();
}

export async function addProjectToGroup(
    node: { id: string; type: 'group' },
    storage: Storage,
    tree: ProjectTreeProvider,
): Promise<void> {
    if (!node || node.type !== 'group') { return; }

    const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select project folder',
    });
    if (!folderUris || folderUris.length === 0) { return; }

    const folderPath = folderUris[0].fsPath;
    const defaultName = path.basename(folderPath);

    const name = await vscode.window.showInputBox({
        prompt: 'Project name',
        value: defaultName,
        validateInput: (v) => v.trim() ? null : 'Name is required',
    });
    if (!name) { return; }

    const iconPath = await pickIcon();

    const project: Project = {
        id: crypto.randomUUID(),
        type: 'project',
        name: name.trim(),
        folderPath,
        iconPath,
    };

    await storage.addProject(project, node.id);
    tree.refresh();
}

export async function addGroup(storage: Storage, tree: ProjectTreeProvider): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: 'Group name',
        validateInput: (v) => v.trim() ? null : 'Name is required',
    });
    if (!name) { return; }

    const iconPath = await pickIcon();

    const group: Group = {
        id: crypto.randomUUID(),
        type: 'group',
        name: name.trim(),
        iconPath,
        children: [],
    };

    await storage.addGroup(group);
    tree.refresh();
}

export async function editItem(
    node: { id: string; type: 'project' | 'group' },
    storage: Storage,
    tree: ProjectTreeProvider,
): Promise<void> {
    if (!node) { return; }

    const item = storage.getItem(node.id);
    if (!item) { return; }

    if (item.type === 'project') {
        const name = await vscode.window.showInputBox({
            prompt: 'Project name',
            value: item.name,
            validateInput: (v) => v.trim() ? null : 'Name is required',
        });
        if (name === undefined) { return; }

        const changeFolder = await vscode.window.showQuickPick(
            ['Keep current folder', 'Change folder...'],
            { placeHolder: `Current: ${item.folderPath}` }
        );
        let folderPath = item.folderPath;
        if (changeFolder === 'Change folder...') {
            const uris = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select project folder',
            });
            if (uris && uris.length > 0) {
                folderPath = uris[0].fsPath;
            }
        }

        const changeIcon = await vscode.window.showQuickPick(
            ['Keep current icon', 'Change icon...', 'Remove icon'],
            { placeHolder: 'Icon' }
        );
        let iconPath = item.iconPath;
        if (changeIcon === 'Change icon...') {
            iconPath = await pickIcon() ?? item.iconPath;
        } else if (changeIcon === 'Remove icon') {
            iconPath = undefined;
        }

        await storage.updateProject(item.id, {
            name: name.trim(),
            folderPath,
            iconPath,
        });
    } else {
        const name = await vscode.window.showInputBox({
            prompt: 'Group name',
            value: item.name,
            validateInput: (v) => v.trim() ? null : 'Name is required',
        });
        if (name === undefined) { return; }

        const changeIcon = await vscode.window.showQuickPick(
            ['Keep current icon', 'Change icon...', 'Remove icon'],
            { placeHolder: 'Icon' }
        );
        let iconPath = item.iconPath;
        if (changeIcon === 'Change icon...') {
            iconPath = await pickIcon() ?? item.iconPath;
        } else if (changeIcon === 'Remove icon') {
            iconPath = undefined;
        }

        await storage.updateGroup(item.id, {
            name: name.trim(),
            iconPath,
        });
    }

    tree.refresh();
}

export async function removeItem(
    node: { id: string; type: 'project' | 'group' },
    storage: Storage,
    tree: ProjectTreeProvider,
): Promise<void> {
    if (!node) { return; }

    const item = storage.getItem(node.id);
    if (!item) { return; }

    const label = item.type === 'group'
        ? `Remove group "${item.name}"? Projects inside will be moved to the root level.`
        : `Remove project "${item.name}"?`;

    const confirm = await vscode.window.showWarningMessage(label, { modal: true }, 'Remove');
    if (confirm !== 'Remove') { return; }

    await storage.removeItem(node.id);
    tree.refresh();
}

export async function openProject(project: { folderPath: string }): Promise<void> {
    if (!project?.folderPath) { return; }
    const uri = vscode.Uri.file(project.folderPath);
    await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
}

interface ProjectQuickPickItem extends vscode.QuickPickItem {
    projectId?: string;
    folderPath?: string;
}

export async function quickOpenProject(storage: Storage): Promise<void> {
    const data = storage.getData();
    const items: ProjectQuickPickItem[] = [];

    // Build grouped items
    for (const id of data.rootOrder) {
        const group = storage.getGroup(id);
        if (group) {
            // Add group separator
            items.push({
                label: group.name,
                kind: vscode.QuickPickItemKind.Separator,
            });
            // Add projects in this group
            for (const childId of group.children) {
                const project = storage.getProject(childId);
                if (project) {
                    items.push({
                        label: `$(folder) ${project.name}`,
                        description: project.folderPath,
                        projectId: project.id,
                        folderPath: project.folderPath,
                    });
                }
            }
        } else {
            const project = storage.getProject(id);
            if (project) {
                items.push({
                    label: `$(folder) ${project.name}`,
                    description: project.folderPath,
                    projectId: project.id,
                    folderPath: project.folderPath,
                });
            }
        }
    }

    if (items.length === 0) {
        const action = await vscode.window.showInformationMessage(
            'No projects yet. Add one?',
            'Add Project',
        );
        if (action === 'Add Project') {
            await vscode.commands.executeCommand('projectManager.addProject');
        }
        return;
    }

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a project to open',
        matchOnDescription: true,
    });

    if (picked?.folderPath) {
        const uri = vscode.Uri.file(picked.folderPath);
        await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
    }
}
