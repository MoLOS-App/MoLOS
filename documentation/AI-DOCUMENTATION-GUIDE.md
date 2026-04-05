# AI Documentation Guide

> Guide for AI assistants on how to read, write, and update MoLOS documentation.

## Purpose

This guide helps AI assistants understand the MoLOS documentation structure, conventions, and best practices for creating and maintaining documentation.

## Documentation Structure

```
documentation/
├── README.md                      # Main documentation index (START HERE)
├── AI-CONTEXT.md                 # Comprehensive AI reference (672 lines)
├── QUICK-REFERENCE.md            # Quick command/pattern reference (171 lines)
├── .context.md                   # Documentation hub context
├── .template.md                  # Documentation template
├── adr/                          # Architecture Decision Records
├── architecture/                 # System architecture docs
├── deployment/                   # Deployment and production guides
│   ├── docker.md                # Docker/Podman deployment
│   ├── production-build.md       # Production build system
│   └── production-quick-ref.md  # Production quick reference
├── getting-started/             # Onboarding and setup guides
├── modules/                     # Module system documentation
├── packages/                   # Package-level documentation
├── mcp/                        # Model Context Protocol docs
└── archive/                    # Archived/historical documentation
```

## Reading Documentation

### For Getting Started

1. **Start with**: `documentation/README.md` - Main index with quick links
2. **For developers**: `documentation/getting-started/development.md`
3. **Quick reference**: `documentation/QUICK-REFERENCE.md`
4. **AI reference**: `documentation/AI-CONTEXT.md`

### For Specific Topics

| Topic                   | Start Here                                           |
| ----------------------- | ---------------------------------------------------- |
| Architecture            | `architecture/overview.md`                           |
| Module development      | `modules/development.md`                             |
| Module standards        | `modules/standards.md`                               |
| Database                | `architecture/database.md` or `packages/database.md` |
| Deployment (Docker)     | `deployment/docker.md`                               |
| Deployment (Production) | `deployment/production-build.md`                     |
| AI tools development    | `modules/ai-tools-development.md`                    |
| Troubleshooting         | `getting-started/troubleshooting.md`                 |

### For AI Context

When working on MoLOS code:

1. **Load**: `documentation/AI-CONTEXT.md` for comprehensive reference
2. **Quick lookups**: `documentation/QUICK-REFERENCE.md` for commands and patterns
3. **Deep dive**: Read specific topic documentation from relevant subdirectory

## Writing Documentation

### File Naming Conventions

- Use kebab-case: `module-development.md`, `quick-reference.md`
- Use clear, descriptive names
- Avoid abbreviations unless widely understood

### Title and Description

```markdown
# Title

> Brief description (1-2 sentences explaining what this covers)
```

**Guidelines:**

- Title should be concise and descriptive
- Description helps readers quickly understand content scope
- Start description with capital letter, end without period

### Heading Structure

```markdown
# H1 - Document title (one per document)

## H2 - Major sections

### H3 - Subsections

#### H4 - Minor subsections (rare)
```

**Guidelines:**

- One H1 per document (the title)
- H2 for major sections (3-7 per document)
- H3 for subsections within H2
- Avoid H4 and deeper unless necessary

### Code Blocks

````markdown
```typescript
// Always specify language for syntax highlighting
const example: string = 'value';
```
````

````

**Supported languages:**
- `typescript` - TypeScript code
- `bash` - Shell commands
- `sql` - Database queries
- `markdown` - Markdown examples
- `json` - JSON data
- `yaml` - YAML configuration

**Guidelines:**
- Always specify language for syntax highlighting
- Use descriptive variable names in examples
- Add brief explanations for complex code
- Include error handling in production code examples

### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
| --------- | --------- | -------- |
| Data      | Data      | Data     |
````

**Guidelines:**

- Use tables for comparison or structured data
- Keep tables readable (max 5-6 columns)
- Include table headers
- Use consistent capitalization

### Lists

**Unordered lists (bullets):**

```markdown
- Item 1
- Item 2
  - Nested item
  - Another nested item
- Item 3
```

**Ordered lists (numbers):**

```markdown
1. Step 1
2. Step 2
   2.1 Sub-step 2.1
   2.2 Sub-step 2.2
3. Step 3
```

**Guidelines:**

- Use unordered lists for items without sequence
- Use ordered lists for sequential steps
- Nest up to 2 levels deep (avoid deeper nesting)
- Start each item with capital letter

### Links

```markdown
[Link text](./relative-path.md)
[External link](https://example.com)
```

**Guidelines:**

- Use relative links for internal documentation
- Use descriptive link text (not "click here")
- Prefer relative paths starting with `./` or `../`
- Test all links before committing

### Notes and Warnings

```markdown
> **Note:** Important information that readers should be aware of.

> **Warning:** Actions that could cause data loss or break changes.

> **Tip:** Helpful suggestions or best practices.
```

**Guidelines:**

- Use **Note** for important but non-blocking information
- Use **Warning** for actions that require caution
- Use **Tip** for helpful suggestions
- Keep notes concise (1-2 sentences)

### Footer

```markdown
---

_Last Updated: YYYY-MM-DD_
```

**Guidelines:**

- Always include update date
- Use ISO format: YYYY-MM-DD
- Separate with `---` horizontal rule
- Update date when making significant changes

## Updating Documentation

### When to Update

Update documentation when:

1. **Adding new features** - Document new functionality
2. **Changing APIs** - Update API references and examples
3. **Fixing bugs** - Update troubleshooting if bug was common
4. **Deprecating features** - Mark as deprecated with alternatives
5. **Reorganizing code** - Update file paths and structure references
6. **Best practices change** - Update guidelines and examples

### Update Process

1. **Read existing doc** - Understand current content
2. **Identify changes** - Determine what needs updating
3. **Make edits** - Follow formatting conventions
4. **Check links** - Verify all internal links work
5. **Update footer** - Change `_Last Updated` date
6. **Test examples** - Run code examples to verify they work
7. **Review** - Check for clarity, accuracy, completeness

### Update Significance

| Change Type                    | Update Footer |
| ------------------------------ | ------------- |
| Minor typo fix                 | No            |
| Small clarification            | No            |
| Code example fix               | Yes           |
| Adding new section             | Yes           |
| Major restructure              | Yes           |
| Updating deprecated references | Yes           |

## Cross-Referencing

### When to Cross-Reference

- Related topics in other documents
- Detailed information elsewhere
- Prerequisites or prerequisites
- Alternative approaches

### Cross-Reference Format

```markdown
## See Also

- [Related Document](./related.md) - Brief description
- [Another Document](./another.md) - Another description
```

**Guidelines:**

- Place "See Also" near end of document
- Keep descriptions concise
- Link to most relevant documentation first
- Limit to 3-5 related documents

## Documentation Quality Checklist

Before submitting documentation, verify:

### Content Quality

- [ ] Content is accurate and up-to-date
- [ ] Code examples are tested and work
- [ ] Links point to valid locations
- [ ] Tables and lists are properly formatted

### Structure

- [ ] Document has clear title and description
- [ ] Headings follow proper hierarchy (H1 → H2 → H3)
- [ ] Sections are logically organized
- [ ] Content flows in logical order

### Formatting

- [ ] Code blocks have language specified
- [ ] Tables use consistent formatting
- [ ] Lists use proper nesting
- [ ] Footer has `_Last Updated: YYYY-MM-DD_`

### Clarity

- [ ] Explanations are clear and concise
- [ ] Technical terms are explained or linked
- [ ] Examples include context
- [ ] No ambiguous statements

## Common Mistakes to Avoid

### 1. Not Updating Links

**Bad:** Moving files but not updating references
**Fix:** Search for old paths and update all references

### 2. Outdated Examples

**Bad:** Code examples that don't work with current codebase
**Fix:** Test all examples before documenting

### 3. Missing Context

**Bad:** "Run `bun run dev`" without explanation
**Fix:** "Run `bun run dev` to start the development server, which auto-discovers and syncs modules"

### 4. Inconsistent Terminology

**Bad:** Using "module", "plugin", "extension" interchangeably
**Fix:** Use consistent terminology (MoLOS uses "module")

### 5. Too Technical (or not technical enough)

**Bad:** Assuming reader knows everything or knows nothing
**Fix:** Know your audience (developers vs users) and write accordingly

## File Organization

### Where to Put New Documentation

| Type of Content          | Location                                   |
| ------------------------ | ------------------------------------------ |
| Main index/overview      | `documentation/README.md`                  |
| Comprehensive reference  | `documentation/AI-CONTEXT.md`              |
| Quick reference          | `documentation/QUICK-REFERENCE.md`         |
| Architecture topics      | `documentation/architecture/{topic}.md`    |
| Getting started guides   | `documentation/getting-started/{topic}.md` |
| Module system docs       | `documentation/modules/{topic}.md`         |
| Package docs             | `documentation/packages/{package}.md`      |
| Deployment guides        | `documentation/deployment/{topic}.md`      |
| Architecture decisions   | `documentation/adr/{number}-{topic}.md`    |
| MCP documentation        | `documentation/mcp/{topic}.md`             |
| Historical/archived docs | `documentation/archive/{category}/`        |

### Creating New Directories

Before creating a new directory:

1. **Check if existing** - Look for similar content in existing directories
2. **Consider relevance** - Is this core MoLOS functionality or peripheral?
3. **Discuss with team** - Get consensus on organization
4. **Update index** - Add to relevant README or index file

## AI-Specific Guidelines

### For AI Assistants Reading Documentation

1. **Start with AI-CONTEXT.md** - It's the single comprehensive reference
2. **Use QUICK-REFERENCE.md** - For quick command and pattern lookups
3. **Read topic-specific docs** - When diving deep into specific areas
4. **Check examples** - Verify code examples in AI-CONTEXT.md match current codebase

### For AI Assistants Writing Documentation

1. **Follow this guide** - Adhere to all conventions
2. **Keep it concise** - Users want information quickly
3. **Use examples** - Code examples are worth 1000 words
4. **Link extensively** - Help readers find related information
5. **Update footer** - Always set/update `_Last Updated` date

### When AI Should Create Documentation

- Implementing new features
- Adding new modules
- Changing architecture
- Updating APIs
- Fixing complex bugs (document the fix)
- Changing best practices

## Related Documentation

- [MoLOS Documentation README](./README.md) - Main documentation index
- [AI Context Reference](./AI-CONTEXT.md) - Comprehensive AI reference
- [Quick Reference](./QUICK-REFERENCE.md) - Command and pattern reference
- [Module Development Guide](./modules/development.md) - Module development process
- [Getting Started Guide](./getting-started/development.md) - Developer onboarding

---

_Last Updated: 2026-02-24_
