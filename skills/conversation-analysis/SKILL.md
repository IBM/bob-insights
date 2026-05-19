---
name: conversation-analysis
description: Cost-optimized conversation analysis using regex pre-filtering and focused LLM analysis for problematic conversations
argument-hint: question about your conversations or "analyze recent"
allowed-tools:
  - Bash(git-ai:*)
  - Read
  - Glob
  - Task
---

# Conversation Analysis Skill (Cost-Optimized)

This skill analyzes your Bob AI assistant conversation history with a **cost-optimized approach**:
1. **Regex pre-filtering** identifies problematic conversations (errors, retries, negative feedback)
2. **Problem scoring** ranks conversations by severity (0-100)
3. **Selective LLM analysis** only analyzes high-score conversations
4. **Focused criteria** - LLM analyzes only insights regex cannot provide

## Cost Optimization Strategy

### Phase 1: Regex-Based Pre-Filtering
The script automatically detects:
- **Errors**: "error", "failed", "exception", "cannot", "unable to"
- **Retries**: "try again", "retry", "attempt", "let me try"
- **Negative feedback**: "doesn't work", "not working", "issue", "problem"
- **Confusion**: "confused", "unclear", "don't understand"
- **Tool failures**: Actual tool_result errors in conversation
- **Long conversations**: Message count > 20 (indicates complexity)
- **High tool usage**: Tool count > 15 (indicates trial-and-error)

### Phase 2: Problem Scoring (0-100)
Each conversation gets a score based on:
- Tool failures: 10 points each (max 30)
- Error mentions: 2 points each (max 20)
- Retries: 3 points each (max 15)
- Negative feedback: 2 points each (max 15)
- Confusion signals: 2 points each (max 10)
- Long conversation: 5 points
- High tool usage: 5 points

**Default threshold: 30** - Only conversations scoring ≥30 are sent to LLM.

### Phase 3: Focused LLM Analysis
LLM analyzes ONLY what regex cannot determine:
- **Root cause analysis** (why did problems occur?)
- **Context & intent** (what was user trying to achieve?)
- **Solution quality** (was the solution good?)
- **Learning opportunities** (what can be improved?)

**Removed criteria** (regex handles these):
- ❌ Work type classification
- ❌ Tool usage counts
- ❌ Message counts
- ❌ Simple pattern matching

### Expected Cost Reduction
- **70-80% fewer conversations** analyzed by LLM
- **40-50% smaller prompts** (fewer criteria)
- **Total cost reduction: 80-90%**

## Usage

### Step 1: Check Problem Scores (Optional)

First, see which conversations have problems:

```bash
ts-node skills/conversation-analysis/analyze-conversations.ts --limit 20 --show-scores
```

This shows problem scores for all conversations without LLM analysis.

### Step 2: Analyze Problematic Conversations

Run analysis with automatic filtering:

```bash
# Default: analyzes conversations with score >= 30
ts-node skills/conversation-analysis/analyze-conversations.ts --limit 20

# Custom threshold
ts-node skills/conversation-analysis/analyze-conversations.ts --limit 20 --min-score 50

# Analyze all (override filtering)
ts-node skills/conversation-analysis/analyze-conversations.ts --limit 10 --all
```

### Step 3: Review LLM Analysis

The script outputs a focused prompt for LLM analysis. Send it to your LLM to get:
- Root cause analysis for each problematic conversation
- Common patterns across issues
- Actionable recommendations

## Command Reference

| Command | Purpose |
|---------|---------|
| `--show-scores` | Display problem scores without LLM analysis |
| `--min-score <n>` | Set minimum score threshold (default: 30) |
| `--all` | Analyze all conversations (override filtering) |
| `--limit <n>` | Number of recent conversations to check (default: 10) |
| `--days <n>` | Only check conversations from last N days |
| `--question <text>` | Custom question for LLM analysis |

## Scope Determination

| User mentions | Command to use |
|---------------|----------------|
| "recent" or nothing specified | `--limit 10` |
| "last week" | `--days 7` |
| "last month" | `--days 30` |
| "all my conversations" | `--limit 50` or higher |
| Specific issue | `--question "Why do I get X error?"` |

## Examples

### Example 1: Analyze Recent Problems

**User asks**: "What issues have I been having recently?"

```bash
# Step 1: Check scores
ts-node skills/conversation-analysis/analyze-conversations.ts --limit 20 --show-scores

# Step 2: Analyze problematic ones
ts-node skills/conversation-analysis/analyze-conversations.ts --limit 20
```

The script will:
1. Score all 20 conversations using regex
2. Filter to only those with score >= 30
3. Generate focused LLM prompt for problematic conversations
4. You send prompt to LLM for root cause analysis

### Example 2: Deep Dive on Specific Period

**User asks**: "Why did I have so many errors last week?"

```bash
ts-node skills/conversation-analysis/analyze-conversations.ts --days 7 --min-score 40
```

This analyzes only conversations from last 7 days with score >= 40.

### Example 3: Check If Things Are Improving

**User asks**: "Are my conversations getting better?"

```bash
# Recent conversations
ts-node skills/conversation-analysis/analyze-conversations.ts --days 7 --show-scores

# Older conversations
ts-node skills/conversation-analysis/analyze-conversations.ts --days 30 --show-scores
```

Compare average scores between periods.

## Best Practices

1. **Start with --show-scores**: See what's problematic before LLM analysis
2. **Adjust threshold**: Use `--min-score` to focus on severe issues or catch more problems
3. **Use time ranges**: `--days` helps identify trends over time
4. **Override when needed**: Use `--all` for comprehensive analysis of successful patterns
5. **Ask specific questions**: Use `--question` to guide LLM analysis

## Output Format

The LLM will receive a focused prompt and should return:

```json
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
```

Present this to the user in a readable format:

```markdown
# Conversation Analysis Results

## Summary
- Total conversations checked: N
- Problematic conversations (score >= 30): M
- Conversations analyzed by LLM: M

## Problem Score Distribution
- High severity (70-100): X conversations
- Medium severity (40-69): Y conversations
- Low severity (30-39): Z conversations

## Root Causes Identified
1. **Cause 1** (occurred in N conversations)
   - Description
   - Example task IDs

2. **Cause 2** (occurred in M conversations)
   - Description
   - Example task IDs

## Key Recommendations
1. **[Priority]** Recommendation
   - Rationale
   - Expected impact

## Trends
- Average problem score: X
- Most common issue: Y
- Improvement areas: Z
```

## Cost Savings Summary

| Metric | Before Optimization | After Optimization | Savings |
|--------|-------------------|-------------------|---------|
| Conversations sent to LLM | 10 | 2-3 | 70-80% |
| Prompt size (tokens) | ~2000/conv | ~1200/conv | 40% |
| Analysis criteria | 8 | 4 | 50% |
| **Total cost reduction** | - | - | **80-90%** |

## Notes

- Regex pre-filtering is fast and free
- Only problematic conversations incur LLM costs
- Problem scores help prioritize which conversations need attention
- Use `--show-scores` to monitor conversation quality over time
- Adjust `--min-score` threshold based on your needs