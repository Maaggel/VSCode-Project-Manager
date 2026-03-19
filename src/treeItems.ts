import * as vscode from 'vscode';
import { Project, Group } from './types';
import { resolveIconPath } from './builtinIcons';

export function createProjectTreeItem(project: Project, extensionUri: vscode.Uri): vscode.TreeItem {
    const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.None);
    item.id = project.id;
    item.contextValue = 'project';
    item.tooltip = project.folderPath;
    item.iconPath = resolveIconPath(project.iconPath, extensionUri, 'folder');
    item.command = {
        command: 'projectManager.openProject',
        title: 'Open Project',
        arguments: [project],
    };
    return item;
}

export function createGroupTreeItem(group: Group, childCount: number, extensionUri: vscode.Uri, collapsed?: boolean): vscode.TreeItem {
    let state: vscode.TreeItemCollapsibleState;
    if (collapsed !== undefined) {
        state = collapsed
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.Expanded;
    } else {
        state = childCount > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed;
    }
    const item = new vscode.TreeItem(group.name, state);
    item.id = group.id;
    item.contextValue = 'group';
    item.description = `${childCount} project${childCount !== 1 ? 's' : ''}`;
    item.iconPath = resolveIconPath(group.iconPath, extensionUri, 'folder-library');
    return item;
}
