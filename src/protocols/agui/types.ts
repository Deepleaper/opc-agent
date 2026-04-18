// AG-UI Protocol Types — Agent-User Interaction Protocol
// https://docs.ag-ui.com

export type AGUIEventType =
  | 'TEXT_MESSAGE_START'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_ARGS'
  | 'TOOL_CALL_END'
  | 'STATE_SNAPSHOT'
  | 'STATE_DELTA'
  | 'MESSAGES_SNAPSHOT'
  | 'RUN_STARTED'
  | 'RUN_FINISHED'
  | 'RUN_ERROR'
  | 'STEP_STARTED'
  | 'STEP_FINISHED'
  | 'CUSTOM';

export const AGUI_EVENT_TYPES: AGUIEventType[] = [
  'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END',
  'TOOL_CALL_START', 'TOOL_CALL_ARGS', 'TOOL_CALL_END',
  'STATE_SNAPSHOT', 'STATE_DELTA', 'MESSAGES_SNAPSHOT',
  'RUN_STARTED', 'RUN_FINISHED', 'RUN_ERROR',
  'STEP_STARTED', 'STEP_FINISHED', 'CUSTOM',
];

export interface AGUIEvent {
  type: AGUIEventType;
  timestamp: string;
  [key: string]: any;
}

export interface TextMessageStartEvent extends AGUIEvent {
  type: 'TEXT_MESSAGE_START';
  messageId: string;
  role: 'assistant';
}

export interface TextMessageContentEvent extends AGUIEvent {
  type: 'TEXT_MESSAGE_CONTENT';
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent extends AGUIEvent {
  type: 'TEXT_MESSAGE_END';
  messageId: string;
}

export interface ToolCallStartEvent extends AGUIEvent {
  type: 'TOOL_CALL_START';
  toolCallId: string;
  toolCallName: string;
}

export interface ToolCallArgsEvent extends AGUIEvent {
  type: 'TOOL_CALL_ARGS';
  toolCallId: string;
  delta: string;
}

export interface ToolCallEndEvent extends AGUIEvent {
  type: 'TOOL_CALL_END';
  toolCallId: string;
}

export interface StateSnapshotEvent extends AGUIEvent {
  type: 'STATE_SNAPSHOT';
  snapshot: Record<string, any>;
}

export interface StateDeltaEvent extends AGUIEvent {
  type: 'STATE_DELTA';
  delta: any[]; // JSON Patch (RFC 6902)
}

export interface MessagesSnapshotEvent extends AGUIEvent {
  type: 'MESSAGES_SNAPSHOT';
  messages: AGUIMessage[];
}

export interface RunStartedEvent extends AGUIEvent {
  type: 'RUN_STARTED';
  runId: string;
  threadId?: string;
}

export interface RunFinishedEvent extends AGUIEvent {
  type: 'RUN_FINISHED';
  runId: string;
}

export interface RunErrorEvent extends AGUIEvent {
  type: 'RUN_ERROR';
  runId: string;
  message: string;
  code?: string;
}

export interface StepStartedEvent extends AGUIEvent {
  type: 'STEP_STARTED';
  stepId: string;
  stepName?: string;
}

export interface StepFinishedEvent extends AGUIEvent {
  type: 'STEP_FINISHED';
  stepId: string;
}

export interface CustomEvent extends AGUIEvent {
  type: 'CUSTOM';
  name: string;
  value: any;
}

// ─── Message & Request Types ─────────────────────────────────

export interface AGUIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: AGUIToolCall[];
}

export interface AGUIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AGUIRunRequest {
  threadId?: string;
  runId?: string;
  messages: AGUIMessage[];
  tools?: AGUIToolDefinition[];
  context?: any[];
  forwardedProps?: Record<string, any>;
}

export interface AGUIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export function isValidEventType(type: string): type is AGUIEventType {
  return AGUI_EVENT_TYPES.includes(type as AGUIEventType);
}
