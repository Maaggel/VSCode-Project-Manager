import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Extracts an icon from an .exe or converts an .ico file to a .png,
 * storing the result in the extension's global storage directory.
 * Returns the path to the resulting .png file.
 */
export async function extractIcon(
    sourcePath: string,
    storageUri: vscode.Uri,
): Promise<string | undefined> {
    const ext = path.extname(sourcePath).toLowerCase();
    if (ext !== '.ico' && ext !== '.exe') {
        return sourcePath;
    }

    const hash = crypto.createHash('md5').update(sourcePath).digest('hex').slice(0, 12);
    const baseName = path.basename(sourcePath, ext);
    const pngName = `${baseName}-${hash}.png`;

    const iconsDir = vscode.Uri.joinPath(storageUri, 'extracted-icons');
    await vscode.workspace.fs.createDirectory(iconsDir);

    const outPath = vscode.Uri.joinPath(iconsDir, pngName).fsPath;

    // Check if already extracted
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(outPath));
        return outPath;
    } catch {
        // Not yet extracted, continue
    }

    const psScript = ext === '.exe'
        ? `
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${sourcePath.replace(/'/g, "''")}')
if ($icon) {
    $bmp = $icon.ToBitmap()
    $bmp.Save('${outPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $icon.Dispose()
}
`
        : `
Add-Type -AssemblyName System.Drawing
$icon = New-Object System.Drawing.Icon('${sourcePath.replace(/'/g, "''")}', 256, 256)
$bmp = $icon.ToBitmap()
$bmp.Save('${outPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$icon.Dispose()
`;

    try {
        await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            psScript,
        ], { timeout: 10000 });

        // Verify the file was created
        await vscode.workspace.fs.stat(vscode.Uri.file(outPath));
        return outPath;
    } catch (err) {
        vscode.window.showWarningMessage(
            `Could not extract icon from "${path.basename(sourcePath)}": ${err instanceof Error ? err.message : String(err)}`
        );
        return undefined;
    }
}
