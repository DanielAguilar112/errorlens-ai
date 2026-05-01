# ErrorLens AI

A VS Code extension that explains errors in the context of your actual code using Claude AI.

## What it does

When you hit an error, ErrorLens AI reads both the error message and your open file, then gives you a specific explanation — not generic Stack Overflow advice, but an answer that references your actual variable names, line numbers, and logic.

**Example output:**
> The `users` variable was set to `undefined` on line 1. When `getNames()` calls `users.map()` on line 4, it fails because `undefined` has no `map` method. Fix: initialize `users` as `[]` or add a null check.

## Features

- 🔍 Explains errors in the context of your actual code
- ⚡ Triggered manually or auto-detects diagnostics
- 📋 Clean formatted output in VS Code output panel
- 🔧 Suggests specific fixes with code examples

## Setup

1. Install the extension
2. Go to **Settings** → search `errorlensAi`
3. Paste your [Anthropic API key](https://console.anthropic.com)

## Usage

1. Open any file with an error
2. Press `Ctrl+Shift+P`
3. Run **ErrorLens AI: Explain Error**
4. Get a specific explanation instantly

## Built with

- VS Code Extension API
- Claude claude-sonnet-4-20250514 (Anthropic)
- TypeScript
