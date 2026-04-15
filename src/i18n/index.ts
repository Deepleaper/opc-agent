/**
 * Internationalization (i18n) support for OPC Agent.
 * Supports English, Chinese, and Japanese.
 */
export type Locale = 'en' | 'zh-CN' | 'ja';

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
    'cli.test.fail': '{count} test(s) failed',
    'cli.stats.title': 'Agent Analytics',
    'cli.stats.messages': 'Messages Processed',
    'cli.stats.avgTime': 'Avg Response Time',
    'cli.stats.errors': 'Errors',
    'cli.stats.uptime': 'Uptime',
    'plugin.loaded': 'Plugin "{name}" loaded',
    'plugin.error': 'Plugin "{name}" failed: {error}',
    'web.title': 'OPC Agent',
    'web.chat.placeholder': 'Type a message...',
    'web.chat.send': 'Send',
    'web.nav.chat': 'Chat',
    'web.nav.dashboard': 'Dashboard',
    'web.nav.settings': 'Settings',
    'web.dashboard.title': 'Dashboard',
    'web.dashboard.messages': 'Messages',
    'web.dashboard.tokens': 'Tokens Used',
    'web.dashboard.errors': 'Errors',
    'web.dashboard.avgLatency': 'Avg Latency',
    'web.settings.title': 'Settings',
    'web.settings.language': 'Language',
    'web.settings.theme': 'Theme',
    'web.settings.save': 'Save',
    'cache.hit': 'Cache hit',
    'cache.miss': 'Cache miss',
    'rateLimit.exceeded': 'Rate limit exceeded. Please wait.',
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
    'cli.test.fail': '{count} 个测试失败',
    'cli.stats.title': '智能体分析',
    'cli.stats.messages': '已处理消息',
    'cli.stats.avgTime': '平均响应时间',
    'cli.stats.errors': '错误数',
    'cli.stats.uptime': '运行时间',
    'plugin.loaded': '插件 "{name}" 已加载',
    'plugin.error': '插件 "{name}" 失败: {error}',
    'web.title': 'OPC 智能体',
    'web.chat.placeholder': '输入消息...',
    'web.chat.send': '发送',
    'web.nav.chat': '对话',
    'web.nav.dashboard': '仪表盘',
    'web.nav.settings': '设置',
    'web.dashboard.title': '仪表盘',
    'web.dashboard.messages': '消息数',
    'web.dashboard.tokens': '已用 Token',
    'web.dashboard.errors': '错误数',
    'web.dashboard.avgLatency': '平均延迟',
    'web.settings.title': '设置',
    'web.settings.language': '语言',
    'web.settings.theme': '主题',
    'web.settings.save': '保存',
    'cache.hit': '缓存命中',
    'cache.miss': '缓存未命中',
    'rateLimit.exceeded': '请求过于频繁，请稍候。',
  },
  'ja': {
    'agent.started': 'エージェント「{name}」が正常に起動しました',
    'agent.stopped': 'エージェント「{name}」が停止しました',
    'agent.error': 'エラーが発生しました: {error}',
    'agent.greeting': 'こんにちは！何かお手伝いできますか？',
    'agent.farewell': 'さようなら！良い一日を。',
    'agent.notUnderstood': '申し訳ございません、理解できませんでした。別の言い方でお願いできますか？',
    'agent.handoff': 'オペレーターにおつなぎします。',
    'cli.init.success': 'エージェントプロジェクトを作成しました: {name}',
    'cli.build.success': 'ビルド成功: {name} v{version}',
    'cli.test.pass': '全テスト合格',
    'cli.test.fail': '{count} 件のテストが失敗しました',
    'cli.stats.title': 'エージェント分析',
    'cli.stats.messages': '処理済みメッセージ',
    'cli.stats.avgTime': '平均応答時間',
    'cli.stats.errors': 'エラー数',
    'cli.stats.uptime': '稼働時間',
    'plugin.loaded': 'プラグイン「{name}」を読み込みました',
    'plugin.error': 'プラグイン「{name}」でエラー: {error}',
    'web.title': 'OPC エージェント',
    'web.chat.placeholder': 'メッセージを入力...',
    'web.chat.send': '送信',
    'web.nav.chat': 'チャット',
    'web.nav.dashboard': 'ダッシュボード',
    'web.nav.settings': '設定',
    'web.dashboard.title': 'ダッシュボード',
    'web.dashboard.messages': 'メッセージ数',
    'web.dashboard.tokens': '使用トークン',
    'web.dashboard.errors': 'エラー数',
    'web.dashboard.avgLatency': '平均レイテンシ',
    'web.settings.title': '設定',
    'web.settings.language': '言語',
    'web.settings.theme': 'テーマ',
    'web.settings.save': '保存',
    'cache.hit': 'キャッシュヒット',
    'cache.miss': 'キャッシュミス',
    'rateLimit.exceeded': 'リクエスト制限を超えました。しばらくお待ちください。',
  },
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function getSupportedLocales(): { code: Locale; label: string }[] {
  return [
    { code: 'en', label: 'English' },
    { code: 'zh-CN', label: '中文' },
    { code: 'ja', label: '日本語' },
  ];
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
  if (env.startsWith('ja')) return 'ja';
  return 'en';
}

export function addMessages(locale: Locale, newMessages: I18nMessages): void {
  messages[locale] = { ...messages[locale], ...newMessages };
}
