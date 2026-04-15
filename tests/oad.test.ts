import { describe, it, expect } from 'vitest';
import { OADSchema } from '../src/schema/oad';

describe('OAD Schema', () => {
  it('should parse a valid OAD document', () => {
    const doc = OADSchema.parse({
      apiVersion: 'opc/v1',
      kind: 'Agent',
      metadata: { name: 'test-agent' },
      spec: {},
    });
    expect(doc.metadata.name).toBe('test-agent');
    expect(doc.metadata.version).toBe('1.0.0');
    expect(doc.spec.model).toBe('deepseek-chat');
  });

  it('should reject invalid apiVersion', () => {
    expect(() =>
      OADSchema.parse({
        apiVersion: 'v2',
        kind: 'Agent',
        metadata: { name: 'test' },
        spec: {},
      })
    ).toThrow();
  });

  it('should parse full document with all fields', () => {
    const doc = OADSchema.parse({
      apiVersion: 'opc/v1',
      kind: 'Agent',
      metadata: {
        name: 'full-agent',
        version: '2.0.0',
        description: 'A full agent',
        author: 'Test',
        license: 'MIT',
        marketplace: { certified: true, category: 'support' },
      },
      spec: {
        provider: { default: 'openai', allowed: ['openai'] },
        model: 'gpt-4',
        systemPrompt: 'You are helpful.',
        skills: [{ name: 'faq', description: 'FAQ skill' }],
        channels: [{ type: 'web', port: 8080 }],
        memory: { shortTerm: true, longTerm: true },
        dtv: {
          trust: { level: 'certified' },
          value: { metrics: ['response_time'] },
        },
      },
    });
    expect(doc.metadata.version).toBe('2.0.0');
    expect(doc.spec.channels[0].port).toBe(8080);
    expect(doc.spec.dtv?.trust?.level).toBe('certified');
  });

  it('should reject missing metadata.name', () => {
    expect(() =>
      OADSchema.parse({
        apiVersion: 'opc/v1',
        kind: 'Agent',
        metadata: {},
        spec: {},
      })
    ).toThrow();
  });
});
