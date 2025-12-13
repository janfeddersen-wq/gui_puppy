export type MessageType =
  | 'user'
  | 'assistant'
  | 'system'
  | 'error'
  | 'reasoning'
  | 'tool_output'
  | 'file_content'
  | 'file_listing'
  | 'grep_result'
  | 'diff'
  | 'shell_output'
  | 'shell_start';

// Structured data for different message types
export interface FileContentData {
  path: string;
  content: string;
  start_line?: number;
  num_lines?: number;
  total_lines: number;
  num_tokens: number;
}

export interface FileEntry {
  path: string;
  type: 'file' | 'dir';
  size: number;
  depth: number;
}

export interface FileListingData {
  directory: string;
  files: FileEntry[];
  recursive: boolean;
  total_size: number;
  dir_count: number;
  file_count: number;
}

export interface GrepMatch {
  file_path: string;
  line_number: number;
  line_content: string;
}

export interface GrepResultData {
  search_term: string;
  directory: string;
  matches: GrepMatch[];
  total_matches: number;
  files_searched: number;
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  line_number: number;
}

export interface DiffData {
  path: string;
  operation: 'create' | 'modify' | 'delete';
  diff_lines: DiffLine[];
}

export interface ShellOutputData {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  label?: string;
  timestamp: Date;
  isStreaming?: boolean;
  // Structured data for tool outputs
  data?: FileContentData | FileListingData | GrepResultData | DiffData | ShellOutputData;
}

export interface SidecarMessage {
  type: string;
  content?: string;
  text?: string;
  level?: string;
  // File content
  path?: string;
  start_line?: number;
  num_lines?: number;
  total_lines?: number;
  num_tokens?: number;
  // File listing
  directory?: string;
  files?: FileEntry[];
  recursive?: boolean;
  total_size?: number;
  dir_count?: number;
  file_count?: number;
  // Grep result
  search_term?: string;
  matches?: GrepMatch[];
  total_matches?: number;
  files_searched?: number;
  // Diff
  operation?: string;
  diff_lines?: DiffLine[];
  // Shell
  command?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  output?: string;
  tool?: string;
}

export interface InputRequest {
  prompt_id: string;
  prompt: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Config types
export interface AgentInfo {
  name: string;
  label: string;
  description: string;
}

export interface ApiKeyInfo {
  is_set: boolean;
  masked: string;
}

export interface ApiKeysConfig {
  OPENAI_API_KEY: ApiKeyInfo;
  ANTHROPIC_API_KEY: ApiKeyInfo;
  GEMINI_API_KEY: ApiKeyInfo;
  CEREBRAS_API_KEY: ApiKeyInfo;
  OPENROUTER_API_KEY: ApiKeyInfo;
  AZURE_OPENAI_API_KEY: ApiKeyInfo;
  AZURE_OPENAI_ENDPOINT: ApiKeyInfo;
  [key: string]: ApiKeyInfo;
}

export interface ModelPinning {
  [agentName: string]: string;
}

export interface AppConfig {
  current: {
    agent: string;
    model: string;
    temperature: number | null;
    yolo_mode: boolean;
    auto_save: boolean;
    suppress_thinking: boolean;
    suppress_info: boolean;
  };
  available: {
    agents: AgentInfo[];
    models: string[];
  };
  api_keys: ApiKeysConfig;
  model_pinning: ModelPinning;
}

export interface ConfigUpdate {
  agent?: string;
  model?: string;
  temperature?: number | null;
  yolo_mode?: boolean;
  auto_save?: boolean;
  suppress_thinking?: boolean;
  suppress_info?: boolean;
}

// OAuth types
export interface OAuthStatus {
  available: boolean;
  authenticated: boolean;
  models: string[];
  expires_in?: string;
  error?: string;
}

export interface OAuthResult {
  success: boolean;
  message?: string;
  error?: string;
  models_added?: number;
}

export interface OAuthUrl {
  url: string;
  redirect_uri: string;
}

export interface ApiKeyResult {
  success: boolean;
  key_name?: string;
  message?: string;
  error?: string;
}

export interface ModelPinResult {
  success: boolean;
  agent_name?: string;
  model_name?: string;
  message?: string;
  error?: string;
}

export interface WorkingDirectoryResult {
  success: boolean;
  path?: string;
  message?: string;
  error?: string;
}

export interface ElectronAPI {
  getSidecarPort: () => Promise<number | null>;
  restartSidecar: () => Promise<number>;
  onSidecarReady: (callback: (data: { port: number }) => void) => void;
  onSidecarError: (callback: (data: { error: string }) => void) => void;
  onSidecarClosed: (callback: (data: { code: number }) => void) => void;
  openExternal: (url: string) => Promise<void>;
  selectFolder: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Agent Flow Graph types
export type AgentNodeStatus = 'running' | 'completed' | 'error';

export interface AgentNodeData {
  id: string;           // session_id
  agentName: string;
  parentId: string | null;
  status: AgentNodeStatus;
  prompt: string;
  startTime: Date;
  endTime?: Date;
}

export interface SubAgentMessage {
  type: 'sub_agent';
  agent_name: string;
  prompt: string;
  session_id: string;
  is_new_session: boolean;
}

export interface SubAgentResponseMessage {
  type: 'sub_agent_response';
  agent_name: string;
  session_id: string;
  response: string;
}
