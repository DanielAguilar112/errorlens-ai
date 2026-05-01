import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: vscode.workspace.getConfiguration('errorlensAi').get('apiKey') || ''
});

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('ErrorLens AI');
  outputChannel.appendLine('ErrorLens AI activated');

  // Watch terminal for errors
 const terminalDataListener = vscode.window.onDidChangeTerminalState(async (terminal) => {
    // fallback: manual trigger only for now
  });

  // Manual trigger command
  const explainCommand = vscode.commands.registerCommand('errorlens-ai.explain', async () => {
    const text = await vscode.window.showInputBox({
      prompt: 'Paste your error message',
      placeHolder: 'Error: cannot read properties of undefined...'
    });
    if (text) { await explainError(text); }
  });

  context.subscriptions.push(terminalDataListener, explainCommand);
}

function isError(text: string): boolean {
  const errorPatterns = [
    /error:/i,
    /exception:/i,
    /traceback/i,
    /syntaxerror/i,
    /typeerror/i,
    /referenceerror/i,
    /cannot read/i,
    /is not defined/i,
    /failed to/i,
    /uncaught/i,
  ];
  return errorPatterns.some(p => p.test(text));
}

async function explainError(errorText: string) {
  const apiKey = vscode.workspace.getConfiguration('errorlensAi').get<string>('apiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('ErrorLens AI: No API key set. Go to Settings → errorlensAi.apiKey');
    return;
  }

  // Get open file context
  const editor = vscode.window.activeTextEditor;
  const fileContext = editor
    ? `File: ${editor.document.fileName}\n\n${editor.document.getText().slice(0, 3000)}`
    : 'No file open';

  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'ErrorLens AI: Analyzing error...' },
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