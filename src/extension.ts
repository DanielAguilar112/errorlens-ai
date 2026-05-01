import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('ErrorLens AI');
  outputChannel.appendLine('ErrorLens AI activated');

  // Auto-detect: watch for diagnostic changes (red squiggles)
  const diagnosticListener = vscode.languages.onDidChangeDiagnostics(async (e) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    // Only react if the active file has new errors
    if (!e.uris.some(uri => uri.toString() === editor.document.uri.toString())) { return; }

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
      .filter(d => d.severity === vscode.DiagnosticSeverity.Error);

    if (diagnostics.length === 0) { return; }

    // Only auto-explain if setting is enabled
    const autoExplain = vscode.workspace.getConfiguration('errorlensAi').get<boolean>('autoExplain');
    if (!autoExplain) { return; }

    const errorText = diagnostics
      .slice(0, 3) // max 3 errors at once
      .map(d => `Line ${d.range.start.line + 1}: ${d.message}`)
      .join('\n');

    await explainError(errorText, editor);
  });

  // Manual trigger command
  const explainCommand = vscode.commands.registerCommand('errorlens-ai.explain', async () => {
    const editor = vscode.window.activeTextEditor;

    // Try to use current file's errors first
    if (editor) {
      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
        .filter(d => d.severity === vscode.DiagnosticSeverity.Error);

      if (diagnostics.length > 0) {
        const errorText = diagnostics
          .slice(0, 3)
          .map(d => `Line ${d.range.start.line + 1}: ${d.message}`)
          .join('\n');
        await explainError(errorText, editor);
        return;
      }
    }

    // Fallback: manual paste
    const text = await vscode.window.showInputBox({
      prompt: 'Paste your error message',
      placeHolder: 'Error: cannot read properties of undefined...'
    });
    if (text) { await explainError(text, editor); }
  });

  // Quick fix command from notification
  const explainSelectionCommand = vscode.commands.registerCommand('errorlens-ai.explainSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const selected = editor.document.getText(editor.selection);
    if (selected) { await explainError(selected, editor); }
  });

  context.subscriptions.push(diagnosticListener, explainCommand, explainSelectionCommand);
}

async function explainError(errorText: string, editor?: vscode.TextEditor | null) {
  const apiKey = vscode.workspace.getConfiguration('errorlensAi').get<string>('apiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('ErrorLens AI: No API key set. Go to Settings → errorlensAi.apiKey');
    return;
  }

  const fileContext = editor
    ? `File: ${editor.document.fileName}\n\n${editor.document.getText().slice(0, 3000)}`
    : 'No file open';

  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'ErrorLens AI: Analyzing...' },
    async () => {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: `You are a debugging assistant. Explain this error clearly and concisely, referencing the actual code if relevant. Give a specific fix.

ERROR:
${errorText.slice(0, 2000)}

CODE CONTEXT:
${fileContext}

Respond in 3 sections:
1. **What went wrong** (1-2 sentences)
2. **Why it happened** (1-2 sentences)
3. **Fix** (specific code or steps)`
            }]
          })
        });

        const data = await response.json() as any;
        const explanation = data.content?.[0]?.text || 'No explanation returned.';

        outputChannel.clear();
        outputChannel.appendLine('━'.repeat(60));
        outputChannel.appendLine('🔍 ErrorLens AI — Error Explanation');
        outputChannel.appendLine('━'.repeat(60));
        outputChannel.appendLine('');
        outputChannel.appendLine(explanation);
        outputChannel.appendLine('');
        outputChannel.show(true);

      } catch (err) {
        vscode.window.showErrorMessage(`ErrorLens AI failed: ${err}`);
      }
    }
  );
}

export function deactivate() {}