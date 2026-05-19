#!/usr/bin/env node
/**
 * Bob Insights MCP Server
 * Provides conversation analysis tools for Bob AI assistant history
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Type Definitions
// ============================================================================

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

// ============================================================================
// Storage Path Detection
// ============================================================================

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

// ============================================================================
// Task Retrieval
// ============================================================================

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

// ============================================================================
// Content Extraction
// ============================================================================

const INTERNAL_BOB_TOOLS = new Set([
  'read_file', 'write_to_file', 'apply_diff', 'insert_content',
  'execute_command', 'browser_action', 'list_files', 'list_code_definition_names',
  'search_files', 'ask_followup_question', 'attempt_completion', 'use_skill',
  'switch_mode', 'new_task', 'update_todo_list', 'create_temporary_file',
  'fetch_instructions', 'generate_description_from_diff', 'create_pull_request',
  'obtain_git_diff', 'submit_review_findings', 'fetch_github_issue'
]);

function isMcpTool(toolName: string): boolean {
  return !INTERNAL_BOB_TOOLS.has(toolName);
}

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
      } else if (block.type === 'tool_use' && block.name && isMcpTool(block.name)) {
        texts.push(`[MCP Tool: ${block.name}]`);
      } else if (block.type === 'tool_result') {
        const status = block.is_error ? 'Error' : 'Success';
        texts.push(`[Tool Result: ${status}]`);
      }
    }
    return texts.join(' ');
  }
  
  return '';
}

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

// ============================================================================
// Problem Analysis
// ============================================================================

const PROBLEM_PATTERNS = {
  errors: /\b(error|failed|exception|cannot|unable to|could not|failure|fail|crash|broke|broken)\b/gi,
  retries: /\b(try again|retry|attempt|let me try|one more time|re-run|rerun|redo)\b/gi,
  negativeFeedback: /\b(doesn't work|not working|still not|issue|problem|bug|wrong|incorrect|bad|worse)\b/gi,
  confusion: /\b(confused|unclear|don't understand|what do you mean|not sure|uncertain|ambiguous)\b/gi,
};

function analyzeConversationProblems(conversation: Message[]): ProblemIndicators {
  const fullText = conversation
    .map(msg => extractTextContent(msg))
    .join(' ')
    .toLowerCase();
  
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

function calculateProblemScore(indicators: ProblemIndicators): number {
  let score = 0;
  
  score += Math.min(indicators.toolFailureCount * 10, 30);
  score += Math.min(indicators.errorCount * 2, 20);
  score += Math.min(indicators.retryCount * 3, 15);
  score += Math.min(indicators.negativeFeedbackCount * 2, 15);
  score += Math.min(indicators.confusionCount * 2, 10);
  
  if (indicators.isLongConversation) {
    score += 5;
  }
  
  if (indicators.hasHighToolUsage) {
    score += 5;
  }
  
  return Math.min(score, 100);
}

// ============================================================================
// Conversation Formatting
// ============================================================================

function formatConversation(conversation: Message[], maxLength: number = 2000): string {
  const lines: string[] = [];
  
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
  
  if (fullText.length > maxLength) {
    fullText = fullText.substring(0, maxLength) + '\n\n[... truncated ...]';
  }
  
  return fullText;
}

function createConversationSummary(taskInfo: TaskInfo): ConversationSummary | null {
  try {
    const conversationData = fs.readFileSync(taskInfo.path, 'utf-8');
    const conversation: Message[] = JSON.parse(conversationData);
    
    const userMessages = conversation.filter(m => m.role === 'user');
    const initialRequest = userMessages.length > 0
      ? extractTextContent(userMessages[0]).substring(0, 200)
      : '';
    
    const conversationText = formatConversation(conversation);
    const toolUseCount = countToolUses(conversation);
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

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new McpServer({
  name: "bob-insights",
  version: "1.0.0"
});

// Tool: List Recent Conversations
server.tool(
  "list_conversations",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of recent conversations to list (default: 10)"),
    days: z.number().min(1).optional().describe("Only list conversations from last N days"),
    minScore: z.number().min(0).max(100).optional().describe("Minimum problem score to include (default: 0)")
  },
  async ({ limit = 10, days, minScore = 0 }) => {
    try {
      let tasks = getAllTasks();
      
      if (tasks.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No conversations found in local storage"
          }]
        };
      }
      
      if (days) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        tasks = tasks.filter(t => t.mtime >= cutoff);
      }
      
      tasks.sort((a, b) => b.mtime - a.mtime);
      tasks = tasks.slice(0, limit);
      
      const summaries: ConversationSummary[] = [];
      for (const task of tasks) {
        const summary = createConversationSummary(task);
        if (summary && summary.problemScore >= minScore) {
          summaries.push(summary);
        }
      }
      
      summaries.sort((a, b) => b.problemScore - a.problemScore);
      
      const result = summaries.map(s => ({
        task_id: s.taskId,
        timestamp: s.timestamp,
        problem_score: s.problemScore,
        messages: s.messageCount,
        tools: s.toolUseCount,
        initial_request: s.initialRequest,
        indicators: {
          errors: s.problemIndicators.errorCount,
          retries: s.problemIndicators.retryCount,
          tool_failures: s.problemIndicators.toolFailureCount,
          negative_feedback: s.problemIndicators.negativeFeedbackCount
        }
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total_found: tasks.length,
            filtered_count: summaries.length,
            conversations: result
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing conversations: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Get Conversation Details
server.tool(
  "get_conversation",
  {
    taskId: z.string().describe("Task ID of the conversation to retrieve")
  },
  async ({ taskId }) => {
    try {
      const tasks = getAllTasks();
      const task = tasks.find(t => t.taskId === taskId);
      
      if (!task) {
        return {
          content: [{
            type: "text",
            text: `Conversation with task ID '${taskId}' not found`
          }],
          isError: true
        };
      }
      
      const summary = createConversationSummary(task);
      if (!summary) {
        return {
          content: [{
            type: "text",
            text: `Error processing conversation '${taskId}'`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            task_id: summary.taskId,
            timestamp: summary.timestamp,
            problem_score: summary.problemScore,
            message_count: summary.messageCount,
            tool_use_count: summary.toolUseCount,
            initial_request: summary.initialRequest,
            problem_indicators: summary.problemIndicators,
            conversation: summary.conversationText
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error retrieving conversation: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Analyze Problematic Conversations
server.tool(
  "analyze_problems",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of recent conversations to check (default: 20)"),
    days: z.number().min(1).optional().describe("Only analyze conversations from last N days"),
    minScore: z.number().min(0).max(100).optional().describe("Minimum problem score to analyze (default: 30)"),
    question: z.string().optional().describe("Custom question for analysis")
  },
  async ({ limit = 20, days, minScore = 30, question }) => {
    try {
      let tasks = getAllTasks();
      
      if (tasks.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No conversations found in local storage"
          }]
        };
      }
      
      if (days) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        tasks = tasks.filter(t => t.mtime >= cutoff);
      }
      
      tasks.sort((a, b) => b.mtime - a.mtime);
      tasks = tasks.slice(0, limit);
      
      const allSummaries: ConversationSummary[] = [];
      for (const task of tasks) {
        const summary = createConversationSummary(task);
        if (summary) {
          allSummaries.push(summary);
        }
      }
      
      const problematicSummaries = allSummaries.filter(s => s.problemScore >= minScore);
      problematicSummaries.sort((a, b) => b.problemScore - a.problemScore);
      
      if (problematicSummaries.length === 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "No problematic conversations found",
              total_checked: allSummaries.length,
              threshold: minScore,
              suggestion: "Lower the minScore threshold or use --all flag"
            }, null, 2)
          }]
        };
      }
      
      const questionText = question || 'What are the root causes and learning opportunities from these problematic conversations?';
      
      let prompt = `# Bob Conversation Analysis - Problematic Conversations

## Question
${questionText}

## Context
These ${problematicSummaries.length} conversations were pre-filtered as having issues (errors, retries, negative feedback).
Focus on understanding WHY problems occurred and HOW to prevent them.

## Conversations to Analyze
`;
      
      for (let i = 0; i < problematicSummaries.length; i++) {
        const conv = problematicSummaries[i];
        const indicators = conv.problemIndicators;
        
        prompt += `
### Conversation ${i + 1} (Problem Score: ${conv.problemScore}/100)
- **Task ID**: ${conv.taskId}
- **Date**: ${conv.timestamp}
- **Messages**: ${conv.messageCount} | **Tool Uses**: ${conv.toolUseCount}
- **Initial Request**: ${conv.initialRequest}

**Problem Indicators**:
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
- **Why** did the problems occur?
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
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            summary: {
              total_checked: allSummaries.length,
              problematic_count: problematicSummaries.length,
              threshold: minScore
            },
            analysis_prompt: prompt
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error analyzing conversations: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// Server Startup
// ============================================================================

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Bob Insights MCP server running on stdio');

// Made with Bob
