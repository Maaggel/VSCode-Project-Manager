import * as vscode from 'vscode';
import { Storage } from './storage';
import { ProjectTreeProvider } from './treeDataProvider';
import { addProject, addProjectToGroup, addGroup, addGroupToGroup, editItem, removeItem, openProject, quickOpenProject, setStorageUri } from './commands';
import { WelcomePanel } from './welcomePanel';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const storage = new Storage(context.globalStorageUri);
    await storage.load();

    setStorageUri(context.globalStorageUri);

    const treeProvider = new ProjectTreeProvider(storage, context.extensionUri, context.globalState);

    const treeView = vscode.window.createTreeView('projectManagerView', {
        treeDataProvider: treeProvider,
        dragAndDropController: treeProvider,
        canSelectMany: false,
    });

    context.subscriptions.push(
        storage.startWatching(),
        storage.onDidChange(() => treeProvider.refresh()),
        treeView,
        treeView.onDidCollapseElement(e => {
            if (e.element.type === 'group') {
                treeProvider.setCollapsed(e.element.id, true);
            }
        }),
        treeView.onDidExpandElement(e => {
            if (e.element.type === 'group') {
                treeProvider.setCollapsed(e.element.id, false);
            }
        }),
        vscode.commands.registerCommand('projectManager.addProject', () =>
            addProject(storage, treeProvider)),
        vscode.commands.registerCommand('projectManager.addGroup', () =>
            addGroup(storage, treeProvider)),
        vscode.commands.registerCommand('projectManager.addProjectToGroup', (node) =>
            addProjectToGroup(node, storage, treeProvider)),
        vscode.commands.registerCommand('projectManager.addGroupToGroup', (node) =>
            addGroupToGroup(node, storage, treeProvider)),
        vscode.commands.registerCommand('projectManager.editItem', (node) =>
            editItem(node, storage, treeProvider)),
        vscode.commands.registerCommand('projectManager.removeItem', (node) =>
            removeItem(node, storage, treeProvider)),
        vscode.commands.registerCommand('projectManager.openProject', (project) =>
            openProject(project)),
        vscode.commands.registerCommand('projectManager.quickOpen', () =>
            quickOpenProject(storage)),
        vscode.commands.registerCommand('projectManager.manageProjects', () =>
            vscode.commands.executeCommand('projectManagerView.focus')),
        vscode.commands.registerCommand('projectManager.showWelcome', () =>
            WelcomePanel.show(storage, context.extensionUri)),
    );

    vscode.commands.executeCommand('setContext', 'projectManager.loaded', true);

    // Auto-show the welcome panel when VS Code opens with no folder
    const config = vscode.workspace.getConfiguration('projectManager');
    if (config.get<boolean>('showWelcomeOnStartup', true)) {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            WelcomePanel.show(storage, context.extensionUri);
        }
    }
}

export function deactivate(): void {}
