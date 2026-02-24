# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for MoLOS.

## What is an ADR?

An ADR is a document that describes an important architectural decision, its context, alternatives considered, and consequences.

## ADR Template

```markdown
# ADR-{number}: {Title}

| Status    | {Proposed/Accepted/Deprecated/Superseded} |
| --------- | ----------------------------------------- |
| Date      | YYYY-MM-DD                                |
| Deciders  | {Development Team / Individuals}          |
| Review By | YYYY-MM-DD (optional)                     |

## Context

{Background and problem statement}

## Decision

{The decision made, in one or two sentences}

### Rationale

{Why this decision was made}

### Trade-offs

| Aspect      | Decision A | Decision B |
| ----------- | ---------- | ---------- |
| Simplicity  | ✅ High    | Medium     |
| Performance | Medium     | ✅ High    |
| ...         | ...        | ...        |

## Consequences

### Positive

{Benefits of this decision}

### Negative

{Drawbacks or risks}

### Neutral

{Impact that is neither positive nor negative}

## Related

- [Link to related ADR](./xxx-title.md)
- [Link to implementation](../path/to/code)
```

## ADR Process

1. **Propose** - Create ADR with Status: Proposed
2. **Discuss** - Get feedback from team
3. **Decide** - Update Status: Accepted or Rejected
4. **Implement** - Make code changes per decision
5. **Review** - Revisit ADR if new information arises

## ADR Index

| ADR | Title                                                               | Status   | Date       |
| --- | ------------------------------------------------------------------- | -------- | ---------- |
| 001 | [Migration Tracking Strategy](./001-migration-tracking-strategy.md) | Accepted | 2026-02-21 |

## Guidelines

- Use sequential numbers (001, 002, etc.)
- Write concisely but clearly
- Focus on architectural decisions (not implementation details)
- Include concrete trade-offs where applicable
- Update ADRs if decisions change

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - System architecture
- [Database Architecture](../architecture/database.md) - Database system design

---

_Last Updated: 2026-02-24_
