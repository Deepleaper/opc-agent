import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'OPC Agent',
  description: 'The Self-Evolving Agent Runtime — Build, deploy, and evolve AI agents that learn and grow',
  
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'API', link: '/api/cli' },
          { text: 'GitHub', link: 'https://github.com/Deepleaper/opc-agent' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Introduction',
              items: [
                { text: 'Getting Started', link: '/guide/getting-started' },
                { text: 'Core Concepts', link: '/guide/concepts' },
              ],
            },
            {
              text: 'Usage',
              items: [
                { text: 'Configuration', link: '/guide/configuration' },
                { text: 'Templates', link: '/guide/templates' },
                { text: 'Testing', link: '/guide/testing' },
                { text: 'Deployment', link: '/guide/deployment' },
              ],
            },
          ],
          '/api/': [
            {
              text: 'Reference',
              items: [
                { text: 'CLI Commands', link: '/api/cli' },
                { text: 'OAD Schema', link: '/api/oad-schema' },
                { text: 'SDK', link: '/api/sdk' },
              ],
            },
          ],
        },
      },
    },
    zh: {
      label: '中文',
      lang: 'zh-CN',
      description: '自进化智能体运行时 — 构建、部署、进化会学习和成长的 AI 智能体',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: 'API', link: '/zh/api/cli' },
          { text: 'GitHub', link: 'https://github.com/Deepleaper/opc-agent' },
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '入门',
              items: [
                { text: '快速开始', link: '/zh/guide/getting-started' },
                { text: '核心概念', link: '/zh/guide/concepts' },
              ],
            },
            {
              text: '使用',
              items: [
                { text: '配置', link: '/zh/guide/configuration' },
                { text: '模板', link: '/zh/guide/templates' },
                { text: '测试', link: '/zh/guide/testing' },
                { text: '部署', link: '/zh/guide/deployment' },
              ],
            },
          ],
          '/zh/api/': [
            {
              text: '参考',
              items: [
                { text: 'CLI 命令', link: '/zh/api/cli' },
                { text: 'OAD Schema', link: '/zh/api/oad-schema' },
                { text: 'SDK', link: '/zh/api/sdk' },
              ],
            },
          ],
        },
      },
    },
  },

  themeConfig: {
    logo: '/logo.svg',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Deepleaper/opc-agent' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/opc-agent' },
    ],
    footer: {
      message: 'Released under the Apache-2.0 License.',
      copyright: 'Copyright © 2025 Deepleaper 跃盟科技',
    },
    search: {
      provider: 'local',
    },
  },
});
