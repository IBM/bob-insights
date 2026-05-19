#!/usr/bin/env ts-node
/**
 * Standalone conversation analysis script for Bob SKILL
 * Reads conversations directly from local storage without backend dependency
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image';
  text?: string;
  name?: string;
  input?: any;
  content?: string;
  is_error?: boolean;
}

interface TaskInfo {
  taskId: string;
  path: string;
  mtime: number;
}

interface ConversationSummary {
  taskId: string;
  timestamp: string;
  messageCount: number;
  toolUseCount: number;
  initialRequest: string;
  conversationText: string;
  problemScore: number;
  problemIndicators: ProblemIndicators;
}

interface ProblemIndicators {
  hasErrors: boolean;
  errorCount: number;
  hasRetries: boolean;
  retryCount: number;
  hasNegativeFeedback: boolean;
  negativeFeedbackCount: number;
  hasConfusion: boolean;
  confusionCount: number;
  isLongConversation: boolean;
  hasHighToolUsage: boolean;
  hasToolFailures: boolean;
  toolFailureCount: number;
}

/**
 * Get Bob storage paths based on OS
 */
function getStoragePaths(): string[] {
  const paths: string[] = [];
  
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (appdata) {
      paths.push(
        path.join(appdata, 'Bob-IDE', 'User', 'globalStorage', 'ibm.bob-code'),
        path.join(appdata, 'IBM Bob', 'User', 'globalStorage', 'ibm.bob-code')
      );
    }
  } else if (process.platform === 'darwin') {
    const home = os.homedir();
    const appSupport = path.join(home, 'Library', 'Application Support');
    paths.push(
      path.join(appSupport, 'Bob-IDE', 'User', 'globalStorage', 'ibm.bob-code'),
      path.join(appSupport, 'IBM Bob', 'User', 'globalStorage', 'ibm.bob-code')
    );
  }
  
  return paths;
}

/**
 * Get all available tasks from storage
 */
function getAllTasks(): TaskInfo[] {
  const tasks: TaskInfo[] = [];
  const storagePaths = getStoragePaths();
  
  for (const basePath of storagePaths) {
    const tasksRoot = path.join(basePath, 'tasks');
    
    if (!fs.existsSync(tasksRoot)) {
      continue;
    }
    
    const taskDirs = fs.readdirSync(tasksRoot);
    
    for (const taskId of taskDirs) {
      const taskDir = path.join(tasksRoot, taskId);
      const apiFile = path.join(taskDir, 'api_conversation_history.json');
      
      if (fs.existsSync(apiFile)) {
        const stats = fs.statSync(apiFile);
        tasks.push({
          taskId,
          path: apiFile,
          mtime: stats.mtimeMs
        });
      }
    }
  }
  
  return tasks;
}

/**
 * Extract text content from a message
 */
function extractTextContent(message: Message): string {
  const content = message.content;
  
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        texts.push(block.text);
      } else if (block.type === 'tool_use') {
        // Only include MCP tools in the text representation
        if (block.name && isMcpTool(block.name)) {
          texts.push(`[MCP Tool: ${block.name}]`);
        }
      } else if (block.type === 'tool_result') {
        const status = block.is_error ? 'Error' : 'Success';
        texts.push(`[Tool Result: ${status}]`);
      }
    }
    return texts.join(' ');
  }
  
  return '';
}

// Internal Bob tools that should be excluded from MCP tool analysis
const INTERNAL_BOB_TOOLS = new Set([
  'read_file',
  'write_to_file',
  'apply_diff',
  'insert_content',
  'execute_command',
  'browser_action',
  'list_files',
  'list_code_definition_names',
  'search_files',
  'ask_followup_question',
  'attempt_completion',
  'use_skill',
  'switch_mode',
  'new_task',
  'update_todo_list',
  'create_temporary_file',
  'fetch_instructions',
  'generate_description_from_diff',
  'create_pull_request',
  'obtain_git_diff',
  'submit_review_findings',
  'fetch_github_issue'
]);

/**
 * Check if a tool is an MCP tool (not an internal Bob tool)
 */
function isMcpTool(toolName: string): boolean {
  return !INTERNAL_BOB_TOOLS.has(toolName);
}

/**
 * Count tool uses in conversation (MCP tools only)
 */
function countToolUses(conversation: Message[]): number {
  let count = 0;
  
  for (const message of conversation) {
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use' && block.name && isMcpTool(block.name)) {
          count++;
        }
      }
    }
  }
  
  return count;
}

/**
 * Regex patterns for detecting conversation problems
 */
const PROBLEM_PATTERNS = {
  errors: /\b(error|failed|exception|cannot|unable to|could not|failure|fail|crash|broke|broken)\b/gi,
  retries: /\b(try again|retry|attempt|let me try|one more time|re-run|rerun|redo)\b/gi,
  negativeFeedback: /\b(doesn't work|not working|still not|issue|problem|bug|wrong|incorrect|bad|worse)\b/gi,
  confusion: /\b(confused|unclear|don't understand|what do you mean|not sure|uncertain|ambiguous)\b/gi,
};

/**
 * Analyze conversation text for problem indicators using regex
 */
function analyzeConversationProblems(conversation: Message[]): ProblemIndicators {
  // Combine all text content
  const fullText = conversation
    .map(msg => extractTextContent(msg))
    .join(' ')
    .toLowerCase();
  
  // Count tool failures
  let toolFailureCount = 0;
  for (const message of conversation) {
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_result' && block.is_error) {
          toolFailureCount++;
        }
      }
    }
  }
  
  // Detect patterns
  const errorMatches = fullText.match(PROBLEM_PATTERNS.errors) || [];
  const retryMatches = fullText.match(PROBLEM_PATTERNS.retries) || [];
  const negativeFeedbackMatches = fullText.match(PROBLEM_PATTERNS.negativeFeedback) || [];
  const confusionMatches = fullText.match(PROBLEM_PATTERNS.confusion) || [];
  
  const messageCount = conversation.length;
  const toolUseCount = countToolUses(conversation);
  
  return {
    hasErrors: errorMatches.length > 0,
    errorCount: errorMatches.length,
    hasRetries: retryMatches.length > 0,
    retryCount: retryMatches.length,
    hasNegativeFeedback: negativeFeedbackMatches.length > 0,
    negativeFeedbackCount: negativeFeedbackMatches.length,
    hasConfusion: confusionMatches.length > 0,
    confusionCount: confusionMatches.length,
    isLongConversation: messageCount > 20,
    hasHighToolUsage: toolUseCount > 15,
    hasToolFailures: toolFailureCount > 0,
    toolFailureCount: toolFailureCount,
  };
}

/**
 * Calculate problem score (0-100) based on indicators
 * Higher score = more problematic conversation
 */
function calculateProblemScore(indicators: ProblemIndicators): number {
  let score = 0;
  
  // Tool failures are strong indicators (30 points max)
  score += Math.min(indicators.toolFailureCount * 10, 30);
  
  // Error mentions (20 points max)
  score += Math.min(indicators.errorCount * 2, 20);
  
  // Retries indicate friction (15 points max)
  score += Math.min(indicators.retryCount * 3, 15);
  
  // Negative feedback (15 points max)
  score += Math.min(indicators.negativeFeedbackCount * 2, 15);
  
  // Confusion signals (10 points max)
  score += Math.min(indicators.confusionCount * 2, 10);
  
  // Long conversations may indicate complexity/issues (5 points)
  if (indicators.isLongConversation) {
    score += 5;
  }
  
  // High tool usage may indicate trial-and-error (5 points)
  if (indicators.hasHighToolUsage) {
    score += 5;
  }
  
  return Math.min(score, 100);
}

/**
 * Format conversation for LLM analysis
 */
function formatConversation(conversation: Message[], maxLength: number = 2000): string {
  const lines: string[] = [];
  
  // Truncate if too many messages
  let messages = conversation;
  if (messages.length > 15) {
    const half = 7;
    messages = [
      ...messages.slice(0, half),
      { role: 'system', content: `[... ${messages.length - 14} messages omitted ...]` },
      ...messages.slice(-half)
    ];
  }
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const role = msg.role.toUpperCase();
    const text = extractTextContent(msg);
    
    if (text) {
      lines.push(`[${i + 1}] ${role}: ${text.substring(0, 500)}`);
    }
  }
  
  let fullText = lines.join('\n\n');
  
  // Truncate if still too long
  if (fullText.length > maxLength) {
    fullText = fullText.substring(0, maxLength) + '\n\n[... truncated ...]';
  }
  
  return fullText;
}

/**
 * Create conversation summary with problem analysis
 */
function createConversationSummary(taskInfo: TaskInfo): ConversationSummary | null {
  try {
    const conversationData = fs.readFileSync(taskInfo.path, 'utf-8');
    const conversation: Message[] = JSON.parse(conversationData);
    
    // Get first user message
    const userMessages = conversation.filter(m => m.role === 'user');
    const initialRequest = userMessages.length > 0
      ? extractTextContent(userMessages[0]).substring(0, 200)
      : '';
    
    // Format conversation
    const conversationText = formatConversation(conversation);
    
    // Count tools
    const toolUseCount = countToolUses(conversation);
    
    // Analyze for problems
    const problemIndicators = analyzeConversationProblems(conversation);
    const problemScore = calculateProblemScore(problemIndicators);
    
    return {
      taskId: taskInfo.taskId,
      timestamp: new Date(taskInfo.mtime).toISOString(),
      messageCount: conversation.length,
      toolUseCount,
      initialRequest,
      conversationText,
      problemScore,
      problemIndicators
    };
  } catch (error) {
    console.error(`Error processing task ${taskInfo.taskId}:`, error);
    return null;
  }
}

/**
 * Create optimized analysis prompt for LLM (reduced criteria)
 */
function createAnalysisPrompt(
  summaries: ConversationSummary[],
  question?: string
): string {
  const questionText = question || 'What are the root causes and learning opportunities from these problematic conversations?';
  
  let prompt = `# Bob Conversation Analysis - Problematic Conversations

## Question
${questionText}

## Context
These ${summaries.length} conversations were pre-filtered as having issues (errors, retries, negative feedback).
Focus on understanding WHY problems occurred and HOW to prevent them.

## Conversations to Analyze
`;
  
  for (let i = 0; i < summaries.length; i++) {
    const conv = summaries[i];
    const indicators = conv.problemIndicators;
    
    prompt += `
### Conversation ${i + 1} (Problem Score: ${conv.problemScore}/100)
- **Task ID**: ${conv.taskId}
- **Date**: ${conv.timestamp}
- **Messages**: ${conv.messageCount} | **Tool Uses**: ${conv.toolUseCount}
- **Initial Request**: ${conv.initialRequest}

**Problem Indicators** (detected by regex):
- Errors: ${indicators.errorCount} | Tool Failures: ${indicators.toolFailureCount}
- Retries: ${indicators.retryCount} | Negative Feedback: ${indicators.negativeFeedbackCount}
- Confusion: ${indicators.confusionCount}

**Conversation**:
\`\`\`
${conv.conversationText}
\`\`\`

---
`;
  }
  
  prompt += `

## Analysis Instructions

Focus ONLY on insights that regex cannot provide. Analyze these conversations for:

### 1. Root Cause Analysis
For each conversation, identify:
- **Why** did the problems occur? (not just what happened)
- What was the underlying cause of errors/retries?
- Was it unclear requirements, technical issues, or workflow problems?

### 2. Context & Intent Understanding
- What was the user really trying to achieve?
- Was the initial request clear or ambiguous?
- Did the conversation drift from the original goal?

### 3. Solution Quality Assessment
- Was the final solution appropriate and complete?
- Were there better approaches that weren't explored?
- What was missed or could be improved?

### 4. Learning Opportunities
- What specific lessons can be learned from each conversation?
- What patterns indicate areas for improvement?
- What should be done differently next time?

## Output Format

Provide concise, actionable insights in JSON:

\`\`\`json
{
  "conversations": [
    {
      "task_id": "...",
      "root_cause": "Brief explanation of why problems occurred",
      "user_intent": "What user was trying to achieve",
      "solution_quality": "good|adequate|poor",
      "key_lesson": "Main takeaway from this conversation"
    }
  ],
  "aggregate_insights": {
    "common_root_causes": ["cause1", "cause2"],
    "recurring_patterns": ["pattern1", "pattern2"],
    "improvement_areas": ["area1", "area2"]
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "recommendation": "Specific actionable advice",
      "rationale": "Why this will help"
    }
  ]
}
\`\`\`
`;
  
  return prompt;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let limit = 10;
  let question: string | undefined;
  let timeRangeDays: number | undefined;
  let outputFile: string | undefined;
  let listOnly = false;
  let taskId: string | undefined;
  let formatJson = false;
  let minScore = 30; // Default minimum problem score
  let showScores = false;
  let analyzeAll = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--question' && args[i + 1]) {
      question = args[i + 1];
      i++;
    } else if (args[i] === '--days' && args[i + 1]) {
      timeRangeDays = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--list-only') {
      listOnly = true;
    } else if (args[i] === '--task-id' && args[i + 1]) {
      taskId = args[i + 1];
      i++;
    } else if (args[i] === '--format' && args[i + 1] === 'json') {
      formatJson = true;
      i++;
    } else if (args[i] === '--min-score' && args[i + 1]) {
      minScore = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--show-scores') {
      showScores = true;
    } else if (args[i] === '--all') {
      analyzeAll = true;
    } else if (args[i] === '--help') {
      console.log(`
Usage: ts-node analyze-conversations.ts [options]

Options:
  --limit <n>        Number of recent conversations to analyze (default: 10)
  --question <text>  Specific question to answer
  --days <n>         Only analyze conversations from last N days
  --output <file>    Save prompt to file instead of stdout
  --list-only        Only list task IDs without analysis
  --task-id <id>     Get specific conversation by task ID
  --format json      Output in JSON format (use with --task-id)
  --min-score <n>    Minimum problem score to analyze (default: 30, range: 0-100)
  --show-scores      Show problem scores for all conversations
  --all              Analyze all conversations (override score filtering)
  --help             Show this help message

Problem Score Filtering:
  By default, only conversations with problem score >= 30 are analyzed.
  This reduces costs by focusing on problematic conversations.
  Use --all to analyze all conversations regardless of score.
  Use --show-scores to see scores without full analysis.

Examples:
  ts-node analyze-conversations.ts --limit 5
  ts-node analyze-conversations.ts --question "What are my common errors?"
  ts-node analyze-conversations.ts --days 7 --output prompt.txt
  ts-node analyze-conversations.ts --limit 10 --show-scores
  ts-node analyze-conversations.ts --min-score 50 --limit 20
  ts-node analyze-conversations.ts --all --limit 5
  ts-node analyze-conversations.ts --task-id abc123 --format json
`);
      process.exit(0);
    }
  }
  
  // Get all tasks
  console.error('Fetching conversations from local storage...');
  let tasks = getAllTasks();
  
  if (tasks.length === 0) {
    console.error('Error: No conversations found in local storage');
    console.error('Storage paths checked:', getStoragePaths());
    process.exit(1);
  }
  
  // Filter by time range if specified
  if (timeRangeDays) {
    const cutoff = Date.now() - (timeRangeDays * 24 * 60 * 60 * 1000);
    tasks = tasks.filter(t => t.mtime >= cutoff);
  }
  
  // Sort by most recent and limit
  tasks.sort((a, b) => b.mtime - a.mtime);
  tasks = tasks.slice(0, limit);
  
  // Handle --task-id flag
  if (taskId) {
    const task = tasks.find(t => t.taskId === taskId);
    if (!task) {
      console.error(`Error: Task ID '${taskId}' not found`);
      process.exit(1);
    }
    
    if (formatJson) {
      // Output full conversation as JSON
      try {
        const conversationData = fs.readFileSync(task.path, 'utf-8');
        const conversation = JSON.parse(conversationData);
        console.log(JSON.stringify({
          task_id: task.taskId,
          timestamp: new Date(task.mtime).toISOString(),
          messages: conversation
        }, null, 2));
      } catch (error) {
        console.error(`Error reading conversation: ${error}`);
        process.exit(1);
      }
    } else {
      // Output formatted conversation
      const summary = createConversationSummary(task);
      if (summary) {
        console.log(`Task ID: ${summary.taskId}`);
        console.log(`Timestamp: ${summary.timestamp}`);
        console.log(`Messages: ${summary.messageCount}`);
        console.log(`Tool Uses: ${summary.toolUseCount}`);
        console.log(`\nInitial Request: ${summary.initialRequest}`);
        console.log(`\nConversation:\n${summary.conversationText}`);
      }
    }
    return;
  }
  
  // Handle --list-only flag
  if (listOnly) {
    console.log('Task IDs (most recent first):');
    for (const task of tasks) {
      const date = new Date(task.mtime).toISOString().split('T')[0];
      console.log(`${task.taskId} (${date})`);
    }
    return;
  }
  
  console.error(`Processing ${tasks.length} conversations...`);
  
  // Create summaries with problem analysis
  const allSummaries: ConversationSummary[] = [];
  for (const task of tasks) {
    const summary = createConversationSummary(task);
    if (summary) {
      allSummaries.push(summary);
    }
  }
  
  if (allSummaries.length === 0) {
    console.error('Error: Could not process any conversations');
    process.exit(1);
  }
  
  console.error(`Successfully processed ${allSummaries.length} conversations`);
  
  // Sort by problem score (highest first)
  allSummaries.sort((a, b) => b.problemScore - a.problemScore);
  
  // Handle --show-scores flag
  if (showScores) {
    console.log('\nConversation Problem Scores (0-100, higher = more problematic):\n');
    for (const summary of allSummaries) {
      const indicators = summary.problemIndicators;
      console.log(`Score: ${summary.problemScore.toString().padStart(3)} | Task: ${summary.taskId}`);
      console.log(`  Date: ${summary.timestamp.split('T')[0]} | Messages: ${summary.messageCount} | Tools: ${summary.toolUseCount}`);
      console.log(`  Indicators: Errors=${indicators.errorCount}, Retries=${indicators.retryCount}, ` +
                  `Failures=${indicators.toolFailureCount}, Negative=${indicators.negativeFeedbackCount}`);
      console.log(`  Initial: ${summary.initialRequest.substring(0, 80)}...`);
      console.log('');
    }
    console.log(`\nTotal conversations: ${allSummaries.length}`);
    console.log(`Conversations with score >= ${minScore}: ${allSummaries.filter(s => s.problemScore >= minScore).length}`);
    return;
  }
  
  // Filter by problem score (unless --all flag is used)
  let summariesToAnalyze: ConversationSummary[];
  if (analyzeAll) {
    summariesToAnalyze = allSummaries;
    console.error(`Analyzing all ${allSummaries.length} conversations (--all flag used)`);
  } else {
    summariesToAnalyze = allSummaries.filter(s => s.problemScore >= minScore);
    console.error(`Filtered to ${summariesToAnalyze.length} conversations with problem score >= ${minScore}`);
    console.error(`Skipped ${allSummaries.length - summariesToAnalyze.length} conversations with low problem scores`);
    
    if (summariesToAnalyze.length === 0) {
      console.error('\nNo problematic conversations found!');
      console.error(`All ${allSummaries.length} conversations have problem scores below ${minScore}.`);
      console.error('This is good news - your conversations are going smoothly!');
      console.error('\nOptions:');
      console.error(`  - Use --min-score <n> to lower the threshold (current: ${minScore})`);
      console.error('  - Use --all to analyze all conversations regardless of score');
      console.error('  - Use --show-scores to see all conversation scores');
      process.exit(0);
    }
  }
  
  // Show summary of filtered conversations
  console.error('\nConversations selected for LLM analysis:');
  for (const summary of summariesToAnalyze) {
    console.error(`  - ${summary.taskId} (score: ${summary.problemScore}): ${summary.initialRequest.substring(0, 60)}...`);
  }
  console.error('');
  
  // Create analysis prompt
  const prompt = createAnalysisPrompt(summariesToAnalyze, question);
  
  // Output
  if (outputFile) {
    fs.writeFileSync(outputFile, prompt, 'utf-8');
    console.error(`Analysis prompt saved to: ${outputFile}`);
    console.error('Send this prompt to your LLM for analysis');
  } else {
    console.log(prompt);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { getAllTasks, createConversationSummary, createAnalysisPrompt };

// Made with Bob
