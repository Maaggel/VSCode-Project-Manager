import * as vscode from 'vscode';
import { Storage } from './storage';
import { createProjectTreeItem, createGroupTreeItem, createSectionTreeItem } from './treeItems';

interface TreeNode {
    id: string;
    type: 'project' | 'group' | 'section';
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

    private getRecentCount(): number {
        const config = vscode.workspace.getConfiguration('projectManager');
        return config.get<number>('recentProjectsCountSidebar', 3);
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        if (element.type === 'section') {
            return createSectionTreeItem('Recent Projects', element.id);
        }

        if (element.type === 'group') {
            const group = this.storage.getGroup(element.id);
            if (!group) {
                return new vscode.TreeItem('Unknown');
            }
            const collapsed = this.collapsedGroups.has(element.id);
            return createGroupTreeItem(group, group.children.length, this.extensionUri, collapsed);
        }

        const projectId = element.id.startsWith('__recent__') ? element.id.slice('__recent__'.length) : element.id;
        const project = this.storage.getProject(projectId);
        if (!project) {
            return new vscode.TreeItem('Unknown');
        }
        const item = createProjectTreeItem(project, this.extensionUri);
        if (element.id.startsWith('__recent__')) {
            item.id = element.id; // Use unique ID so tree doesn't confuse it with the normal entry
        }
        return item;
    }

    getChildren(element?: TreeNode): TreeNode[] {
        const data = this.storage.getData();

        if (!element) {
            const nodes: TreeNode[] = [];
            const recentCount = this.getRecentCount();
            const recentProjects = this.storage.getRecentProjects(recentCount);
            if (recentProjects.length > 0) {
                nodes.push({ id: '__recent__', type: 'section' });
            }
            // Root level: return items in rootOrder
            for (const id of data.rootOrder) {
                const group = this.storage.getGroup(id);
                nodes.push({ id, type: group ? 'group' as const : 'project' as const });
            }
            return nodes;
        }

        if (element.type === 'section') {
            const recentCount = this.getRecentCount();
            return this.storage.getRecentProjects(recentCount).map(p => ({
                id: `__recent__${p.id}`,
                type: 'project' as const,
            }));
        }

        if (element.type === 'group') {
            const group = this.storage.getGroup(element.id);
            if (!group) { return []; }
            return group.children.map(id => {
                const childGroup = this.storage.getGroup(id);
                return { id, type: childGroup ? 'group' as const : 'project' as const };
            });
        }

        return [];
    }

    getParent(element: TreeNode): TreeNode | undefined {
        if (element.id.startsWith('__recent__') && element.type === 'project') {
            return { id: '__recent__', type: 'section' };
        }
        if (element.type === 'section') {
            return undefined;
        }
        const parentGroup = this.storage.findParentGroup(element.id);
        if (parentGroup) {
            return { id: parentGroup.id, type: 'group' };
        }
        return undefined;
    }

    // --- Drag and Drop ---

    handleDrag(source: readonly TreeNode[], dataTransfer: vscode.DataTransfer): void {
        // Don't allow dragging section headers or recent items
        const draggable = source.filter(s => s.type !== 'section' && !s.id.startsWith('__recent__'));
        if (draggable.length === 0) { return; }
        const ids = draggable.map(s => s.id);
        dataTransfer.set(MIME_TYPE, new vscode.DataTransferItem(ids));
    }

    async handleDrop(target: TreeNode | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
        // Don't allow dropping onto recent section or its items
        if (target?.type === 'section' || target?.id.startsWith('__recent__')) { return; }

        const transferItem = dataTransfer.get(MIME_TYPE);
        if (!transferItem) { return; }

        const draggedIds: string[] = transferItem.value;
        if (!draggedIds || draggedIds.length === 0) { return; }

        const draggedId = draggedIds[0];
        const draggedItem = this.storage.getItem(draggedId);
        if (!draggedItem) { return; }

        // Don't allow dropping a group into itself or its descendants
        if (draggedItem.type === 'group' && target?.type === 'group') {
            if (this.storage.isAncestorOf(draggedId, target.id)) {
                return;
            }
        }

        if (!target) {
            // Dropped on root - move to root level
            await this.storage.moveToGroup(draggedId, null);
        } else if (target.type === 'group') {
            // Dropped on a group - move into it
            await this.storage.moveToGroup(draggedId, target.id);
        } else if (target.type === 'project') {
            // Dropped on a project - place after it in the same parent
            await this.storage.reorder(draggedId, target.id, 'after');
        }

        this.refresh();
    }
}
