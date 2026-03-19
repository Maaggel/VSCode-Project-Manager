import * as vscode from 'vscode';
import * as path from 'path';

export interface BuiltinIcon {
    id: string;
    label: string;
    codicon: string; // for quick pick display
}

export const BUILTIN_ICONS: BuiltinIcon[] = [
    { id: 'code', label: 'Code', codicon: 'code' },
    { id: 'web', label: 'Web / Globe', codicon: 'globe' },
    { id: 'mobile', label: 'Mobile', codicon: 'device-mobile' },
    { id: 'api', label: 'API / Server', codicon: 'server' },
    { id: 'database', label: 'Database', codicon: 'database' },
    { id: 'game', label: 'Game', codicon: 'game' },
    { id: 'music', label: 'Music', codicon: 'music' },
    { id: 'design', label: 'Design', codicon: 'symbol-color' },
    { id: 'book', label: 'Docs / Book', codicon: 'book' },
    { id: 'notes', label: 'Notes', codicon: 'note' },
    { id: 'star', label: 'Star', codicon: 'star-full' },
    { id: 'rocket', label: 'Rocket', codicon: 'rocket' },
    { id: 'bolt', label: 'Lightning', codicon: 'zap' },
    { id: 'heart', label: 'Heart', codicon: 'heart' },
    { id: 'leaf', label: 'Sparkle', codicon: 'sparkle' },
    { id: 'coffee', label: 'Coffee', codicon: 'coffee' },
    { id: 'terminal', label: 'Terminal', codicon: 'terminal' },
    { id: 'tools', label: 'Tools', codicon: 'tools' },
    { id: 'cloud', label: 'Cloud', codicon: 'cloud' },
    { id: 'bug', label: 'Bug', codicon: 'bug' },
    { id: 'home', label: 'Home', codicon: 'home' },
    { id: 'shield', label: 'Security / Shield', codicon: 'shield' },
    { id: 'flask', label: 'Experiment / Lab', codicon: 'beaker' },
    { id: 'package', label: 'Package', codicon: 'package' },
    { id: 'camera', label: 'Camera / Photo', codicon: 'device-camera' },
    { id: 'puzzle', label: 'Plugin / Puzzle', codicon: 'extensions' },
];

export const BUILTIN_PREFIX = 'builtin:';

export function isBuiltinIcon(iconPath: string | undefined): boolean {
    return !!iconPath && iconPath.startsWith(BUILTIN_PREFIX);
}

export function getBuiltinIconId(iconPath: string): string {
    return iconPath.slice(BUILTIN_PREFIX.length);
}

export function resolveIconPath(
    iconPath: string | undefined,
    extensionUri: vscode.Uri,
    fallbackThemeIcon: string,
): vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri } | vscode.Uri {
    if (!iconPath) {
        return new vscode.ThemeIcon(fallbackThemeIcon);
    }

    if (isBuiltinIcon(iconPath)) {
        const iconId = getBuiltinIconId(iconPath);
        const entry = BUILTIN_ICONS.find(i => i.id === iconId);
        if (entry) {
            return new vscode.ThemeIcon(entry.codicon);
        }
        return new vscode.ThemeIcon(fallbackThemeIcon);
    }

    return vscode.Uri.file(iconPath);
}
