# Bob Insights MCP Server - Quick Start

Get up and running in 2 minutes!

## Installation (Choose One)

### ⚡ Option 1: npx (Easiest - No Installation!)

Just add this to your Bob MCP settings:

```json
{
  "mcpServers": {
    "bob-insights": {
      "command": "npx",
      "args": ["-y", "@bob-ai/insights-mcp"]
    }
  }
}
```

**Settings file location:**
- Windows: `C:\Users\<YourUsername>\.bob\settings\mcp_settings.json`
- macOS: `~/.bob/settings/mcp_settings.json`

### 🚀 Option 2: Global Install (Faster Startup)

```bash
npm install -g @bob-ai/insights-mcp
```

Then add to Bob settings:

```json
{
  "mcpServers": {
    "bob-insights": {
      "command": "bob-insights-mcp"
    }
  }
}
```

## Restart Bob

After updating the settings file, restart Bob AI assistant.

## Try It Out!

Ask Bob:

```
Can you list my recent conversations?
```

Bob will use the MCP server to show your conversation history with problem scores!

## What You Can Do

### 1. List Conversations
```
Show me my last 20 conversations
List conversations with problem scores above 30
```

### 2. Analyze Problems
```
Analyze my problematic conversations from the last week
What issues have I been having recently?
```

### 3. Get Details
```
Show me details for conversation <task-id>
```

## Understanding Problem Scores

- **70-100**: High severity - significant issues
- **40-69**: Medium severity - notable problems  
- **30-39**: Low severity - minor issues
- **0-29**: Smooth conversation

## Need Help?

- Full documentation: [README.md](README.md)
- Installation guide: [INSTALLATION.md](INSTALLATION.md)
- Issues: Report on GitHub

## Publishing to npm

**For maintainers:** To publish this package to npm:

```bash
# Login to npm (first time only)
npm login

# Publish the package
npm publish --access public
```

The package will be available as `@bob-ai/insights-mcp` on npm.

---

That's it! You're ready to analyze your Bob conversations. 🎉