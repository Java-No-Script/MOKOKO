import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { pinoLogger as logger } from '../../libs/logger';
import simpleDb from '../../libs/db';
import embeddingService from '../../libs/embedding';
import { classifyThread } from '../../libs/categorizer';

// 채널 정보 수집 함수
async function collectChannelInfo(client: any, channelId: string) {
  try {
    const [channelInfo, channelHistory] = await Promise.all([
      client.conversations.info({ channel: channelId }),
      client.conversations.history({ 
        channel: channelId, 
        limit: 100,
        include_all_metadata: true 
      })
    ]);

    const channel = channelInfo.channel;
    const messages = channelHistory.messages || [];
    
    // 참여자 수집
    const participants = new Set<string>();
    messages.forEach((msg: any) => {
      if (msg.user) participants.add(msg.user);
    });

    // 채널 요약 텍스트 생성
    const summaryText = [
      `채널명: ${channel.name || '알 수 없음'}`,
      channel.topic ? `토픽: ${channel.topic}` : '',
      channel.purpose ? `목적: ${channel.purpose}` : '',
      `메시지 수: ${messages.length}`,
      `참여자 수: ${participants.size}`,
      '최근 메시지들:',
      ...messages.slice(0, 10).map((msg: any) => 
        `- ${msg.text || '[첨부파일 또는 특수 메시지]'}`
      )
    ].filter(Boolean).join('\n');

    return {
      channelId: channel.id,
      name: channel.name,
      topic: channel.topic,
      purpose: channel.purpose,
      isPrivate: channel.is_private,
      channelSummary: summaryText,
      messageCount: messages.length,
      participantCount: participants.size,
      lastActivityAt: messages[0]?.ts ? new Date(parseFloat(messages[0].ts) * 1000) : new Date()
    };
  } catch (error) {
    logger.error({ error, channelId }, 'Failed to collect channel info');
    throw error;
  }
}

// 쓰레드 정보 수집 함수
async function collectThreadInfo(client: any, channelId: string, threadTs: string) {
  try {
    const threadHistory = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      include_all_metadata: true
    });

    const messages = threadHistory.messages || [];
    const rootMessage = messages[0];
    
    // 참여자 수집
    const participants = new Set<string>();
    messages.forEach((msg: any) => {
      if (msg.user) participants.add(msg.user);
    });

    // 쓰레드 요약 텍스트 생성
    const summaryText = [
      `루트 메시지: ${rootMessage?.text || '[첨부파일 또는 특수 메시지]'}`,
      `답글 수: ${messages.length - 1}`,
      `참여자 수: ${participants.size}`,
      '쓰레드 내용:',
      ...messages.slice(1, 11).map((msg: any) => 
        `- ${msg.text || '[첨부파일 또는 특수 메시지]'}`
      )
    ].filter(Boolean).join('\n');

    // 카테고리 분류
    const category = classifyThread(summaryText);

    return {
      channelId,
      threadTs,
      rootUserId: rootMessage?.user,
      rootUsername: rootMessage?.username || '알 수 없음',
      rootMessage: rootMessage?.text,
      threadSummary: summaryText,
      replyCount: messages.length - 1,
      participantCount: participants.size,
      lastReplyAt: messages[messages.length - 1]?.ts ? 
        new Date(parseFloat(messages[messages.length - 1].ts) * 1000) : new Date(),
      category,
      status: 'active' as const
    };
  } catch (error) {
    logger.error({ error, channelId, threadTs }, 'Failed to collect thread info');
    throw error;
  }
}

export const handleMention = async (args: AllMiddlewareArgs & SlackEventMiddlewareArgs<'app_mention'>) => {
  const { client, event } = args;
  const isThread = !!event.thread_ts;

  try {
    console.log(`\n🤖 멘션 처리 시작 (${isThread ? '쓰레드' : '채널'})`);
    console.log(`📍 Channel: ${event.channel}, Thread: ${event.thread_ts || 'N/A'}`);

    let replyText = '';

    if (isThread) {
      // 쓰레드 임베딩 상태 확인
      const hasThreadEmbedding = await simpleDb.hasThreadEmbedding(event.channel, event.thread_ts!);
      if (hasThreadEmbedding) {
        const threadData = await simpleDb.getThread(event.channel, event.thread_ts!);
        replyText = `✅ 이미 임베딩된 쓰레드입니다!\n📊 메시지 ${threadData?.replyCount || 0}개, 참여자 ${threadData?.participantCount || 0}명`;
      } else {
        // 쓰레드 임베딩 생성
        console.log('🔄 쓰레드 임베딩 생성 중...');
        replyText = `🔄 쓰레드 임베딩을 생성 중입니다. 잠시만 기다려주세요...`;
        
        // 즉시 진행 상황 답장
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts || event.ts,
          text: replyText,
        });

        try {
          // 쓰레드 정보 수집
          const threadInfo = await collectThreadInfo(client, event.channel, event.thread_ts!);
          
          // 임베딩 생성 (시뮬레이션 모드에서는 null 반환)
          const embedding = await embeddingService.generateEmbedding(threadInfo.threadSummary || '');
          
          // DB에 저장
          const threadData = {
            ...threadInfo,
            threadEmbedding: embedding || undefined
          };
          await simpleDb.upsertThread(threadData);
          
          const completionText = `✅ 쓰레드 임베딩 생성 완료!\n📊 메시지 ${threadInfo.replyCount}개, 참여자 ${threadInfo.participantCount}명\n🏷️ 카테고리: ${threadInfo.category || '미분류'}`;
          
          // 완료 메시지 전송
          await client.chat.postMessage({
            channel: event.channel,
            thread_ts: event.thread_ts || event.ts,
            text: completionText,
          });
          
          replyText = completionText; // 로깅용
          
        } catch (embeddingError) {
          logger.error({ error: embeddingError }, 'Failed to create thread embedding');
          const errorText = `❌ 쓰레드 임베딩 생성 중 오류가 발생했습니다.\n다시 시도해주세요.`;
          
          // 오류 메시지 전송
          await client.chat.postMessage({
            channel: event.channel,
            thread_ts: event.thread_ts || event.ts,
            text: errorText,
          });
          
          replyText = errorText; // 로깅용
        }
      }
    } else {
      // 채널 임베딩 상태 확인
      const hasChannelEmbedding = await simpleDb.hasChannelEmbedding(event.channel);
      if (hasChannelEmbedding) {
        const channelData = await simpleDb.getChannel(event.channel);
        replyText = `✅ 이미 임베딩된 채널입니다!\n📋 채널명: ${channelData?.name || '알 수 없음'}`;
      } else {
        // 채널 임베딩 생성
        console.log('🔄 채널 임베딩 생성 중...');
        replyText = `🔄 채널 임베딩을 생성 중입니다. 잠시만 기다려주세요...`;
        
        // 즉시 진행 상황 답장
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts || event.ts,
          text: replyText,
        });

        try {
          // 채널 정보 수집
          const channelInfo = await collectChannelInfo(client, event.channel);
          
          // 임베딩 생성 (시뮬레이션 모드에서는 null 반환)
          const embedding = await embeddingService.generateEmbedding(channelInfo.channelSummary || '');
          
          // DB에 저장
          const channelData = {
            ...channelInfo,
            channelEmbedding: embedding || undefined
          };
          await simpleDb.upsertChannel(channelData);
          
          const completionText = `✅ 채널 임베딩 생성 완료!\n📋 채널명: ${channelInfo.name || '알 수 없음'}\n📊 메시지 ${channelInfo.messageCount}개, 참여자 ${channelInfo.participantCount}명`;
          
          // 완료 메시지 전송
          await client.chat.postMessage({
            channel: event.channel,
            thread_ts: event.thread_ts || event.ts,
            text: completionText,
          });
          
          replyText = completionText; // 로깅용
          
        } catch (embeddingError) {
          logger.error({ error: embeddingError }, 'Failed to create channel embedding');
          const errorText = `❌ 채널 임베딩 생성 중 오류가 발생했습니다.\n다시 시도해주세요.`;
          
          // 오류 메시지 전송
          await client.chat.postMessage({
            channel: event.channel,
            thread_ts: event.thread_ts || event.ts,
            text: errorText,
          });
          
          replyText = errorText; // 로깅용
        }
      }
    }

    // 임베딩 처리 결과 답장 (임베딩 생성이 없었던 경우나 완료 메시지)
    if (!replyText.startsWith('🔄')) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts || event.ts, // 쓰레드가 있으면 쓰레드에, 없으면 새 쓰레드 시작
        text: replyText,
      });
    }

    console.log('✅ 멘션 답장 완료\n');
  } catch (error) {
    logger.error({ error, channel: event.channel }, 'Failed to handle mention');

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: '❌ 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
    });
  }
};


