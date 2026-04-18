import type { MCPTool, MCPToolResult } from '../mcp';

// In-memory storage fallback
interface Trajectory {
  id: string;
  taskType: string;
  actions: Array<{ action: string; timestamp: number; reward?: number }>;
  outcome?: 'success' | 'partial' | 'failure';
  totalReward: number;
}

interface PolicyEntry {
  taskType: string;
  preferredActions: string[];
  weights: Record<string, number>;
}

const trajectories: Trajectory[] = [];
const policies = new Map<string, PolicyEntry>();
let currentEpisode: Trajectory | null = null;

function getOrCreateEpisode(taskType: string): Trajectory {
  if (!currentEpisode || currentEpisode.taskType !== taskType) {
    currentEpisode = {
      id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskType,
      actions: [],
      totalReward: 0,
    };
    trajectories.push(currentEpisode);
  }
  return currentEpisode;
}

export const rlRecordTrajectory: MCPTool = {
  name: 'rl_record_trajectory',
  description: 'Record action sequences and outcomes for RL training',
  inputSchema: {
    type: 'object',
    properties: {
      taskType: { type: 'string' },
      action: { type: 'string' },
      outcome: { type: 'string', enum: ['success', 'partial', 'failure'] },
    },
    required: ['taskType', 'action'],
  },
  async execute(input): Promise<MCPToolResult> {
    const ep = getOrCreateEpisode(input.taskType as string);
    ep.actions.push({ action: input.action as string, timestamp: Date.now() });
    if (input.outcome) ep.outcome = input.outcome as Trajectory['outcome'];
    return { content: JSON.stringify({ episodeId: ep.id, actionsRecorded: ep.actions.length }) };
  },
};

export const rlEvaluateOutcome: MCPTool = {
  name: 'rl_evaluate_outcome',
  description: "Score an action's outcome (success/partial/failure)",
  inputSchema: {
    type: 'object',
    properties: {
      episodeId: { type: 'string' },
      outcome: { type: 'string', enum: ['success', 'partial', 'failure'] },
    },
    required: ['outcome'],
  },
  async execute(input): Promise<MCPToolResult> {
    const ep = input.episodeId
      ? trajectories.find(t => t.id === input.episodeId)
      : currentEpisode;
    if (!ep) return { content: 'No active episode found', isError: true };
    ep.outcome = input.outcome as Trajectory['outcome'];
    const score = ep.outcome === 'success' ? 1 : ep.outcome === 'partial' ? 0.5 : 0;
    return { content: JSON.stringify({ episodeId: ep.id, outcome: ep.outcome, score }) };
  },
};

export const rlGetBestStrategy: MCPTool = {
  name: 'rl_get_best_strategy',
  description: 'Retrieve best-performing strategy for a task type',
  inputSchema: {
    type: 'object',
    properties: { taskType: { type: 'string' } },
    required: ['taskType'],
  },
  async execute(input): Promise<MCPToolResult> {
    const taskType = input.taskType as string;
    const relevant = trajectories.filter(t => t.taskType === taskType && t.outcome === 'success');
    if (relevant.length === 0) return { content: JSON.stringify({ strategy: null, message: 'No successful strategies found' }) };
    const best = relevant.reduce((a, b) => a.totalReward >= b.totalReward ? a : b);
    return { content: JSON.stringify({ strategy: best.actions.map(a => a.action), totalReward: best.totalReward }) };
  },
};

export const rlCompareStrategies: MCPTool = {
  name: 'rl_compare_strategies',
  description: 'Compare multiple strategies by success rate',
  inputSchema: {
    type: 'object',
    properties: { taskType: { type: 'string' } },
    required: ['taskType'],
  },
  async execute(input): Promise<MCPToolResult> {
    const taskType = input.taskType as string;
    const relevant = trajectories.filter(t => t.taskType === taskType && t.outcome);
    const total = relevant.length;
    const successes = relevant.filter(t => t.outcome === 'success').length;
    const partials = relevant.filter(t => t.outcome === 'partial').length;
    const failures = relevant.filter(t => t.outcome === 'failure').length;
    return {
      content: JSON.stringify({
        taskType, total, successRate: total ? successes / total : 0,
        breakdown: { successes, partials, failures },
      }),
    };
  },
};

export const rlGenerateTrainingData: MCPTool = {
  name: 'rl_generate_training_data',
  description: 'Export trajectories as fine-tuning JSONL',
  inputSchema: {
    type: 'object',
    properties: { taskType: { type: 'string' }, minReward: { type: 'number' } },
  },
  async execute(input): Promise<MCPToolResult> {
    let data = trajectories;
    if (input.taskType) data = data.filter(t => t.taskType === input.taskType);
    if (input.minReward != null) data = data.filter(t => t.totalReward >= (input.minReward as number));
    const jsonl = data.map(t => JSON.stringify({
      messages: [
        { role: 'system', content: `Task: ${t.taskType}` },
        ...t.actions.map(a => ({ role: 'assistant', content: a.action })),
      ],
      outcome: t.outcome,
      reward: t.totalReward,
    })).join('\n');
    return { content: jsonl || '(no data)' };
  },
};

export const rlRewardSignal: MCPTool = {
  name: 'rl_reward_signal',
  description: 'Record positive/negative reward for last action',
  inputSchema: {
    type: 'object',
    properties: { reward: { type: 'number' }, reason: { type: 'string' } },
    required: ['reward'],
  },
  async execute(input): Promise<MCPToolResult> {
    if (!currentEpisode || currentEpisode.actions.length === 0) {
      return { content: 'No current episode or actions to reward', isError: true };
    }
    const lastAction = currentEpisode.actions[currentEpisode.actions.length - 1];
    lastAction.reward = input.reward as number;
    currentEpisode.totalReward += input.reward as number;
    return { content: JSON.stringify({ action: lastAction.action, reward: input.reward, totalReward: currentEpisode.totalReward }) };
  },
};

export const rlExplorationSuggest: MCPTool = {
  name: 'rl_exploration_suggest',
  description: 'Suggest alternative approaches (exploration)',
  inputSchema: {
    type: 'object',
    properties: { taskType: { type: 'string' }, currentAction: { type: 'string' } },
    required: ['taskType'],
  },
  async execute(input): Promise<MCPToolResult> {
    const taskType = input.taskType as string;
    const allActions = new Set<string>();
    trajectories.filter(t => t.taskType === taskType).forEach(t => t.actions.forEach(a => allActions.add(a.action)));
    const suggestions = Array.from(allActions).filter(a => a !== input.currentAction).slice(0, 5);
    if (suggestions.length === 0) {
      return { content: JSON.stringify({ suggestions: [], message: 'No alternative actions found. Try a completely new approach.' }) };
    }
    return { content: JSON.stringify({ suggestions }) };
  },
};

export const rlUpdatePolicy: MCPTool = {
  name: 'rl_update_policy',
  description: "Update agent's action preferences based on rewards",
  inputSchema: {
    type: 'object',
    properties: { taskType: { type: 'string' }, action: { type: 'string' }, weight: { type: 'number' } },
    required: ['taskType', 'action', 'weight'],
  },
  async execute(input): Promise<MCPToolResult> {
    const taskType = input.taskType as string;
    let policy = policies.get(taskType);
    if (!policy) {
      policy = { taskType, preferredActions: [], weights: {} };
      policies.set(taskType, policy);
    }
    const action = input.action as string;
    policy.weights[action] = (policy.weights[action] || 0) + (input.weight as number);
    policy.preferredActions = Object.entries(policy.weights)
      .sort(([, a], [, b]) => b - a)
      .map(([k]) => k);
    return { content: JSON.stringify({ taskType, preferredActions: policy.preferredActions.slice(0, 5), weights: policy.weights }) };
  },
};

export const rlGetStatistics: MCPTool = {
  name: 'rl_get_statistics',
  description: 'Get success/failure stats by task type',
  inputSchema: {
    type: 'object',
    properties: { taskType: { type: 'string' } },
  },
  async execute(input): Promise<MCPToolResult> {
    let data = trajectories;
    if (input.taskType) data = data.filter(t => t.taskType === input.taskType);
    const stats: Record<string, { total: number; success: number; partial: number; failure: number; avgReward: number }> = {};
    for (const t of data) {
      if (!stats[t.taskType]) stats[t.taskType] = { total: 0, success: 0, partial: 0, failure: 0, avgReward: 0 };
      const s = stats[t.taskType];
      s.total++;
      if (t.outcome === 'success') s.success++;
      else if (t.outcome === 'partial') s.partial++;
      else if (t.outcome === 'failure') s.failure++;
      s.avgReward = (s.avgReward * (s.total - 1) + t.totalReward) / s.total;
    }
    return { content: JSON.stringify(stats) };
  },
};

export const rlResetEpisode: MCPTool = {
  name: 'rl_reset_episode',
  description: 'Clear current episode state',
  inputSchema: { type: 'object', properties: {} },
  async execute(): Promise<MCPToolResult> {
    const had = currentEpisode != null;
    currentEpisode = null;
    return { content: JSON.stringify({ reset: true, hadActiveEpisode: had }) };
  },
};

export const rlTools: MCPTool[] = [
  rlRecordTrajectory, rlEvaluateOutcome, rlGetBestStrategy, rlCompareStrategies,
  rlGenerateTrainingData, rlRewardSignal, rlExplorationSuggest, rlUpdatePolicy,
  rlGetStatistics, rlResetEpisode,
];
