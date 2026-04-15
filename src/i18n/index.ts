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
    'cli.init.prompt.name': 'Agent name:',
    'cli.init.prompt.template': 'Choose a template:',
    'cli.init.prompt.provider': 'Choose an LLM provider:',
    'cli.build.success': 'Build successful: {name} v{version}',
    'cli.test.pass': 'All tests passed',
    'cli.test.fail': '{count} test(s) failed',
    'cli.run.starting': 'Starting agent "{name}"...',
    'cli.run.listening': 'Agent "{name}" is running at http://localhost:{port}',
    'cli.deploy.success': 'Deployed "{name}" to {target}',
    'cli.deploy.error': 'Deploy failed: {error}',
    'cli.validate.success': 'OAD validation passed',
    'cli.validate.error': 'OAD validation failed: {error}',
    'cli.analytics.title': 'Agent Analytics',
    'cli.analytics.noData': 'No analytics data yet',
    'cli.stats.title': 'Agent Analytics',
    'cli.stats.messages': 'Messages Processed',
    'cli.stats.avgTime': 'Avg Response Time',
    'cli.stats.errors': 'Errors',
    'cli.stats.uptime': 'Uptime',
    'cli.chat.welcome': 'Chat with your agent. Type "exit" to quit.',
    'cli.dev.watching': 'Watching for changes...',
    'cli.publish.success': 'Published "{name}" v{version}',
    'plugin.loaded': 'Plugin "{name}" loaded',
    'plugin.error': 'Plugin "{name}" failed: {error}',
    'kb.added': 'Added "{file}" to knowledge base',
    'kb.searchResults': '{count} results found',
    'kb.noResults': 'No results found',
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
    'agent.error': '发生错误：{error}',
    'agent.greeting': '你好！有什么可以帮你的？',
    'agent.farewell': '再见！祝你愉快。',
    'agent.notUnderstood': '抱歉，我没太理解你的意思。能换个方式描述一下吗？',
    'agent.handoff': '我来帮你转接人工客服。',
    'cli.init.success': '已创建智能体项目：{name}',
    'cli.init.prompt.name': '智能体名称：',
    'cli.init.prompt.template': '选择一个模板：',
    'cli.init.prompt.provider': '选择大语言模型供应商：',
    'cli.build.success': '构建成功：{name} v{version}',
    'cli.test.pass': '所有测试通过',
    'cli.test.fail': '{count} 个测试失败',
    'cli.run.starting': '正在启动智能体 "{name}"...',
    'cli.run.listening': '智能体 "{name}" 已在 http://localhost:{port} 上运行',
    'cli.deploy.success': '已将 "{name}" 部署到 {target}',
    'cli.deploy.error': '部署失败：{error}',
    'cli.validate.success': 'OAD 配置校验通过',
    'cli.validate.error': 'OAD 配置校验失败：{error}',
    'cli.analytics.title': '智能体数据分析',
    'cli.analytics.noData': '暂无分析数据',
    'cli.stats.title': '智能体数据分析',
    'cli.stats.messages': '已处理消息',
    'cli.stats.avgTime': '平均响应时间',
    'cli.stats.errors': '错误数',
    'cli.stats.uptime': '运行时间',
    'cli.chat.welcome': '开始和智能体对话吧。输入 "exit" 退出。',
    'cli.dev.watching': '正在监听文件变更...',
    'cli.publish.success': '已发布 "{name}" v{version}',
    'plugin.loaded': '插件 "{name}" 已加载',
    'plugin.error': '插件 "{name}" 出错：{error}',
    'kb.added': '已将 "{file}" 添加到知识库',
    'kb.searchResults': '找到 {count} 条结果',
    'kb.noResults': '未找到相关结果',
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
    'cli.init.prompt.name': 'エージェント名:',
    'cli.init.prompt.template': 'テンプレートを選択:',
    'cli.init.prompt.provider': 'LLMプロバイダーを選択:',
    'cli.build.success': 'ビルド成功: {name} v{version}',
    'cli.test.pass': '全テスト合格',
    'cli.test.fail': '{count} 件のテストが失敗しました',
    'cli.run.starting': 'エージェント「{name}」を起動中...',
    'cli.run.listening': 'エージェント「{name}」が http://localhost:{port} で稼働中',
    'cli.deploy.success': '「{name}」を {target} にデプロイしました',
    'cli.deploy.error': 'デプロイ失敗: {error}',
    'cli.validate.success': 'OADバリデーション成功',
    'cli.validate.error': 'OADバリデーション失敗: {error}',
    'cli.analytics.title': 'エージェント分析',
    'cli.analytics.noData': '分析データがありません',
    'cli.stats.title': 'エージェント分析',
    'cli.stats.messages': '処理済みメッセージ',
    'cli.stats.avgTime': '平均応答時間',
    'cli.stats.errors': 'エラー数',
    'cli.stats.uptime': '稼働時間',
    'cli.chat.welcome': 'エージェントとチャットしましょう。"exit"で終了。',
    'cli.dev.watching': 'ファイル変更を監視中...',
    'cli.publish.success': '「{name}」v{version} を公開しました',
    'plugin.loaded': 'プラグイン「{name}」を読み込みました',
    'plugin.error': 'プラグイン「{name}」でエラー: {error}',
    'kb.added': '「{file}」をナレッジベースに追加しました',
    'kb.searchResults': '{count} 件の結果が見つかりました',
    'kb.noResults': '結果が見つかりませんでした',
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
