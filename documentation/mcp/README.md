# MCP (Model Context Protocol) Documentation

This directory contains documentation for Model Context Protocol (MCP) server integration with MoLOS.

## Overview

MCP enables AI assistants to interact with MoLOS functionality through a standardized protocol. This documentation covers integration requirements, server development, and technical specifications.

## Documents

- [Integration PRD](./integration-prd.md) - Product requirements for MCP integration
- [Server Development](./server-development.md) - Building the MCP server

## MCP in MoLOS

MoLOS uses MCP to:

1. **Provide AI tools** - Expose module functionality to AI assistants
2. **Enable context sharing** - Share application state with AI
3. **Support agent execution** - Allow AI to perform actions in MoLOS

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MoLOS Application                   │
│                                                         │
│   ┌──────────────┐      ┌─────────────────────┐      │
│   │   Modules    │─────▶│  MCP Server         │      │
│   │              │      │                     │      │
│   │ - AI Tools   │      │  - Tool Registry   │      │
│   │ - Resources  │      │  - Protocol Impl   │      │
│   └──────────────┘      └─────────────────────┘      │
│                                │                       │
│                                ▼                       │
│                     ┌─────────────────────┐              │
│                     │  AI Assistant      │              │
│                     │  (Claude, etc.)   │              │
│                     └─────────────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Related Documentation

- [AI Tools Development](../modules/ai-tools-development.md) - Creating AI tools for modules
- [AI-CONTEXT.md](../AI-CONTEXT.md) - MCP integration details
- [Architecture Overview](../architecture/overview.md) - System architecture

---

_Last Updated: 2026-02-24_
