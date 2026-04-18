// Google A2A Protocol Types — https://google.github.io/A2A/

export interface A2AAgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  skills: A2AAgentSkill[];
  defaultInputModes: string[];
  defaultOutputModes: string[];
  authentication?: {
    schemes: string[];
  };
}

export interface A2AAgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
}

export interface A2ATask {
  id: string;
  sessionId: string;
  status: A2ATaskStatus;
  history: A2AMessage[];
  artifacts: A2AArtifact[];
  metadata?: Record<string, any>;
}

export type A2ATaskState = 'submitted' | 'working' | 'input-required' | 'completed' | 'canceled' | 'failed';

export interface A2ATaskStatus {
  state: A2ATaskState;
  message?: A2AMessage;
  timestamp: string;
}

export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2AMessagePart[];
}

export type A2AMessagePart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { name: string; mimeType: string; bytes?: string; uri?: string } }
  | { type: 'data'; data: Record<string, any> };

export interface A2AArtifact {
  name: string;
  description?: string;
  parts: A2AMessagePart[];
  index: number;
  append?: boolean;
  lastChunk?: boolean;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

// Standard JSON-RPC error codes
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TASK_NOT_FOUND: -32001,
  TASK_CANCELED: -32002,
} as const;
