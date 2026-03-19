import * as vscode from 'vscode';
import { StorageData, Project, Group, ItemType } from './types';

const FILENAME = 'projects.json';

function createEmptyData(): StorageData {
    return { version: 1, groups: [], projects: [], rootOrder: [] };
}

export class Storage {
    private uri: vscode.Uri;
    private data: StorageData;
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private watcher: vscode.FileSystemWatcher | undefined;
    private lastSaveTime = 0;

    constructor(globalStorageUri: vscode.Uri) {
        this.uri = vscode.Uri.joinPath(globalStorageUri, FILENAME);
        this.data = createEmptyData();
    }

    startWatching(): vscode.Disposable {
        const pattern = new vscode.RelativePattern(
            vscode.Uri.joinPath(this.uri, '..'),
            FILENAME,
        );
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        const reload = async () => {
            // Ignore file changes triggered by our own saves (within 1s)
            if (Date.now() - this.lastSaveTime < 1000) {
                return;
            }
            await this.load();
            this._onDidChange.fire();
        };

        this.watcher.onDidChange(reload);
        this.watcher.onDidCreate(reload);

        return this.watcher;
    }

    async load(): Promise<void> {
        try {
            const raw = await vscode.workspace.fs.readFile(this.uri);
            this.data = JSON.parse(Buffer.from(raw).toString('utf-8'));
        } catch {
            this.data = createEmptyData();
        }
    }

    private async save(): Promise<void> {
        const content = Buffer.from(JSON.stringify(this.data, null, 2), 'utf-8');
        this.lastSaveTime = Date.now();
        await vscode.workspace.fs.writeFile(this.uri, content);
    }

    getData(): StorageData {
        return this.data;
    }

    getProject(id: string): Project | undefined {
        return this.data.projects.find(p => p.id === id);
    }

    getGroup(id: string): Group | undefined {
        return this.data.groups.find(g => g.id === id);
    }

    getItem(id: string): ItemType | undefined {
        return this.getProject(id) ?? this.getGroup(id);
    }

    async addProject(project: Project, groupId?: string): Promise<void> {
        this.data.projects.push(project);
        if (groupId) {
            const group = this.getGroup(groupId);
            if (group) {
                group.children.push(project.id);
            } else {
                this.data.rootOrder.push(project.id);
            }
        } else {
            this.data.rootOrder.push(project.id);
        }
        await this.save();
    }

    async addGroup(group: Group): Promise<void> {
        this.data.groups.push(group);
        this.data.rootOrder.push(group.id);
        await this.save();
    }

    async updateProject(id: string, changes: Partial<Omit<Project, 'id' | 'type'>>): Promise<void> {
        const project = this.getProject(id);
        if (project) {
            Object.assign(project, changes);
            await this.save();
        }
    }

    async updateGroup(id: string, changes: Partial<Omit<Group, 'id' | 'type' | 'children'>>): Promise<void> {
        const group = this.getGroup(id);
        if (group) {
            Object.assign(group, changes);
            await this.save();
        }
    }

    async removeItem(id: string): Promise<void> {
        const group = this.getGroup(id);
        if (group) {
            // Move group's children to root at the group's position
            const groupIndex = this.data.rootOrder.indexOf(id);
            this.data.rootOrder.splice(groupIndex, 1, ...group.children);
            this.data.groups = this.data.groups.filter(g => g.id !== id);
        } else {
            // Remove project
            this.data.projects = this.data.projects.filter(p => p.id !== id);
            // Remove from rootOrder
            this.data.rootOrder = this.data.rootOrder.filter(i => i !== id);
            // Remove from any group
            for (const g of this.data.groups) {
                g.children = g.children.filter(c => c !== id);
            }
        }
        await this.save();
    }

    async moveToGroup(projectId: string, targetGroupId: string | null): Promise<void> {
        // Remove from current location
        this.data.rootOrder = this.data.rootOrder.filter(i => i !== projectId);
        for (const g of this.data.groups) {
            g.children = g.children.filter(c => c !== projectId);
        }

        // Add to new location
        if (targetGroupId) {
            const group = this.getGroup(targetGroupId);
            if (group) {
                group.children.push(projectId);
            }
        } else {
            this.data.rootOrder.push(projectId);
        }
        await this.save();
    }

    async reorder(itemId: string, targetId: string, position: 'before' | 'after'): Promise<void> {
        // Find which list the target is in
        const targetInRoot = this.data.rootOrder.includes(targetId);
        let targetGroup: Group | undefined;
        if (!targetInRoot) {
            targetGroup = this.data.groups.find(g => g.children.includes(targetId));
        }

        const list = targetGroup ? targetGroup.children : this.data.rootOrder;

        // Remove item from all locations first
        this.data.rootOrder = this.data.rootOrder.filter(i => i !== itemId);
        for (const g of this.data.groups) {
            g.children = g.children.filter(c => c !== itemId);
        }

        // Re-fetch list reference after mutation
        const insertList = targetGroup ? targetGroup.children : this.data.rootOrder;
        const targetIndex = insertList.indexOf(targetId);
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        insertList.splice(insertIndex, 0, itemId);

        await this.save();
    }

    findParentGroup(projectId: string): Group | undefined {
        return this.data.groups.find(g => g.children.includes(projectId));
    }

    isEmpty(): boolean {
        return this.data.projects.length === 0 && this.data.groups.length === 0;
    }
}
