# Implementation Plan: Agent Selector & Flow Graph

## Overview
Add two features:
1. **Agent selector dropdown** in the header to switch agents (like CLI `/agent` command)
2. **ReactFlow-based agent flow graph** on the right side showing agent execution hierarchy

## Feature 1: Agent Selector Dropdown

### Changes:
1. **Header.tsx** - Replace the static agent Chip with a clickable dropdown
   - Show available agents from `config.available.agents`
   - When selected, emit `set_config({ agent: agentName })`
   - Display current agent with a small dropdown arrow

2. **App.tsx** - Pass available agents and change handler to Header

### API:
- Already have `updateConfig({ agent: 'agent-name' })` in useSocket
- Already have `config.available.agents` with name, label, description

## Feature 2: Agent Flow Graph (ReactFlow)

### Install:
```bash
npm install reactflow
```

### New Components:

1. **AgentFlowPanel.tsx** - The ReactFlow panel showing agent execution tree
   - Nodes: Agents being executed
   - Edges: Parent → Child agent invocations
   - Node states: running (animated), completed (green), error (red)

2. **AgentFlowNode.tsx** - Custom node for agents
   - Shows agent name
   - Shows status (running/done/error)
   - Compact design

### State Management:

Track agent invocations in App.tsx:
```typescript
interface AgentNode {
  id: string;           // session_id
  agentName: string;
  parentId: string | null;  // Which agent invoked this one
  status: 'running' | 'completed' | 'error';
  prompt: string;
}

const [agentNodes, setAgentNodes] = useState<AgentNode[]>([]);
const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
```

### Message Handling:

When we receive `sub_agent` message:
- Add new node to agentNodes
- Create edge from currentAgentId to new node
- Set new node as currentAgentId

When we receive `sub_agent_response` message:
- Mark the node as completed
- Pop back to parent agent

### Layout:

Current layout:
```
+------------------+
|      Header      |
+------------------+
|                  |
|   MessageList    |
|                  |
+------------------+
|    InputArea     |
+------------------+
```

New layout:
```
+------------------+------------------+
|          Header (full width)       |
+------------------+------------------+
|                  |                  |
|   MessageList    |  AgentFlowPanel  |
|                  |                  |
+------------------+------------------+
|    InputArea     |                  |
+------------------+------------------+
```

The AgentFlowPanel should be collapsible/resizable with a drag handle.

## Implementation Steps:

1. Install ReactFlow
2. Create AgentFlowNode custom node component
3. Create AgentFlowPanel with ReactFlow
4. Update types.ts with agent node types
5. Update App.tsx:
   - Add agentNodes state
   - Handle sub_agent/sub_agent_response messages to build the tree
   - Pass data to AgentFlowPanel
6. Update Header.tsx:
   - Add agent selector dropdown
   - Show available agents with descriptions
7. Update main layout in App.tsx to side-by-side with resizable panels

## Flow Graph Behavior:

- **Start of conversation**: Root node is the selected agent (e.g., "planning-agent")
- **Agent invokes sub-agent**: New node added, edge from parent
- **Sub-agent completes**: Node marked complete, focus returns to parent
- **Nested invocations**: Tree grows deeper (planning → code-reviewer → qa-expert)
- **New conversation**: Clear the graph, start fresh

## Visual Design:

- Dark theme matching app
- Nodes:
  - Running: Pulsing blue border
  - Completed: Green checkmark
  - Error: Red X
- Edges: Curved, animated while running
- Auto-layout: Dagre vertical layout (parent on top)
