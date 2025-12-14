import { useState, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
import { Header, MessageList, InputArea, ConfigDialog, AgentFlowPanel, ResizablePanel } from './components';
import { useSocket, useMessages, useAgentFlow } from './hooks';
import type {
  InputRequest,
  AppConfig,
  ConfigUpdate,
  OAuthStatus,
  OAuthResult,
  OAuthUrl,
  ApiKeyResult,
  ModelPinResult,
  AgentNodeData,
} from './types';

export function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPromptId, setPendingPromptId] = useState<string | null>(null);

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

  // Working directory state
  const [workingDirectory, setWorkingDirectoryState] = useState<string>('');

  // Use extracted hooks
  const {
    messages,
    addMessage,
    handleSidecarMessage,
    handleStreamChunk,
    finalizeStreaming,
    startStreaming,
    setCurrentAgent,
  } = useMessages();

  const {
    agentNodes,
    currentAgentId,
    currentAgentName,
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
  } = useAgentFlow();

  // Agent filter state for message list
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  // Sync current agent to messages hook
  useEffect(() => {
    if (currentAgentId && currentAgentName) {
      setCurrentAgent(currentAgentId, currentAgentName);
    }
  }, [currentAgentId, currentAgentName, setCurrentAgent]);

  // Message handler
  const handleMessage = useCallback((data: Parameters<typeof handleSidecarMessage>[0]) => {
    handleSidecarMessage(data, handleSubAgentInvocation, handleSubAgentResponse);
  }, [handleSidecarMessage, handleSubAgentInvocation, handleSubAgentResponse]);

  // Input request handler
  const handleInputRequest = useCallback((request: InputRequest) => {
    addMessage('system', request.prompt || 'Input requested');
    setIsProcessing(false);
    setPendingPromptId(request.prompt_id);
  }, [addMessage]);

  // Task complete handler
  const handleTaskComplete = useCallback(() => {
    setIsProcessing(false);
    finalizeStreaming();
  }, [finalizeStreaming]);

  // Error handler
  const handleError = useCallback((error: string) => {
    addMessage('error', error);
    setIsProcessing(false);
    markAgentError();
  }, [addMessage, markAgentError]);

  // Config handlers
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

  // OAuth handlers
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

  // API key and model pin handlers
  const handleApiKeyResult = useCallback((result: ApiKeyResult) => {
    setApiKeyResult(result);
    setTimeout(() => setApiKeyResult(null), 3000);
  }, []);

  const handleModelPinResult = useCallback((result: ModelPinResult) => {
    setModelPinResult(result);
    setTimeout(() => setModelPinResult(null), 3000);
  }, []);

  // Working directory handlers
  const handleWorkingDirectory = useCallback((path: string) => {
    setWorkingDirectoryState(path);
  }, []);

  const handleWorkingDirectoryResult = useCallback((result: { success: boolean; path?: string; message?: string; error?: string }) => {
    if (result.error) {
      addMessage('error', `Failed to change directory: ${result.error}`);
    }
  }, [addMessage]);

  // Socket connection
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

  // Refresh config after API key or model pin changes
  useEffect(() => {
    if (apiKeyResult?.success || modelPinResult?.success) {
      requestConfig();
    }
  }, [apiKeyResult, modelPinResult, requestConfig]);

  // Mark agents as completed when processing ends
  useEffect(() => {
    if (!isProcessing && agentNodes.length > 0) {
      markAllRunningAsCompleted();
    }
  }, [isProcessing, agentNodes.length, markAllRunningAsCompleted]);

  // Send message handler
  const handleSend = useCallback((text: string, images?: { id: string; name: string; dataUrl: string; file?: File }[]) => {
    // Show image count in message display
    const messageText = images && images.length > 0
      ? `${text}\n\n[${images.length} image(s) attached]`
      : text;
    addMessage('user', messageText);
    setIsProcessing(true);

    // Continue existing conversation or start a new one
    if (hasActiveConversation) {
      continueConversation();
    } else {
      startNewConversation(config?.current.agent || 'code-puppy', text);
    }
    startStreaming();

    if (pendingPromptId) {
      sendInputResponse(pendingPromptId, text);
      setPendingPromptId(null);
    } else {
      // Send images along with prompt
      const imageData = images?.map(img => ({
        name: img.name,
        dataUrl: img.dataUrl,
        mimeType: img.file?.type || 'image/png',
      }));
      sendPrompt(text, imageData);
    }
  }, [addMessage, pendingPromptId, sendInputResponse, sendPrompt, config, startNewConversation, continueConversation, hasActiveConversation, startStreaming]);

  // Cancel handler
  const handleCancel = useCallback(() => {
    cancel();
    setIsProcessing(false);
    addMessage('system', 'Cancelled.');
    markAllRunningAsError();
  }, [cancel, addMessage, markAllRunningAsError]);

  // Settings dialog handler
  const handleSettingsClick = useCallback(() => {
    setConfigLoading(true);
    requestConfig();
    requestOAuthStatus();
    setConfigDialogOpen(true);
  }, [requestConfig, requestOAuthStatus]);

  // Config save handler
  const handleConfigSave = useCallback((updates: ConfigUpdate) => {
    setConfigLoading(true);
    updateConfig(updates);
  }, [updateConfig]);

  // Agent change handler
  const handleAgentChange = useCallback((agentName: string) => {
    updateConfig({ agent: agentName });
  }, [updateConfig]);

  // OAuth login/logout handlers
  const handleOAuthLogin = useCallback(() => {
    setOAuthLoading(true);
    startOAuth();
  }, [startOAuth]);

  const handleOAuthLogout = useCallback(() => {
    setOAuthLoading(true);
    oauthLogout();
  }, [oauthLogout]);

  // Folder selection handler
  const handleFolderClick = useCallback(async () => {
    const selectedPath = await window.electronAPI.selectFolder();
    if (selectedPath) {
      setWorkingDirectory(selectedPath);
    }
  }, [setWorkingDirectory]);

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
        onToggleFlowPanel={toggleFlowPanel}
        flowPanelOpen={flowPanelOpen}
        onFolderClick={handleFolderClick}
      />
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <MessageList
            messages={messages}
            agentFilter={agentFilter}
            agentNodes={agentNodes}
            onClearFilter={() => setAgentFilter(null)}
          />
          <InputArea
            onSend={handleSend}
            onCancel={handleCancel}
            disabled={!isConnected}
            isProcessing={isProcessing}
          />
        </Box>

        {flowPanelOpen && (
          <ResizablePanel
            defaultWidth={300}
            minWidth={200}
            maxWidth={600}
            side="right"
            storageKey="agent-flow-panel-width"
          >
            <AgentFlowPanel
              agentNodes={agentNodes}
              currentAgentId={currentAgentId}
              onClose={closeFlowPanel}
              onNodeClick={(nodeId) => setAgentFilter(nodeId)}
              selectedNodeId={agentFilter}
            />
          </ResizablePanel>
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
