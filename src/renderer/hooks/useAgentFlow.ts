import { useState, useCallback, useRef, useMemo } from 'react';
import type { AgentNodeData } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export interface UseAgentFlowReturn {
  agentNodes: AgentNodeData[];
  currentAgentId: string | null;
  currentAgentName: string | null;
  rootAgentId: string | null;
  hasActiveConversation: boolean;
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
  continueConversation: () => void;
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

  const currentAgentName = useMemo(() => {
    if (!currentAgentId) return null;
    const node = agentNodes.find((n) => n.id === currentAgentId);
    return node?.agentName || null;
  }, [agentNodes, currentAgentId]);

  // Find the root agent (the one with no parent)
  const rootAgentId = useMemo(() => {
    const rootNode = agentNodes.find((n) => n.parentId === null);
    return rootNode?.id || null;
  }, [agentNodes]);

  // Check if we have an active conversation (agents exist and root is completed, not error)
  const hasActiveConversation = useMemo(() => {
    if (agentNodes.length === 0) return false;
    const rootNode = agentNodes.find((n) => n.parentId === null);
    // Active means we have a conversation that completed successfully (can continue)
    return rootNode?.status === 'completed';
  }, [agentNodes]);

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

  // Continue an existing conversation - reactivate the root agent
  const continueConversation = useCallback(() => {
    // Find the root agent and mark it as running again
    setAgentNodes((prev) =>
      prev.map((node) =>
        node.parentId === null
          ? { ...node, status: 'running', startTime: new Date(), endTime: undefined }
          : node
      )
    );
    // Set current agent to root
    const rootNode = agentNodes.find((n) => n.parentId === null);
    if (rootNode) {
      setCurrentAgentId(rootNode.id);
      agentStackRef.current = [];
    }
  }, [agentNodes]);

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
    currentAgentName,
    rootAgentId,
    hasActiveConversation,
    flowPanelOpen,
    handleSubAgentInvocation,
    handleSubAgentResponse,
    startNewConversation,
    continueConversation,
    markAgentError,
    markAllRunningAsError,
    markAllRunningAsCompleted,
    toggleFlowPanel,
    closeFlowPanel,
  };
}
