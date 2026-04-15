import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'OPC Agent',
  description: 'Open Agent Framework - Build, test, and run AI Agents for business workstations',
  
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'API', link: '/api/oad-schema' },
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
                { text: 'Templates', link: '/guide/templates' },
                { text: 'Configuration', link: '/guide/configuration' },
                { text: 'Testing', link: '/guide/testing' },
                { text: 'Deployment', link: '/guide/deployment' },
              ],
            },
          ],
          '/api/': [
            {
              text: 'Reference',
              items: [
                { text: 'OAD Schema', link: '/api/oad-schema' },
                { text: 'CLI Commands', link: '/api/cli' },
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
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: 'API', link: '/zh/api/oad-schema' },
          { text: 'GitHub', link: 'https://github.com/Deepleaper/opc-agent' },
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '介绍',
              items: [
                { text: '快速开始', link: '/zh/guide/getting-started' },
                { text: '核心概念', link: '/zh/guide/concepts' },
              ],
            },
            {
              text: '使用',
              items: [
                { text: '模板', link: '/zh/guide/templates' },
                { text: '配置', link: '/zh/guide/configuration' },
                { text: '测试', link: '/zh/guide/testing' },
                { text: '部署', link: '/zh/guide/deployment' },
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
    ],
    footer: {
      message: 'Released under the Apache-2.0 License.',
      copyright: 'Copyright © 2025 Deepleaper',
    },
  },
});
