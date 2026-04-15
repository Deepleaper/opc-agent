/**
 * Internationalization (i18n) support for OPC Agent.
 */
export type Locale = 'en' | 'zh-CN';

export interface I18nMessages {
  [key: string]: string;
}

const messages: Record<Locale, I18nMessages> = {
  'en': {
    'agent.started': 'Agent "{name}" started successfully',
    'agent.stopped': 'Agent "{name}" stopped',
    'agent.error': 'An error occurred: {error}',
    'agent.greeting': 'Hello! How can I help you?',
    'agent.farewell': 'Goodbye! Have a great day.',
    'agent.notUnderstood': 'I\'m not sure I understand. Could you rephrase?',
    'agent.handoff': 'Let me connect you with a human agent.',
    'cli.init.success': 'Created agent project: {name}',
    'cli.build.success': 'Build successful: {name} v{version}',
    'cli.test.pass': 'All tests passed',
    'cli.stats.title': 'Agent Analytics',
    'cli.stats.messages': 'Messages Processed',
    'cli.stats.avgTime': 'Avg Response Time',
    'cli.stats.errors': 'Errors',
    'cli.stats.uptime': 'Uptime',
    'plugin.loaded': 'Plugin "{name}" loaded',
    'plugin.error': 'Plugin "{name}" failed: {error}',
  },
  'zh-CN': {
    'agent.started': '智能体 "{name}" 启动成功',
    'agent.stopped': '智能体 "{name}" 已停止',
    'agent.error': '发生错误: {error}',
    'agent.greeting': '您好！有什么可以帮您的？',
    'agent.farewell': '再见！祝您愉快。',
    'agent.notUnderstood': '抱歉，我没有理解您的意思。能换个方式描述吗？',
    'agent.handoff': '我来为您转接人工客服。',
    'cli.init.success': '已创建智能体项目: {name}',
    'cli.build.success': '构建成功: {name} v{version}',
    'cli.test.pass': '所有测试通过',
    'cli.stats.title': '智能体分析',
    'cli.stats.messages': '已处理消息',
    'cli.stats.avgTime': '平均响应时间',
    'cli.stats.errors': '错误数',
    'cli.stats.uptime': '运行时间',
    'plugin.loaded': '插件 "{name}" 已加载',
    'plugin.error': '插件 "{name}" 失败: {error}',
  },
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string>): string {
  let msg = messages[currentLocale]?.[key] ?? messages['en']?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return msg;
}

export function detectLocale(): Locale {
  const env = process.env.LANG ?? process.env.LC_ALL ?? process.env.LANGUAGE ?? '';
  if (env.startsWith('zh')) return 'zh-CN';
  return 'en';
}

export function addMessages(locale: Locale, newMessages: I18nMessages): void {
  messages[locale] = { ...messages[locale], ...newMessages };
}
