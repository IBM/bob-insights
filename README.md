# Bob Insights MCP Server

MCP server to get insights from your local Bob conversation history. This server provides tools to analyze your Bob AI assistant conversations, identify problematic patterns, and generate actionable insights.

## Features

- **Cost-Optimized Analysis**: Uses regex pre-filtering to identify problematic conversations before LLM analysis
- **Problem Scoring**: Automatically scores conversations (0-100) based on errors, retries, and negative feedback
- **Three Powerful Tools**:
  - `list_conversations`: List recent conversations with problem scores
  - `get_conversation`: Get detailed information about a specific conversation
  - `analyze_problems`: Generate analysis prompts for problematic conversations

## Installation

### Prerequisites

- Node.js 18 or higher
- Bob AI assistant installed with conversation history

### Option 1: Install from Source

1. Clone this repository:
```bash
git clone <repository-url>
cd bob-insights
```

2. Install dependencies and build:
```bash
npm install
npm run build
```

3. The server will be built to `build/index.js`

### Option 2: Install Globally

```bash
npm install -g .
```

This makes the `bob-insights-mcp` command available globally.

## Configuration

Add the MCP server to your Bob settings file at:
- **Windows**: `C:\Users\<YourUsername>\.bob\settings\mcp_settings.json`
- **macOS**: `~/.bob/settings/mcp_settings.json`

```json
{
  "mcpServers": {
    "bob-insights": {
      "command": "node",
      "args": ["C:/Users/<YourUsername>/Documents/bob-insights/build/index.js"],
      "disabled": false,
      "alwaysAllow": [],
      "disabledTools": []
    }
  }
}
```

**Note**: Adjust the path in `args` to match where you cloned/installed the repository.

### Alternative: Claude Desktop Configuration

You can also use this server with Claude Desktop. Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

## Usage

Once configured, the server exposes three tools that Bob (or Claude) can use:

### 1. List Conversations

List recent conversations with their problem scores:

```
Can you list my recent Bob conversations?
```

**Parameters**:
- `limit` (optional): Number of conversations to list (default: 10, max: 100)
- `days` (optional): Only list conversations from last N days
- `minScore` (optional): Minimum problem score to include (default: 0)

**Example**:
```
Show me the 20 most recent conversations with problem scores above 30
```

### 2. Get Conversation Details

Retrieve detailed information about a specific conversation:

```
Get details for conversation <task-id>
```

**Parameters**:
- `taskId` (required): The task ID of the conversation

**Example**:
```
Show me the full details of conversation abc123xyz
```

### 3. Analyze Problematic Conversations

Generate an analysis prompt for problematic conversations:

```
Analyze my recent problematic conversations
```

**Parameters**:
- `limit` (optional): Number of recent conversations to check (default: 20)
- `days` (optional): Only analyze conversations from last N days
- `minScore` (optional): Minimum problem score to analyze (default: 30)
- `question` (optional): Custom question for analysis

**Example**:
```
Analyze my conversations from the last 7 days with problem scores above 40
```

## Problem Scoring System

Conversations are automatically scored (0-100) based on:

| Indicator | Points | Max Points |
|-----------|--------|------------|
| Tool failures | 10 each | 30 |
| Error mentions | 2 each | 20 |
| Retry attempts | 3 each | 15 |
| Negative feedback | 2 each | 15 |
| Confusion signals | 2 each | 10 |
| Long conversation (>20 messages) | 5 | 5 |
| High tool usage (>15 tools) | 5 | 5 |

**Score Interpretation**:
- **70-100**: High severity - significant issues
- **40-69**: Medium severity - notable problems
- **30-39**: Low severity - minor issues
- **0-29**: Smooth conversation

## Example Workflows

### Check Recent Issues

```
List my last 20 conversations and show me which ones had problems
```

### Deep Dive on Specific Period

```
Analyze conversations from the last week with problem scores above 50
```

### Track Improvement Over Time

```
Show me problem scores for conversations from the last 30 days
```

### Investigate Specific Conversation

```
Get full details for conversation abc123xyz
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Project Structure

```
bob-insights/
├── src/
│   └── index.ts          # Main MCP server implementation
├── build/                # Compiled JavaScript (generated)
├── skills/               # Original skill implementation
│   └── conversation-analysis/
│       ├── analyze-conversations.ts
│       └── SKILL.md
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Storage Detection**: Automatically finds Bob conversation history in:
   - Windows: `%APPDATA%\Bob-IDE\User\globalStorage\ibm.bob-code\tasks`
   - macOS: `~/Library/Application Support/Bob-IDE/User/globalStorage/ibm.bob-code/tasks`

2. **Regex Pre-filtering**: Scans conversations for problem indicators (errors, retries, negative feedback)

3. **Problem Scoring**: Calculates a 0-100 score based on detected issues

4. **Selective Analysis**: Only conversations above the threshold are sent for LLM analysis

5. **Cost Optimization**: Reduces LLM analysis costs by 80-90% through smart filtering

## Troubleshooting

### "No conversations found"

- Ensure Bob AI assistant is installed and you have conversation history
- Check that the storage paths are correct for your OS
- Verify Bob has created conversations in the expected location

### Server not appearing in Bob

- Check the MCP settings file path is correct
- Verify the `args` path points to the built `index.js` file
- Restart Bob after modifying the settings file
- Check Bob logs for any server connection errors

### Build errors

- Ensure Node.js 18+ is installed
- Run `npm install` to install dependencies
- Check for TypeScript compilation errors

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

Made with ❤️ for the Bob AI community
