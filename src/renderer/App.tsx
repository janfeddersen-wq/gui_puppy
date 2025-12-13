import { useState, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { Header, MessageList, InputArea, ConfigDialog, AgentFlowPanel } from './components';
import { useSocket } from './hooks';
import type {
  Message,
  SidecarMessage,
  InputRequest,
  MessageType,
  AppConfig,
  ConfigUpdate,
  OAuthStatus,
  OAuthResult,
  OAuthUrl,
  ApiKeyResult,
  ModelPinResult,
  FileContentData,
  FileListingData,
  GrepResultData,
  DiffData,
  ShellOutputData,
  AgentNodeData,
} from './types';

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

export function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      type: 'system',
      content: 'Initializing code_puppy sidecar...',
      timestamp: new Date(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPromptId, setPendingPromptId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Config state
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // OAuth state
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null);
  const [oauthLoading, setOAuthLoading] = useState(false);

  // API key and model pin result state
  const [apiKeyResult, setApiKeyResult] = useState<ApiKeyResult | null>(null);
  const [modelPinResult, setModelPinResult] = useState<ModelPinResult | null>(null);

  // Agent flow state
  const [agentNodes, setAgentNodes] = useState<AgentNodeData[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [flowPanelOpen, setFlowPanelOpen] = useState(true);
  const agentStackRef = useRef<string[]>([]); // Track parent chain

  // Working directory state
  const [workingDirectory, setWorkingDirectoryState] = useState<string>('');

  const addMessage = useCallback((type: MessageType, content: string, label?: string, data?: FileContentData | FileListingData | GrepResultData | DiffData | ShellOutputData) => {
    const id = generateId();
    setMessages((prev) => [
      ...prev,
      { id, type, content, label, timestamp: new Date(), data },
    ]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, content } : msg))
    );
  }, []);

  // Handle sub-agent invocation
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

    // Push current agent to stack and set new agent as current
    if (currentAgentId) {
      agentStackRef.current.push(currentAgentId);
    }
    setCurrentAgentId(data.session_id);
  }, [currentAgentId]);

  // Handle sub-agent response
  const handleSubAgentResponse = useCallback((data: {
    agent_name: string;
    session_id: string;
    response: string;
  }) => {
    // Mark the node as completed
    setAgentNodes((prev) =>
      prev.map((node) =>
        node.id === data.session_id
          ? { ...node, status: 'completed', endTime: new Date() }
          : node
      )
    );

    // Pop back to parent agent
    const parentId = agentStackRef.current.pop() || null;
    setCurrentAgentId(parentId);
  }, []);

  const handleMessage = useCallback((data: SidecarMessage) => {
    const msgType = data.type || 'text';

    // Handle sub-agent messages for flow graph
    if (msgType === 'sub_agent') {
      handleSubAgentInvocation({
        agent_name: (data as unknown as { agent_name: string }).agent_name,
        session_id: (data as unknown as { session_id: string }).session_id,
        prompt: (data as unknown as { prompt: string }).prompt,
        is_new_session: (data as unknown as { is_new_session: boolean }).is_new_session,
      });
      // Still add to message list
      const agentName = (data as unknown as { agent_name: string }).agent_name;
      const prompt = (data as unknown as { prompt: string }).prompt;
      addMessage('system', `Invoking ${agentName}: ${prompt.substring(0, 80)}...`);
      return;
    }

    if (msgType === 'sub_agent_response') {
      handleSubAgentResponse({
        agent_name: (data as unknown as { agent_name: string }).agent_name,
        session_id: (data as unknown as { session_id: string }).session_id,
        response: (data as unknown as { response: string }).response,
      });
      return;
    }

    const type = mapMessageType(msgType);
    const label = getLabel(msgType, data);

    let content = data.content || data.text || '';
    let structuredData: FileContentData | FileListingData | GrepResultData | DiffData | ShellOutputData | undefined;

    // Handle structured message types
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

    if (content || structuredData) {
      if (streamingMessageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg
          )
        );
        setStreamingMessageId(null);
      }
      addMessage(type, content, label, structuredData);
    }
  }, [addMessage, streamingMessageId, handleSubAgentInvocation, handleSubAgentResponse]);

  const handleStreamChunk = useCallback((content: string) => {
    if (streamingMessageId) {
      updateMessage(streamingMessageId, content);
    } else {
      const id = generateId();
      setMessages((prev) => [
        ...prev,
        { id, type: 'assistant', content, timestamp: new Date(), isStreaming: true },
      ]);
      setStreamingMessageId(id);
    }
  }, [streamingMessageId, updateMessage]);

  const handleInputRequest = useCallback((request: InputRequest) => {
    addMessage('system', request.prompt || 'Input requested');
    setIsProcessing(false);
    setPendingPromptId(request.prompt_id);
  }, [addMessage]);

  const handleTaskComplete = useCallback(() => {
    setIsProcessing(false);
    if (streamingMessageId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
      setStreamingMessageId(null);
    }
  }, [streamingMessageId]);

  const handleError = useCallback((error: string) => {
    addMessage('error', error);
    setIsProcessing(false);

    // Mark current agent as error
    if (currentAgentId) {
      setAgentNodes((prev) =>
        prev.map((node) =>
          node.id === currentAgentId
            ? { ...node, status: 'error', endTime: new Date() }
            : node
        )
      );
    }
  }, [addMessage, currentAgentId]);

  const handleConfigReceived = useCallback((newConfig: AppConfig) => {
    setConfig(newConfig);
    setConfigLoading(false);
  }, []);

  const handleConfigUpdated = useCallback((result: { success: boolean; changes?: string[]; error?: string }) => {
    setConfigLoading(false);
    if (result.success) {
      requestConfig();
    } else if (result.error) {
      addMessage('error', `Config update failed: ${result.error}`);
    }
  }, [addMessage]);

  const handleOAuthStatus = useCallback((status: OAuthStatus) => {
    setOAuthStatus(status);
    setOAuthLoading(false);
  }, []);

  const handleOAuthResult = useCallback((result: OAuthResult) => {
    setOAuthLoading(false);
    if (result.success) {
      addMessage('system', result.message || 'OAuth authentication successful');
    } else if (result.error) {
      addMessage('error', `OAuth failed: ${result.error}`);
    }
  }, [addMessage]);

  const handleOAuthUrl = useCallback((data: OAuthUrl) => {
    window.electronAPI.openExternal(data.url);
    addMessage('system', 'Opening browser for Claude Code authentication...');
  }, [addMessage]);

  const handleApiKeyResult = useCallback((result: ApiKeyResult) => {
    setApiKeyResult(result);
    setTimeout(() => setApiKeyResult(null), 3000);
  }, []);

  const handleModelPinResult = useCallback((result: ModelPinResult) => {
    setModelPinResult(result);
    setTimeout(() => setModelPinResult(null), 3000);
  }, []);

  const handleWorkingDirectory = useCallback((path: string) => {
    setWorkingDirectoryState(path);
  }, []);

  const handleWorkingDirectoryResult = useCallback((result: { success: boolean; path?: string; message?: string; error?: string }) => {
    if (result.error) {
      addMessage('error', `Failed to change directory: ${result.error}`);
    }
  }, [addMessage]);

  const {
    status,
    sendPrompt,
    sendInputResponse,
    cancel,
    requestConfig,
    updateConfig,
    requestOAuthStatus,
    startOAuth,
    oauthLogout,
    setApiKey,
    setModelPin,
    setWorkingDirectory,
    isConnected,
  } = useSocket({
    onMessage: handleMessage,
    onStreamChunk: handleStreamChunk,
    onInputRequest: handleInputRequest,
    onTaskComplete: handleTaskComplete,
    onError: handleError,
    onConfigReceived: handleConfigReceived,
    onConfigUpdated: handleConfigUpdated,
    onOAuthStatus: handleOAuthStatus,
    onOAuthResult: handleOAuthResult,
    onOAuthUrl: handleOAuthUrl,
    onApiKeyResult: handleApiKeyResult,
    onModelPinResult: handleModelPinResult,
    onWorkingDirectory: handleWorkingDirectory,
    onWorkingDirectoryResult: handleWorkingDirectoryResult,
  });

  useEffect(() => {
    if (apiKeyResult?.success || modelPinResult?.success) {
      requestConfig();
    }
  }, [apiKeyResult, modelPinResult, requestConfig]);

  const handleSend = useCallback((text: string) => {
    addMessage('user', text);
    setIsProcessing(true);

    // Clear agent flow for new conversation
    setAgentNodes([]);
    setCurrentAgentId(null);
    agentStackRef.current = [];

    // Add root agent node
    const rootId = `root-${generateId()}`;
    const rootNode: AgentNodeData = {
      id: rootId,
      agentName: config?.current.agent || 'code-puppy',
      parentId: null,
      status: 'running',
      prompt: text,
      startTime: new Date(),
    };
    setAgentNodes([rootNode]);
    setCurrentAgentId(rootId);

    const id = generateId();
    setMessages((prev) => [
      ...prev,
      { id, type: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);
    setStreamingMessageId(id);

    if (pendingPromptId) {
      sendInputResponse(pendingPromptId, text);
      setPendingPromptId(null);
    } else {
      sendPrompt(text);
    }
  }, [addMessage, pendingPromptId, sendInputResponse, sendPrompt, config]);

  const handleCancel = useCallback(() => {
    cancel();
    setIsProcessing(false);
    addMessage('system', 'Cancelled.');

    // Mark all running agents as error
    setAgentNodes((prev) =>
      prev.map((node) =>
        node.status === 'running'
          ? { ...node, status: 'error', endTime: new Date() }
          : node
      )
    );
  }, [cancel, addMessage]);

  const handleSettingsClick = useCallback(() => {
    setConfigLoading(true);
    requestConfig();
    requestOAuthStatus();
    setConfigDialogOpen(true);
  }, [requestConfig, requestOAuthStatus]);

  const handleConfigSave = useCallback((updates: ConfigUpdate) => {
    setConfigLoading(true);
    updateConfig(updates);
  }, [updateConfig]);

  const handleAgentChange = useCallback((agentName: string) => {
    updateConfig({ agent: agentName });
  }, [updateConfig]);

  const handleOAuthLogin = useCallback(() => {
    setOAuthLoading(true);
    startOAuth();
  }, [startOAuth]);

  const handleOAuthLogout = useCallback(() => {
    setOAuthLoading(true);
    oauthLogout();
  }, [oauthLogout]);

  const handleToggleFlowPanel = useCallback(() => {
    setFlowPanelOpen((prev) => !prev);
  }, []);

  const handleCloseFlowPanel = useCallback(() => {
    setFlowPanelOpen(false);
  }, []);

  const handleFolderClick = useCallback(async () => {
    const selectedPath = await window.electronAPI.selectFolder();
    if (selectedPath) {
      setWorkingDirectory(selectedPath);
    }
  }, [setWorkingDirectory]);

  // Mark root agent as completed when task completes
  useEffect(() => {
    if (!isProcessing && agentNodes.length > 0) {
      setAgentNodes((prev) =>
        prev.map((node) =>
          node.status === 'running'
            ? { ...node, status: 'completed', endTime: new Date() }
            : node
        )
      );
    }
  }, [isProcessing, agentNodes.length]);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Header
        status={status}
        agentName={config?.current.agent}
        modelName={config?.current.model}
        workingDirectory={workingDirectory}
        availableAgents={config?.available.agents}
        onSettingsClick={handleSettingsClick}
        onAgentChange={handleAgentChange}
        onToggleFlowPanel={handleToggleFlowPanel}
        flowPanelOpen={flowPanelOpen}
        onFolderClick={handleFolderClick}
      />
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main chat area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <MessageList messages={messages} />
          <InputArea
            onSend={handleSend}
            onCancel={handleCancel}
            disabled={!isConnected}
            isProcessing={isProcessing}
          />
        </Box>

        {/* Agent Flow Panel */}
        {flowPanelOpen && (
          <Box sx={{ width: 300, height: '100%', flexShrink: 0 }}>
            <AgentFlowPanel
              agentNodes={agentNodes}
              currentAgentId={currentAgentId}
              onClose={handleCloseFlowPanel}
            />
          </Box>
        )}
      </Box>
      <ConfigDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        config={config}
        onSave={handleConfigSave}
        isLoading={configLoading}
        oauthStatus={oauthStatus}
        onOAuthLogin={handleOAuthLogin}
        onOAuthLogout={handleOAuthLogout}
        oauthLoading={oauthLoading}
        onSetApiKey={setApiKey}
        onSetModelPin={setModelPin}
        apiKeyResult={apiKeyResult}
        modelPinResult={modelPinResult}
      />
    </Box>
  );
}
