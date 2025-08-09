import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { handleMention } from './simple-mention-handler';

const appMentionCallback = async (args: AllMiddlewareArgs & SlackEventMiddlewareArgs<'app_mention'>) => {
  try {
    const { event } = args;

    // 봇 자신의 메시지는 무시
    if (event.bot_id) {
      console.log('Ignoring bot message');
      return;
    }

    // 통합 멘션 핸들러로 처리
    await handleMention(args);
  } catch (error) {
    console.error('Error handling app mention:', error);
  }
};

export default appMentionCallback;
