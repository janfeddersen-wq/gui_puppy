import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ConnectionStatus, SidecarMessage, InputRequest, AppConfig, ConfigUpdate, OAuthStatus, OAuthResult, OAuthUrl, ApiKeyResult, ModelPinResult, WorkingDirectoryResult } from '../types';

interface UseSocketOptions {
  onMessage: (message: SidecarMessage) => void;
  onStreamChunk: (content: string) => void;
  onInputRequest: (request: InputRequest) => void;
  onTaskComplete: () => void;
  onError: (error: string) => void;
  onConfigReceived: (config: AppConfig) => void;
  onConfigUpdated: (result: { success: boolean; changes?: string[]; error?: string }) => void;
  onOAuthStatus: (status: OAuthStatus) => void;
  onOAuthResult: (result: OAuthResult) => void;
  onOAuthUrl: (data: OAuthUrl) => void;
  onApiKeyResult: (result: ApiKeyResult) => void;
  onModelPinResult: (result: ModelPinResult) => void;
  onWorkingDirectory: (path: string) => void;
  onWorkingDirectoryResult: (result: WorkingDirectoryResult) => void;
}

export function useSocket(options: UseSocketOptions) {
  // Use refs for callbacks to avoid recreating socket on callback changes
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [port, setPort] = useState<number | null>(null);
  const connectedPortRef = useRef<number | null>(null);

  const connect = useCallback((newPort: number) => {
    // Prevent duplicate connections to same port
    if (connectedPortRef.current === newPort && socketRef.current?.connected) {
      console.log('Already connected to port', newPort);
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setPort(newPort);
    setStatus('connecting');
    connectedPortRef.current = newPort;

    const socket = io(`http://127.0.0.1:${newPort}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Connected to sidecar');
      setStatus('connected');
      // Request config on connect
      socket.emit('get_config');
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setStatus('error');
    });

    socket.on('message', (data: SidecarMessage) => {
      console.log('Received message:', data);
      callbacksRef.current.onMessage(data);
    });

    socket.on('stream_chunk', (data: { content: string }) => {
      if (data.content) {
        callbacksRef.current.onStreamChunk(data.content);
      }
    });

    socket.on('task_complete', () => {
      callbacksRef.current.onTaskComplete();
    });

    socket.on('error', (data: { message: string }) => {
      callbacksRef.current.onError(data.message || 'An error occurred');
    });

    socket.on('input_request', (data: InputRequest) => {
      callbacksRef.current.onInputRequest(data);
    });

    // Config events
    socket.on('config', (data: AppConfig) => {
      console.log('Received config:', data);
      callbacksRef.current.onConfigReceived(data);
    });

    socket.on('config_updated', (data: { success: boolean; changes?: string[]; error?: string }) => {
      console.log('Config updated:', data);
      callbacksRef.current.onConfigUpdated(data);
    });

    // OAuth events
    socket.on('oauth_status', (data: OAuthStatus) => {
      console.log('OAuth status:', data);
      callbacksRef.current.onOAuthStatus(data);
    });

    socket.on('oauth_result', (data: OAuthResult) => {
      console.log('OAuth result:', data);
      callbacksRef.current.onOAuthResult(data);
    });

    socket.on('oauth_url', (data: OAuthUrl) => {
      console.log('OAuth URL:', data);
      callbacksRef.current.onOAuthUrl(data);
    });

    // API key and model pin events
    socket.on('api_key_result', (data: ApiKeyResult) => {
      console.log('API key result:', data);
      callbacksRef.current.onApiKeyResult(data);
    });

    socket.on('model_pin_result', (data: ModelPinResult) => {
      console.log('Model pin result:', data);
      callbacksRef.current.onModelPinResult(data);
    });

    // Working directory events
    socket.on('working_directory', (data: { path: string }) => {
      console.log('Working directory:', data);
      callbacksRef.current.onWorkingDirectory(data.path);
    });

    socket.on('working_directory_result', (data: WorkingDirectoryResult) => {
      console.log('Working directory result:', data);
      callbacksRef.current.onWorkingDirectoryResult(data);
    });

    socketRef.current = socket;
  }, []); // No dependencies - connect is stable

  const sendPrompt = useCallback((text: string, images?: { name: string; dataUrl: string; mimeType?: string }[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('prompt', { text, images });
    }
  }, []);

  const sendInputResponse = useCallback((promptId: string, response: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('input_response', { prompt_id: promptId, response });
    }
  }, []);

  const cancel = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('cancel');
    }
  }, []);

  const requestConfig = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get_config');
    }
  }, []);

  const updateConfig = useCallback((updates: ConfigUpdate) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('set_config', updates);
    }
  }, []);

  const requestOAuthStatus = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('oauth_status');
    }
  }, []);

  const startOAuth = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('oauth_start');
    }
  }, []);

  const oauthLogout = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('oauth_logout');
    }
  }, []);

  const setApiKey = useCallback((keyName: string, value: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('set_api_key', { key_name: keyName, value });
    }
  }, []);

  const setModelPin = useCallback((agentName: string, modelName: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('set_model_pin', { agent_name: agentName, model_name: modelName });
    }
  }, []);

  const setWorkingDirectory = useCallback((path: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('set_working_directory', { path });
    }
  }, []);

  useEffect(() => {
    // Listen for sidecar events from Electron
    window.electronAPI.onSidecarReady((data) => {
      console.log('Sidecar ready on port:', data.port);
      connect(data.port);
    });

    window.electronAPI.onSidecarError((data) => {
      callbacksRef.current.onError(`Sidecar error: ${data.error}`);
      setStatus('error');
    });

    window.electronAPI.onSidecarClosed((data) => {
      callbacksRef.current.onError(`Sidecar process exited (code: ${data.code})`);
      setStatus('disconnected');
    });

    // Check if sidecar is already running
    window.electronAPI.getSidecarPort().then((existingPort) => {
      if (existingPort) {
        connect(existingPort);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [connect]); // Only depends on connect which is now stable

  return {
    status,
    port,
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
    isConnected: status === 'connected',
  };
}
