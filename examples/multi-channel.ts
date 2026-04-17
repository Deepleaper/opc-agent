/**
 * OPC Agent Example: Multi-Channel Setup
 *
 * Shows how to configure Web + Telegram channels for an agent.
 * Note: This is a configuration demo — actual channel connections
 * require valid tokens/endpoints.
 *
 * Run: npx tsx examples/multi-channel.ts
 */

import {
  BaseAgent,
  AgentRuntime,
  WebChannel,
  TelegramChannel,
  InMemoryStore,
} from 'opc-agent';

async function main() {
  console.log('🌐 OPC Agent — Multi-Channel Demo\n');

  try {
    const agent = new BaseAgent({
      name: 'multi-channel-agent',
      description: 'Agent that works across multiple channels',
      version: '1.0.0',
    });

    const memory = new InMemoryStore();
    const runtime = new AgentRuntime(agent, { memory });

    // Channel 1: Web (HTTP endpoint)
    const webChannel = new WebChannel({
      port: 3000,
      path: '/chat',
    });
    console.log('📡 Web channel configured: http://localhost:3000/chat');

    // Channel 2: Telegram (requires BOT_TOKEN)
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramToken) {
      const telegramChannel = new TelegramChannel({
        token: telegramToken,
      });
      runtime.addChannel(telegramChannel);
      console.log('📱 Telegram channel configured');
    } else {
      console.log('📱 Telegram: skipped (set TELEGRAM_BOT_TOKEN to enable)');
    }

    // Register web channel
    runtime.addChannel(webChannel);

    console.log('\n✅ Agent configured with channels:');
    console.log('  • Web:      HTTP REST endpoint');
    console.log('  • Telegram: Bot API (optional)');
    console.log('\nAvailable channels in OPC Agent:');
    console.log('  WebChannel, TelegramChannel, WebSocketChannel,');
    console.log('  SlackChannel, DiscordChannel, FeishuChannel,');
    console.log('  EmailChannel, WeChatChannel, VoiceChannel,');
    console.log('  WebhookChannel\n');

    // In production you would call: await runtime.start();
    console.log('💡 To start: await runtime.start()');
  } catch (e: any) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(`\n❌ Error: ${e.message}\n`);
  process.exit(1);
});
