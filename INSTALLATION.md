# Bob Insights MCP Server - Installation Guide

This guide will walk you through installing and configuring the Bob Insights MCP server.

## Quick Start

### Step 1: Build the Server

From the repository root:

```bash
npm install
npm run build
```

This will:
- Install all dependencies
- Compile TypeScript to JavaScript
- Create the executable in `build/index.js`

### Step 2: Configure Bob

1. Open your Bob MCP settings file:
   - **Windows**: `C:\Users\<YourUsername>\.bob\settings\mcp_settings.json`
   - **macOS**: `~/.bob/settings/mcp_settings.json`

2. Add the server configuration:

```json
{
  "mcpServers": {
    "bob-insights": {
      "command": "node",
      "args": ["C:/Users/GregoireCATTAN/Documents/bob-insights/build/index.js"],
      "disabled": false,
      "alwaysAllow": [],
      "disabledTools": []
    }
  }
}
```

**Important**: Replace the path in `args` with the actual path to your `build/index.js` file.

### Step 3: Restart Bob

After saving the configuration file, restart Bob AI assistant for the changes to take effect.

### Step 4: Verify Installation

Ask Bob:
```
Can you list my recent conversations?
```

If the server is working, Bob will use the `list_conversations` tool to show your conversation history with problem scores.

## Configuration Options

### Basic Configuration

```json
{
  "command": "node",
  "args": ["/path/to/bob-insights/build/index.js"]
}
```

### Advanced Configuration

```json
{
  "command": "node",
  "args": ["/path/to/bob-insights/build/index.js"],
  "disabled": false,
  "timeout": 60,
  "alwaysAllow": ["list_conversations"],
  "disabledTools": []
}
```

**Options**:
- `disabled`: Set to `true` to temporarily disable the server
- `timeout`: Maximum time in seconds to wait for responses (default: 60)
- `alwaysAllow`: Tools that don't require user confirmation
- `disabledTools`: Tools to exclude from the system prompt

## Troubleshooting

### Server Not Connecting

1. **Check the path**: Ensure the path in `args` is correct and points to `build/index.js`
2. **Check Node.js**: Verify Node.js 18+ is installed: `node --version`
3. **Check build**: Ensure `build/index.js` exists and is executable
4. **Check logs**: Look for errors in Bob's output panel

### No Conversations Found

1. **Verify Bob installation**: Ensure Bob AI assistant is installed
2. **Check conversation history**: Verify you have created conversations in Bob
3. **Check storage paths**: The server looks for conversations in:
   - Windows: `%APPDATA%\Bob-IDE\User\globalStorage\ibm.bob-code\tasks`
   - macOS: `~/Library/Application Support/Bob-IDE/User/globalStorage/ibm.bob-code/tasks`

### Build Errors

If you encounter build errors:

```bash
# Clean and rebuild
rm -rf node_modules build
npm install
npm run build
```

## Using with Claude Desktop

You can also use this server with Claude Desktop:

1. Open Claude's config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the server:

```json
{
  "mcpServers": {
    "bob-insights": {
      "command": "node",
      "args": ["/path/to/bob-insights/build/index.js"]
    }
  }
}
```

3. Restart Claude Desktop

## Next Steps

Once installed, try these commands:

1. **List recent conversations**:
   ```
   Show me my last 20 Bob conversations
   ```

2. **Find problematic conversations**:
   ```
   List conversations with problem scores above 30
   ```

3. **Analyze issues**:
   ```
   Analyze my problematic conversations from the last week
   ```

4. **Get conversation details**:
   ```
   Show me details for conversation <task-id>
   ```

## Support

If you encounter issues:

1. Check the [README.md](README.md) for detailed documentation
2. Verify your Node.js version: `node --version` (should be 18+)
3. Check Bob's logs for error messages
4. Ensure the build completed successfully

## Updating

To update the server:

```bash
git pull
npm install
npm run build
```

Then restart Bob to load the updated server.