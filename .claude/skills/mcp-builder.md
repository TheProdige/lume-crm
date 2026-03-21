---
name: mcp-builder
description: Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).
license: Complete terms in LICENSE.txt
---

# MCP Server Development Guide

## Overview

Create MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. The quality of an MCP server is measured by how well it enables LLMs to accomplish real-world tasks.

## High-Level Workflow

### Phase 1: Deep Research and Planning

- **API Coverage vs. Workflow Tools**: Balance comprehensive API endpoint coverage with specialized workflow tools.
- **Tool Naming and Discoverability**: Use consistent prefixes and action-oriented naming.
- **Context Management**: Design tools that return focused, relevant data.
- **Actionable Error Messages**: Error messages should guide agents toward solutions.

Study MCP specification: `https://modelcontextprotocol.io/sitemap.xml`

**Recommended stack**: TypeScript with Streamable HTTP for remote servers, stdio for local servers.

### Phase 2: Implementation

1. Set up project structure
2. Implement core infrastructure (API client, error handling, pagination)
3. Implement tools with:
   - Input schema (Zod for TypeScript, Pydantic for Python)
   - Output schema with `structuredContent`
   - Concise tool descriptions
   - Proper annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)

### Phase 3: Review and Test

- No duplicated code (DRY)
- Consistent error handling
- Full type coverage
- Test with MCP Inspector: `npx @modelcontextprotocol/inspector`

### Phase 4: Create Evaluations

Create 10 complex, realistic evaluation questions that test tool effectiveness.

## SDK References

- **TypeScript SDK**: `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md`
- **Python SDK**: `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md`
