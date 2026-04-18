import type { Plugin } from './index';

/**
 * Logger plugin — logs all messages and responses via middleware chain.
 */
export const loggerPlugin: Plugin = {
  name: 'logger',
  version: '1.0.0',
  description: 'Log all messages and responses',
  onMessage: async (msg: any, next: (m: any) => Promise<any>) => {
    console.log(`[${new Date().toISOString()}] IN: ${msg.content?.slice(0, 100)}`);
    return next(msg);
  },
  onResponse: async (res: any, next: (r: any) => Promise<any>) => {
    console.log(`[${new Date().toISOString()}] OUT: ${res.content?.slice(0, 100)}`);
    return next(res);
  },
};
