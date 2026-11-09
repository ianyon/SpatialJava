import * as vscode from 'vscode';
import { VisualizerPanel } from './VisualizerPanel';
import { parseJavaMethods } from './parser';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('spatialJava.open', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'java') {
            vscode.window.showErrorMessage('Please open a Java file to use the SpatialJava editor.');
            return;
        }

        const text = editor.document.getText();
        const methods = parseJavaMethods(text);
        
        if (methods.length === 0) {
            vscode.window.showInformationMessage('No methods found in this Java file.');
            return;
        }

        VisualizerPanel.createOrShow(context.extensionUri, methods, editor.document.fileName);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
