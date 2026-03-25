export interface Project {
    id: string;
    type: 'project';
    name: string;
    folderPath: string;
    iconPath?: string;
    lastOpened?: number;
}

export interface Group {
    id: string;
    type: 'group';
    name: string;
    iconPath?: string;
    children: string[];
}

export interface StorageData {
    version: 1;
    groups: Group[];
    projects: Project[];
    rootOrder: string[];
}

export type ItemType = Project | Group;
