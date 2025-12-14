import { useState, useCallback } from 'react';
import type {
  Message,
  MessageType,
  SidecarMessage,
  FileContentData,
  FileListingData,
  GrepResultData,
  DiffData,
  ShellOutputData,
} from '../types';

type StructuredData = FileContentData | FileListingData | GrepResultData | DiffData | ShellOutputData;

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function mapMessageType(type: string): MessageType {
  switch (type) {
    case 'agent_response':
    case 'text':
      return 'assistant';
    case 'reasoning':
      return 'reasoning';
    case 'tool_output':
      return 'tool_output';
    case 'file_content':
      return 'file_content';
    case 'file_listing':
      return 'file_listing';
    case 'grep_result':
      return 'grep_result';
    case 'diff':
      return 'diff';
    case 'shell_output':
      return 'shell_output';
    case 'shell_start':
      return 'shell_start';
    case 'status':
      return 'system';
    case 'error':
      return 'error';
    default:
      return 'assistant';
  }
}

function getLabel(type: string, data: SidecarMessage): string | undefined {
  switch (type) {
    case 'reasoning':
      return 'Thinking';
    case 'tool_output':
      return data.tool || 'Tool Output';
    case 'file_content':
      return `File: ${data.path || 'unknown'}`;
    case 'diff':
      return `Diff: ${data.path || 'unknown'}`;
    case 'shell_output':
      return 'Shell';
    default:
      return undefined;
  }
}

function parseStructuredData(msgType: string, data: SidecarMessage): { content: string; structuredData?: StructuredData } {
  let content = data.content || data.text || '';
  let structuredData: StructuredData | undefined;

  if (msgType === 'file_content' && data.path) {
    structuredData = {
      path: data.path,
      content: data.content || '',
      start_line: data.start_line,
      num_lines: data.num_lines,
      total_lines: data.total_lines || 0,
      num_tokens: data.num_tokens || 0,
    } as FileContentData;
    const filename = data.path.split('/').pop() || data.path;
    content = `Read ${filename} (${data.total_lines || 0} lines, ~${data.num_tokens || 0} tokens)`;
  } else if (msgType === 'file_listing' && data.directory) {
    structuredData = {
      directory: data.directory,
      files: data.files || [],
      recursive: data.recursive || false,
      total_size: data.total_size || 0,
      dir_count: data.dir_count || 0,
      file_count: data.file_count || 0,
    } as FileListingData;
    content = `Listed ${data.directory} (${data.dir_count || 0} dirs, ${data.file_count || 0} files)`;
  } else if (msgType === 'grep_result' && data.search_term) {
    structuredData = {
      search_term: data.search_term,
      directory: data.directory || '.',
      matches: data.matches || [],
      total_matches: data.total_matches || 0,
      files_searched: data.files_searched || 0,
    } as GrepResultData;
    content = `Grep "${data.search_term}" → ${data.total_matches || 0} matches in ${data.files_searched || 0} files`;
  } else if (msgType === 'diff' && data.path) {
    structuredData = {
      path: data.path,
      operation: (data.operation as 'create' | 'modify' | 'delete') || 'modify',
      diff_lines: data.diff_lines || [],
    } as DiffData;
    const filename = data.path.split('/').pop() || data.path;
    const op = data.operation === 'create' ? 'Created' : data.operation === 'delete' ? 'Deleted' : 'Modified';
    content = `${op} ${filename}`;
  } else if (msgType === 'shell_output' || msgType === 'shell_start') {
    structuredData = {
      command: data.command || '',
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      exit_code: data.exit_code ?? 0,
    } as ShellOutputData;
    const cmd = data.command || '';
    const shortCmd = cmd.length > 60 ? cmd.substring(0, 60) + '...' : cmd;
    const exitStr = data.exit_code !== undefined && data.exit_code !== 0 ? ` (exit ${data.exit_code})` : '';
    content = `$ ${shortCmd}${exitStr}`;
  }

  return { content, structuredData };
}

export interface AgentContext {
  agentId: string;
  agentName: string;
}

export interface UseMessagesReturn {
  messages: Message[];
  streamingMessageId: string | null;
  addMessage: (type: MessageType, content: string, label?: string, data?: StructuredData) => string;
  updateMessage: (id: string, content: string) => void;
  handleSidecarMessage: (data: SidecarMessage, onSubAgent?: (data: SubAgentData) => void, onSubAgentResponse?: (data: SubAgentResponseData) => void) => void;
  handleStreamChunk: (content: string) => void;
  finalizeStreaming: () => void;
  startStreaming: () => string;
  setCurrentAgent: (agentId: string, agentName: string) => void;
  currentAgent: AgentContext | null;
}

export interface SubAgentData {
  agent_name: string;
  session_id: string;
  prompt: string;
  is_new_session: boolean;
}

export interface SubAgentResponseData {
  agent_name: string;
  session_id: string;
  response: string;
}

export function useMessages(): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      type: 'system',
      content: 'Initializing code_puppy sidecar...',
      timestamp: new Date(),
    },
  ]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [currentAgent, setCurrentAgentState] = useState<AgentContext | null>(null);

  const setCurrentAgent = useCallback((agentId: string, agentName: string) => {
    setCurrentAgentState({ agentId, agentName });
  }, []);

  const addMessage = useCallback((type: MessageType, content: string, label?: string, data?: StructuredData) => {
    const id = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id,
        type,
        content,
        label,
        timestamp: new Date(),
        data,
        agentId: currentAgent?.agentId,
        agentName: currentAgent?.agentName,
      },
    ]);
    return id;
  }, [currentAgent]);

  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, content } : msg))
    );
  }, []);

  const finalizeStreaming = useCallback(() => {
    if (streamingMessageId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
      setStreamingMessageId(null);
    }
  }, [streamingMessageId]);

  const startStreaming = useCallback(() => {
    const id = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        agentId: currentAgent?.agentId,
        agentName: currentAgent?.agentName,
      },
    ]);
    setStreamingMessageId(id);
    return id;
  }, [currentAgent]);

  const handleStreamChunk = useCallback((content: string) => {
    if (streamingMessageId) {
      updateMessage(streamingMessageId, content);
    } else {
      const id = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id,
          type: 'assistant',
          content,
          timestamp: new Date(),
          isStreaming: true,
          agentId: currentAgent?.agentId,
          agentName: currentAgent?.agentName,
        },
      ]);
      setStreamingMessageId(id);
    }
  }, [streamingMessageId, updateMessage, currentAgent]);

  const handleSidecarMessage = useCallback((
    data: SidecarMessage,
    onSubAgent?: (data: SubAgentData) => void,
    onSubAgentResponse?: (data: SubAgentResponseData) => void
  ) => {
    const msgType = data.type || 'text';

    // Handle sub-agent messages
    if (msgType === 'sub_agent' && onSubAgent) {
      onSubAgent({
        agent_name: (data as unknown as { agent_name: string }).agent_name,
        session_id: (data as unknown as { session_id: string }).session_id,
        prompt: (data as unknown as { prompt: string }).prompt,
        is_new_session: (data as unknown as { is_new_session: boolean }).is_new_session,
      });
      const agentName = (data as unknown as { agent_name: string }).agent_name;
      const prompt = (data as unknown as { prompt: string }).prompt;
      addMessage('system', `Invoking ${agentName}: ${prompt.substring(0, 80)}...`);
      return;
    }

    if (msgType === 'sub_agent_response' && onSubAgentResponse) {
      onSubAgentResponse({
        agent_name: (data as unknown as { agent_name: string }).agent_name,
        session_id: (data as unknown as { session_id: string }).session_id,
        response: (data as unknown as { response: string }).response,
      });
      return;
    }

    const type = mapMessageType(msgType);
    const label = getLabel(msgType, data);
    const { content, structuredData } = parseStructuredData(msgType, data);

    if (content || structuredData) {
      finalizeStreaming();
      addMessage(type, content, label, structuredData);
    }
  }, [addMessage, finalizeStreaming]);

  return {
    messages,
    streamingMessageId,
    addMessage,
    updateMessage,
    handleSidecarMessage,
    handleStreamChunk,
    finalizeStreaming,
    startStreaming,
    setCurrentAgent,
    currentAgent,
  };
}
