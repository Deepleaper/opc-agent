import type { Plugin } from './index';

/**
 * Content filter plugin — filters messages containing blocked keywords.
 */
export function createContentFilterPlugin(blocklist: string[] = []): Plugin {
  return {
    name: 'content-filter',
    version: '1.0.0',
    description: 'Filter inappropriate content',
    onMessage: async (msg: any, next: (m: any) => Promise<any>) => {
      const content = (msg.content || '').toLowerCase();
      for (const word of blocklist) {
        if (content.includes(word.toLowerCase())) {
          throw new Error(`Content blocked: message contains prohibited content`);
        }
      }
      return next(msg);
    },
  };
}

export const contentFilterPlugin: Plugin = createContentFilterPlugin([]);
