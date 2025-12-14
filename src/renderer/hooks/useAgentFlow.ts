import { useState, useCallback, useRef } from 'react';
import type { AgentNodeData } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export interface UseAgentFlowReturn {
  agentNodes: AgentNodeData[];
  currentAgentId: string | null;
  flowPanelOpen: boolean;
  handleSubAgentInvocation: (data: {
    agent_name: string;
    session_id: string;
    prompt: string;
    is_new_session: boolean;
  }) => void;
  handleSubAgentResponse: (data: {
    agent_name: string;
    session_id: string;
    response: string;
  }) => void;
  startNewConversation: (agentName: string, prompt: string) => void;
  markAgentError: () => void;
  markAllRunningAsError: () => void;
  markAllRunningAsCompleted: () => void;
  toggleFlowPanel: () => void;
  closeFlowPanel: () => void;
}

export function useAgentFlow(): UseAgentFlowReturn {
  const [agentNodes, setAgentNodes] = useState<AgentNodeData[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [flowPanelOpen, setFlowPanelOpen] = useState(true);
  const agentStackRef = useRef<string[]>([]);

  const handleSubAgentInvocation = useCallback((data: {
    agent_name: string;
    session_id: string;
    prompt: string;
    is_new_session: boolean;
  }) => {
    const newNode: AgentNodeData = {
      id: data.session_id,
      agentName: data.agent_name,
      parentId: currentAgentId,
      status: 'running',
      prompt: data.prompt,
      startTime: new Date(),
    };

    setAgentNodes((prev) => [...prev, newNode]);

    if (currentAgentId) {
      agentStackRef.current.push(currentAgentId);
    }
    setCurrentAgentId(data.session_id);
  }, [currentAgentId]);

  const handleSubAgentResponse = useCallback((data: {
    agent_name: string;
    session_id: string;
    response: string;
  }) => {
    setAgentNodes((prev) =>
      prev.map((node) =>
        node.id === data.session_id
          ? { ...node, status: 'completed', endTime: new Date() }
          : node
      )
    );

    const parentId = agentStackRef.current.pop() || null;
    setCurrentAgentId(parentId);
  }, []);

  const startNewConversation = useCallback((agentName: string, prompt: string) => {
    setAgentNodes([]);
    setCurrentAgentId(null);
    agentStackRef.current = [];

    const rootId = `root-${generateId()}`;
    const rootNode: AgentNodeData = {
      id: rootId,
      agentName: agentName,
      parentId: null,
      status: 'running',
      prompt: prompt,
      startTime: new Date(),
    };
    setAgentNodes([rootNode]);
    setCurrentAgentId(rootId);
  }, []);

  const markAgentError = useCallback(() => {
    if (currentAgentId) {
      setAgentNodes((prev) =>
        prev.map((node) =>
          node.id === currentAgentId
            ? { ...node, status: 'error', endTime: new Date() }
            : node
        )
      );
    }
  }, [currentAgentId]);

  const markAllRunningAsError = useCallback(() => {
    setAgentNodes((prev) =>
      prev.map((node) =>
        node.status === 'running'
          ? { ...node, status: 'error', endTime: new Date() }
          : node
      )
    );
  }, []);

  const markAllRunningAsCompleted = useCallback(() => {
    setAgentNodes((prev) =>
      prev.map((node) =>
        node.status === 'running'
          ? { ...node, status: 'completed', endTime: new Date() }
          : node
      )
    );
  }, []);

  const toggleFlowPanel = useCallback(() => {
    setFlowPanelOpen((prev) => !prev);
  }, []);

  const closeFlowPanel = useCallback(() => {
    setFlowPanelOpen(false);
  }, []);

  return {
    agentNodes,
    currentAgentId,
    flowPanelOpen,
    handleSubAgentInvocation,
    handleSubAgentResponse,
    startNewConversation,
    markAgentError,
    markAllRunningAsError,
    markAllRunningAsCompleted,
    toggleFlowPanel,
    closeFlowPanel,
  };
}
