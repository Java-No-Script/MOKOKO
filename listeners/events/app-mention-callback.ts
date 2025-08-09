import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';

const appMentionCallback = async ({
  client,
  event,
  logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'app_mention'>) => {
  try {
    // 봇 자신의 메시지는 무시
    if (event.bot_id) {
      console.log('Ignoring bot message');
      return;
    }

    const rootThreadTs = event.thread_ts ?? null;

    // 쓰레드 내 멘션인 경우: 전체 메시지 내용을 합쳐서 응답
    if (rootThreadTs) {
      const fetchAllReplies = async () => {
        const allMessages: any[] = [];
        let cursor: string | undefined;
        // Slack API limit: 200 per page
        do {
          const res: any = await client.conversations.replies({
            channel: event.channel,
            ts: rootThreadTs,
            limit: 200,
            cursor,
          });
          if (Array.isArray(res.messages)) {
            allMessages.push(...res.messages);
          }
          cursor = res.response_metadata?.next_cursor || undefined;
        } while (cursor && cursor.length > 0);
        return allMessages;
      };

      const messages = await fetchAllReplies();

      // 유효한 텍스트만 추출하고 작성자 표시
      const combined = messages
        .filter((m) => typeof m.text === 'string' && m.text.trim().length > 0)
        .map((m) => {
          const author = m.user ? `<@${m.user}>` : m.bot_id ? 'bot' : 'unknown';
          return `- ${author}: ${m.text}`;
        })
        .join('\n');

      const headerText = `쓰레드 전체 내용 (${messages.length}개 메시지):`;

      const MAX_BLOCK_TEXT = 2900; // Slack block section text limit safeguard
      const chunks: string[] = [];
      const textToSend = combined.length > 0 ? combined : '(표시할 텍스트가 없습니다)';
      for (let i = 0; i < textToSend.length; i += MAX_BLOCK_TEXT) {
        chunks.push(textToSend.slice(i, i + MAX_BLOCK_TEXT));
      }

      // 첫 메시지는 헤더와 함께 전송
      const firstBlocks: any[] = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*${headerText}*` },
        },
      ];
      if (chunks[0]) {
        firstBlocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: chunks[0] },
        });
      }
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: rootThreadTs,
        text: `${headerText}\n${chunks[0] ?? ''}`,
        blocks: firstBlocks,
      });

      // 남은 덩어리가 있으면 추가 메시지로 전송
      for (let idx = 1; idx < chunks.length; idx += 1) {
        const moreBlocks: any[] = [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: chunks[idx] },
          },
        ];
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: rootThreadTs,
          text: chunks[idx],
          blocks: moreBlocks,
        });
      }
      return;
    }

    // 일반 채널 멘션: 기본 응답
    await client.chat.postMessage({
      channel: event.channel,
      text: `안녕하세요 <@${event.user}>! 무엇을 도와드릴까요?`,
      thread_ts: event.ts,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `안녕하세요 <@${event.user}>! 무엇을 도와드릴까요?`,
          },
        },
      ],
    });
  } catch (error) {
    console.error('Error handling app mention:', error);
  }
};

export default appMentionCallback;
