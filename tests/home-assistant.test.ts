import { describe, it, expect } from 'vitest';
import { haGetStates, haCallService, haGetHistory, haAutomation, configureHomeAssistant } from '../src/tools/builtin/home-assistant';

describe('Home Assistant Tools', () => {
  it('ha_get_states fails without config', async () => {
    const r = await haGetStates.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('not configured');
  });

  it('ha_call_service fails without config', async () => {
    const r = await haCallService.execute({ domain: 'light', service: 'turn_on', entity_id: 'light.living' });
    expect(r.isError).toBe(true);
  });

  it('ha_get_history fails without config', async () => {
    const r = await haGetHistory.execute({ entity_id: 'sensor.temp' });
    expect(r.isError).toBe(true);
  });

  it('ha_automation list fails without config', async () => {
    const r = await haAutomation.execute({ action: 'list' });
    expect(r.isError).toBe(true);
  });

  it('ha_automation requires automation_id for trigger', async () => {
    configureHomeAssistant({ url: 'http://localhost:8123', token: 'test' });
    // Will fail on fetch but tests the validation path
    const r = await haAutomation.execute({ action: 'trigger' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('automation_id required');
  });

  it('all HA tools have correct names', () => {
    expect(haGetStates.name).toBe('ha_get_states');
    expect(haCallService.name).toBe('ha_call_service');
    expect(haGetHistory.name).toBe('ha_get_history');
    expect(haAutomation.name).toBe('ha_automation');
  });
});
