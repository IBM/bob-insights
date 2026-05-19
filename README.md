# Bob Insights MCP Server

MCP server to analyze your local Bob AI conversation history. Identifies problematic conversations using regex pre-filtering and provides tools for detailed analysis.

## Quick Start

Add to your Bob MCP settings (`~/.bob/settings/mcp_settings.json`):

```json
{
  "mcpServers": {
    "bob-insights": {
      "command": "npx",
      "args": ["-y", "github:IBM/bob-insights"]
    }
  }
}
```

Restart Bob and try: `"Can you list my recent conversations?"`

## Installation Options

### Option 1: npx (Recommended)
No installation needed - uses latest from GitHub automatically.

### Option 2: Global Install
```bash
npm install -g github:IBM/bob-insights
```

Then configure:
```json
{
  "mcpServers": {
    "bob-insights": {
      "command": "bob-insights-mcp"
    }
  }
}
```

### Option 3: From Source
```bash
git clone https://github.com/IBM/bob-insights.git
cd bob-insights
npm install && npm run build
```

Configure with local path:
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

## Available Tools

### `list_conversations`
List recent conversations with problem scores.

**Parameters:**
- `limit` (optional): Number of conversations (default: 10, max: 100)
- `days` (optional): Only from last N days
- `minScore` (optional): Minimum problem score (default: 0)

**Example:** `"Show me my last 20 conversations with problem scores above 30"`

### `get_conversation`
Get detailed information about a specific conversation.

**Parameters:**
- `taskId` (required): The conversation task ID

**Example:** `"Show me details for conversation abc123xyz"`

### `analyze_problems`
Generate analysis prompt for problematic conversations.

**Parameters:**
- `limit` (optional): Number to check (default: 20)
- `days` (optional): Only from last N days
- `minScore` (optional): Minimum score to analyze (default: 30)
- `question` (optional): Custom analysis question

**Example:** `"Analyze my problematic conversations from the last week"`

## Problem Scoring

Conversations are scored 0-100 based on:

| Indicator | Points | Max |
|-----------|--------|-----|
| Tool failures | 10 each | 30 |
| Error mentions | 2 each | 20 |
| Retry attempts | 3 each | 15 |
| Negative feedback | 2 each | 15 |
| Confusion signals | 2 each | 10 |
| Long conversation (>20 msgs) | 5 | 5 |
| High tool usage (>15 tools) | 5 | 5 |

**Severity:**
- 70-100: High
- 40-69: Medium
- 30-39: Low
- 0-29: Smooth

## How It Works

1. Automatically finds Bob conversation history in local storage
2. Uses regex to detect problem indicators (errors, retries, negative feedback)
3. Calculates problem scores (0-100)
4. Provides tools for Bob to analyze conversations
5. Reduces LLM analysis costs by 80-90% through smart filtering

## Storage Locations

- **Windows**: `%APPDATA%\Bob-IDE\User\globalStorage\ibm.bob-code\tasks`
- **macOS**: `~/Library/Application Support/Bob-IDE/User/globalStorage/ibm.bob-code/tasks`

## Development

```bash
npm install
npm run build      # Compile TypeScript
npm run watch      # Watch mode
```

## License

MIT
