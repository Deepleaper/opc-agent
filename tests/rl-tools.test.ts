import { describe, it, expect, beforeEach } from 'vitest';
import {
  rlRecordTrajectory, rlEvaluateOutcome, rlGetBestStrategy, rlCompareStrategies,
  rlGenerateTrainingData, rlRewardSignal, rlExplorationSuggest, rlUpdatePolicy,
  rlGetStatistics, rlResetEpisode,
} from '../src/tools/builtin/rl-tools';

describe('RL Tools', () => {
  beforeEach(async () => { await rlResetEpisode.execute({}); });

  it('rl_record_trajectory records actions', async () => {
    const r = await rlRecordTrajectory.execute({ taskType: 'search', action: 'web_search' });
    const data = JSON.parse(r.content);
    expect(data.episodeId).toBeTruthy();
    expect(data.actionsRecorded).toBe(1);
  });

  it('rl_evaluate_outcome scores episode', async () => {
    await rlRecordTrajectory.execute({ taskType: 'search', action: 'web_search' });
    const r = await rlEvaluateOutcome.execute({ outcome: 'success' });
    const data = JSON.parse(r.content);
    expect(data.score).toBe(1);
  });

  it('rl_get_best_strategy returns null when no data', async () => {
    const r = await rlGetBestStrategy.execute({ taskType: 'nonexistent_xyz' });
    expect(JSON.parse(r.content).strategy).toBeNull();
  });

  it('rl_compare_strategies returns breakdown', async () => {
    await rlRecordTrajectory.execute({ taskType: 'coding', action: 'write', outcome: 'success' });
    await rlResetEpisode.execute({});
    await rlRecordTrajectory.execute({ taskType: 'coding', action: 'debug', outcome: 'failure' });
    const r = await rlCompareStrategies.execute({ taskType: 'coding' });
    const data = JSON.parse(r.content);
    expect(data.total).toBe(2);
    expect(data.breakdown.successes).toBe(1);
  });

  it('rl_generate_training_data exports JSONL', async () => {
    await rlRecordTrajectory.execute({ taskType: 'test', action: 'action1', outcome: 'success' });
    const r = await rlGenerateTrainingData.execute({ taskType: 'test' });
    expect(r.content).toContain('action1');
  });

  it('rl_reward_signal records reward', async () => {
    await rlRecordTrajectory.execute({ taskType: 'test', action: 'act' });
    const r = await rlRewardSignal.execute({ reward: 1.5 });
    const data = JSON.parse(r.content);
    expect(data.reward).toBe(1.5);
    expect(data.totalReward).toBe(1.5);
  });

  it('rl_reward_signal fails without episode', async () => {
    const r = await rlRewardSignal.execute({ reward: 1 });
    expect(r.isError).toBe(true);
  });

  it('rl_exploration_suggest returns suggestions', async () => {
    await rlRecordTrajectory.execute({ taskType: 'explore', action: 'a' });
    await rlResetEpisode.execute({});
    await rlRecordTrajectory.execute({ taskType: 'explore', action: 'b' });
    const r = await rlExplorationSuggest.execute({ taskType: 'explore', currentAction: 'a' });
    const data = JSON.parse(r.content);
    expect(data.suggestions).toContain('b');
  });

  it('rl_update_policy updates weights', async () => {
    const r = await rlUpdatePolicy.execute({ taskType: 'code', action: 'refactor', weight: 2 });
    const data = JSON.parse(r.content);
    expect(data.weights.refactor).toBe(2);
  });

  it('rl_get_statistics returns stats', async () => {
    await rlRecordTrajectory.execute({ taskType: 'stats_test', action: 'a', outcome: 'success' });
    const r = await rlGetStatistics.execute({ taskType: 'stats_test' });
    const data = JSON.parse(r.content);
    expect(data.stats_test.total).toBe(1);
    expect(data.stats_test.success).toBe(1);
  });

  it('rl_reset_episode clears state', async () => {
    await rlRecordTrajectory.execute({ taskType: 'test', action: 'a' });
    const r = await rlResetEpisode.execute({});
    expect(JSON.parse(r.content).hadActiveEpisode).toBe(true);
  });

  it('trajectory recording accumulates actions', async () => {
    await rlRecordTrajectory.execute({ taskType: 'multi', action: 'step1' });
    const r = await rlRecordTrajectory.execute({ taskType: 'multi', action: 'step2' });
    expect(JSON.parse(r.content).actionsRecorded).toBe(2);
  });
});
