# AI Tools Development Guide

> **Purpose**: Guidelines for developing AI tools in MoLOS modules to prevent validation errors and ensure robust error handling.

---

## Overview

AI tools are functions that the AI assistant can call to interact with your module. When developing AI tools, it's critical to:

1. **Validate all enum parameters** before passing to database
2. **Handle errors gracefully** to prevent app crashes
3. **Provide clear error messages** for AI recovery
4. **Document valid values** in tool descriptions

---

## Common Issues

### Issue 1: Invalid Enum Values

**Problem**: AI generates values that don't match database enum constraints.

**Example Error**:
```
Error: Invalid value for column category. Expected: rent, groceries, entertainment, savings, other | Found: Software
```

**Root Cause**: The AI tool doesn't validate parameters before passing to the database, and the `textEnum` utility throws an error on invalid values.

---

## Solution Patterns

### Pattern 1: Parameter Validation

Always validate enum parameters at the tool level, before database operations:

```typescript
// Import enum values from schema
import { FinanceCategory } from '../db/schema/tables';

// Create array of valid values
const VALID_CATEGORIES: string[] = Object.values(FinanceCategory);

// Validation function
function validateCategory(category: string): string {
  if (VALID_CATEGORIES.includes(category)) {
    return category;
  }
  console.warn(`[Module] Invalid category "${category}", mapping to "other"`);
  return 'other'; // Fallback to default
}

// Use in tool
{
  name: 'bulk_add_expenses',
  description: 'Add multiple expense records at once. Valid categories: rent, groceries, entertainment, savings, other. Invalid categories will be mapped to "other".',
  parameters: {
    type: 'object',
    properties: {
      expenses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { 
              type: 'string',
              enum: ['rent', 'groceries', 'entertainment', 'savings', 'other'],
              description: 'Expense category. Invalid values will be mapped to "other".'
            },
            // ... other properties
          },
          required: ['amount', 'description', 'category']
        }
      }
    },
    required: ['expenses']
  },
  execute: async (params: Record<string, unknown>) => {
    const results: any[] = [];
    const skipped: Array<{ expense: any; error: string }> = [];

    for (const exp of (params.expenses as any[])) {
      try {
        // Validate before database operation
        const normalizedCategory = validateCategory(exp.category);

        const result = await expenseRepo.create({
          userId,
          ...exp,
          category: normalizedCategory, // Use validated value
          currency: exp.currency || 'USD',
          date: exp.date || Math.floor(Date.now() / 1000)
        });
        results.push(result);
      } catch (error) {
        skipped.push({
          expense: exp,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      created: results.length,
      skipped: skipped.length,
      skippedDetails: skipped
    };
  }
}
```

### Pattern 2: Error Handling in Tools

Wrap individual operations in try-catch blocks:

```typescript
execute: async (params: Record<string, unknown>) => {
  const results: any[] = [];
  const errors: Array<{ item: any; error: string }> = [];

  for (const item of params.items) {
    try {
      const result = await repository.create({ userId, ...item });
      results.push(result);
    } catch (error) {
      // Log and continue instead of throwing
      console.error(`[Tool] Failed to process item:`, error);
      errors.push({
        item,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    success: results.length > 0,
    created: results.length,
    failed: errors.length,
    errors
  };
}
```

### Pattern 3: Case-Insensitive Matching

For text-based enums, consider case-insensitive matching:

```typescript
function normalizeValue<T extends string>(value: T, validValues: T[], defaultValue: T): T {
  const normalized = value.toLowerCase().trim();
  const validLower = validValues.map(v => v.toLowerCase());
  
  const index = validLower.indexOf(normalized);
  if (index !== -1) {
    return validValues[index];
  }
  
  console.warn(`[Module] Invalid value "${value}", using default "${defaultValue}"`);
  return defaultValue;
}
```

---

## Tool Description Best Practices

### 1. Include Valid Enum Values

Always document valid enum values in the tool description:

```typescript
{
  name: 'bulk_log_activities',
  description: 'Log multiple physical activities at once. Valid activity types: Running, Lifting, Cycling, Swimming, Walking, Other. Invalid types will be mapped to "Other".',
  parameters: {
    properties: {
      activityType: {
        type: 'string',
        enum: ['Running', 'Lifting', 'Cycling', 'Swimming', 'Walking', 'Other'],
        description: 'Type of physical activity. Case-sensitive.'
      }
    }
  }
}
```

### 2. Explain Fallback Behavior

Document what happens with invalid values:

```typescript
description: 'Add expenses. Valid categories: rent, groceries, entertainment, savings, other. Invalid categories will be mapped to "other" with a warning logged.'
```

### 3. Be Specific About Constraints

Mention case-sensitivity and other constraints:

```typescript
category: {
  type: 'string',
  enum: ['Running', 'Lifting', 'Cycling', 'Swimming', 'Walking', 'Other'],
  description: 'Activity type (case-sensitive, must match exactly one of the enum values)'
}
```

---

## Module-Specific Examples

### Finance Module

**Valid Categories**: `rent`, `groceries`, `entertainment`, `savings`, `other`

```typescript
import { FinanceCategory } from '../db/schema/tables';

const VALID_CATEGORIES = Object.values(FinanceCategory);

function validateCategory(category: string): string {
  if (VALID_CATEGORIES.includes(category)) {
    return category;
  }
  console.warn(`[Finance] Invalid category "${category}", mapping to "other"`);
  return 'other';
}
```

### Health Module

**Valid Activity Types**: `Running`, `Lifting`, `Cycling`, `Swimming`, `Walking`, `Other`

```typescript
import { HealthActivityType } from '../../../models';

const VALID_ACTIVITY_TYPES: string[] = Object.values(HealthActivityType);

function validateActivityType(activityType: string): string {
  if (VALID_ACTIVITY_TYPES.includes(activityType)) {
    return activityType;
  }
  console.warn(`[Health] Invalid activity type "${activityType}", mapping to "Other"`);
  return 'Other';
}
```

### Goals Module

**Valid Goal Types**: Add similar validation for goal-related enums

### Meals Module

**Valid Meal Types**: Add similar validation for meal-related enums

---

## Error Handling Layers

The MoLOS system has multiple layers of error handling. Each layer should handle errors appropriately:

### Layer 1: Tool-Level (Primary)

- **Where**: In the tool's `execute` function
- **What**: Validate parameters and catch individual operation errors
- **Goal**: Prevent invalid data from reaching the database
- **Return**: Structured result with success/failure details

```typescript
return {
  created: results.length,
  skipped: errors.length,
  skippedDetails: errors  // Detailed info for AI to understand what failed
};
```

### Layer 2: Tool Wrapper (Secondary)

- **Where**: In `src/lib/server/ai/agent/v3/tools/tool-wrapper.ts`
- **What**: Catches and categorizes tool execution errors
- **Goal**: Prevent errors from propagating to agent
- **Return**: Error result with categorization

The tool wrapper automatically:
- Catches all errors during tool execution
- Categorizes errors (validation, database, network, etc.)
- Returns structured error results
- Logs errors for debugging

### Layer 3: Agent Adapter (Tertiary)

- **Where**: In `src/lib/server/ai/agent-v3-adapter.ts`
- **What**: Catches action execution errors
- **Goal**: Prevent errors from crashing the agent
- **Return**: Error result instead of throwing

```typescript
async executeAction(action: AiAction, activeModuleIds: string[] = []): Promise<unknown> {
  try {
    // ... action execution
  } catch (error) {
    console.error('[AiAgentV3Adapter] Action execution failed:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      success: false,
      toolName: action.entity
    };
  }
}
```

### Layer 4: API Endpoint (Final)

- **Where**: In `src/routes/api/ai/chat/+server.ts`
- **What**: Catches streaming and non-streaming errors
- **Goal**: Send error events to client instead of crashing
- **Return**: Structured error response

```typescript
} catch (error) {
  const errorMessage = (error as any)?.message || 'Internal Server Error';
  const errorType = (error as any)?.constructor?.name || 'Error';
  
  return json({ 
    error: errorMessage,
    errorType,
    success: false,
    timestamp: Date.now()
  }, { status: 500 });
}
```

---

## Testing Checklist

When developing AI tools, test the following scenarios:

- [ ] Valid enum values pass through correctly
- [ ] Invalid enum values are mapped to default
- [ ] Missing required fields are handled gracefully
- [ ] Database errors don't crash the app
- [ ] Tool returns structured results (success/failure counts)
- [ ] AI can understand what went wrong from error details
- [ ] Warnings are logged for debugging

---

## Common Enum Values Reference

### Finance Module Categories
- `rent`
- `groceries`
- `entertainment`
- `savings`
- `other` (fallback)

### Health Module Activity Types
- `Running`
- `Lifting`
- `Cycling`
- `Swimming`
- `Walking`
- `Other` (fallback)

### Health Module Sex Values
- `Male`
- `Female`
- `Other`

### Health Module Units
- `metric`
- `imperial`

---

## Related Documentation

- [Module Development Guide](./development.md) - Overall module development
- [Module Standards](./standards.md) - Code standards and conventions
- [AI Context](../AI-CONTEXT.md) - AI assistant reference
- [Database Schema](../../packages/database.md) - Database utilities

---

*Last Updated: 2026-02-17*
