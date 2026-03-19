import * as vscode from 'vscode';
import { Storage } from './storage';
import { createProjectTreeItem, createGroupTreeItem } from './treeItems';

interface TreeNode {
    id: string;
    type: 'project' | 'group';
}

const MIME_TYPE = 'application/vnd.code.tree.projectManagerView';

export class ProjectTreeProvider
    implements vscode.TreeDataProvider<TreeNode>, vscode.TreeDragAndDropController<TreeNode>
{
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    readonly dragMimeTypes = [MIME_TYPE];
    readonly dropMimeTypes = [MIME_TYPE];

    private collapsedGroups: Set<string>;

    constructor(
        private storage: Storage,
        private extensionUri: vscode.Uri,
        private globalState: vscode.Memento,
    ) {
        const saved: string[] = globalState.get('collapsedGroups', []);
        this.collapsedGroups = new Set(saved);
    }

    setCollapsed(id: string, collapsed: boolean): void {
        if (collapsed) {
            this.collapsedGroups.add(id);
        } else {
            this.collapsedGroups.delete(id);
        }
        this.globalState.update('collapsedGroups', [...this.collapsedGroups]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        if (element.type === 'group') {
            const group = this.storage.getGroup(element.id);
            if (!group) {
                return new vscode.TreeItem('Unknown');
            }
            const collapsed = this.collapsedGroups.has(element.id);
            return createGroupTreeItem(group, group.children.length, this.extensionUri, collapsed);
        }

        const project = this.storage.getProject(element.id);
        if (!project) {
            return new vscode.TreeItem('Unknown');
        }
        return createProjectTreeItem(project, this.extensionUri);
    }

    getChildren(element?: TreeNode): TreeNode[] {
        const data = this.storage.getData();

        if (!element) {
            // Root level: return items in rootOrder
            return data.rootOrder.map(id => {
                const group = this.storage.getGroup(id);
                return { id, type: group ? 'group' as const : 'project' as const };
            });
        }

        if (element.type === 'group') {
            const group = this.storage.getGroup(element.id);
            if (!group) { return []; }
            return group.children.map(id => ({ id, type: 'project' as const }));
        }

        return [];
    }

    getParent(element: TreeNode): TreeNode | undefined {
        if (element.type === 'project') {
            const parentGroup = this.storage.findParentGroup(element.id);
            if (parentGroup) {
                return { id: parentGroup.id, type: 'group' };
            }
        }
        return undefined;
    }

    // --- Drag and Drop ---

    handleDrag(source: readonly TreeNode[], dataTransfer: vscode.DataTransfer): void {
        const ids = source.map(s => s.id);
        dataTransfer.set(MIME_TYPE, new vscode.DataTransferItem(ids));
    }

    async handleDrop(target: TreeNode | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
        const transferItem = dataTransfer.get(MIME_TYPE);
        if (!transferItem) { return; }

        const draggedIds: string[] = transferItem.value;
        if (!draggedIds || draggedIds.length === 0) { return; }

        const draggedId = draggedIds[0];
        const draggedItem = this.storage.getItem(draggedId);
        if (!draggedItem) { return; }

        // Don't allow dropping groups into groups
        if (draggedItem.type === 'group' && target?.type === 'group') {
            return;
        }

        if (!target) {
            // Dropped on root - move to root level
            await this.storage.moveToGroup(draggedId, null);
        } else if (target.type === 'group') {
            // Dropped on a group - move into it
            if (draggedItem.type === 'project') {
                await this.storage.moveToGroup(draggedId, target.id);
            }
        } else if (target.type === 'project') {
            // Dropped on a project - place after it in the same parent
            await this.storage.reorder(draggedId, target.id, 'after');
        }

        this.refresh();
    }
}
