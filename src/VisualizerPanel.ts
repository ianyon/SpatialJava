import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { JavaMethod } from './parser';

export class VisualizerPanel {
    public static currentPanel: VisualizerPanel | undefined;
    public static readonly viewType = 'spatialJavaVisualizer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, methods: JavaMethod[], fileName: string) {
        const column = vscode.ViewColumn.Beside;

        if (VisualizerPanel.currentPanel) {
            VisualizerPanel.currentPanel._panel.reveal(column);
            VisualizerPanel.currentPanel._update(methods, fileName);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            VisualizerPanel.viewType,
            `Spatial: ${path.basename(fileName)}`,
            column,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        VisualizerPanel.currentPanel = new VisualizerPanel(panel, extensionUri, methods, fileName);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, methods: JavaMethod[], fileName: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update(methods, fileName);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public dispose() {
        VisualizerPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(methods: JavaMethod[], fileName: string) {
        this._panel.title = `Spatial: ${path.basename(fileName)}`;
        this._panel.webview.html = this._getHtmlForWebview(methods, fileName);
    }

    private _getHtmlForWebview(methods: JavaMethod[], fileName: string): string {
        const webviewHtmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview.html');
        let html = fs.readFileSync(webviewHtmlPath, 'utf8');

        const className = path.basename(fileName, path.extname(fileName));
        const rawData = {
            className,
            methods
        };

        const injectStart = '// INJECT_DATA_START';
        const injectEnd = '// INJECT_DATA_END';

        const startIndex = html.indexOf(injectStart);
        const endIndex = html.indexOf(injectEnd);

        if (startIndex !== -1 && endIndex !== -1) {
            const before = html.substring(0, startIndex + injectStart.length);
            const after = html.substring(endIndex);
            html = `${before}\nconst RAW = ${JSON.stringify(rawData, null, 2)};\n${after}`;
        }

        html = html.replace(
            /<h1>⬡ .*?<span>\.java<\/span><\/h1>/,
            `<h1>⬡ ${className}<span>.java</span></h1>`
        );

        return html;
    }
}
