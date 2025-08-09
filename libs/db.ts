import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import { pinoLogger as logger } from './logger';

dotenv.config();

interface Channel {
  id?: number;
  channelId: string;
  name?: string;
  topic?: string;
  purpose?: string;
  isPrivate?: boolean;
  channelSummary?: string;
  channelEmbedding?: number[];
  messageCount?: number;
  participantCount?: number;
  lastActivityAt?: Date;
}

interface Thread {
  id?: number;
  channelId: string;
  threadTs: string;
  rootUserId?: string;
  rootUsername?: string;
  rootMessage?: string;
  threadSummary?: string;
  threadEmbedding?: number[];
  replyCount?: number;
  participantCount?: number;
  lastReplyAt?: Date;
  category?: string;
  status?: 'active' | 'resolved' | 'archived';
}

interface SearchResult {
  type: 'channel' | 'thread';
  similarity: number;
  data: Channel | Thread;
}

class SimpleSlackDB {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'slack_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    logger.info('SimpleSlackDB initialized');
  }

  async initialize(): Promise<void> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      // pgvector 확장 설치
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      
      // 채널 테이블 생성
      await client.query(`
        CREATE TABLE IF NOT EXISTS channels (
          id SERIAL PRIMARY KEY,
          channel_id VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255),
          topic TEXT,
          purpose TEXT,
          is_private BOOLEAN DEFAULT FALSE,
          channel_summary TEXT,
          channel_embedding VECTOR(1536),
          message_count INTEGER DEFAULT 0,
          participant_count INTEGER DEFAULT 0,
          last_activity_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 쓰레드 테이블 생성
      await client.query(`
        CREATE TABLE IF NOT EXISTS threads (
          id SERIAL PRIMARY KEY,
          channel_id VARCHAR(50) NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,
          thread_ts VARCHAR(30) NOT NULL,
          root_user_id VARCHAR(50),
          root_username VARCHAR(255),
          root_message TEXT,
          thread_summary TEXT,
          thread_embedding VECTOR(1536),
          reply_count INTEGER DEFAULT 0,
          participant_count INTEGER DEFAULT 0,
          last_reply_at TIMESTAMP,
          category VARCHAR(100),
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (channel_id, thread_ts)
        )
      `);

      // 인덱스 생성
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_channels_embedding 
        ON channels USING ivfflat (channel_embedding vector_cosine_ops) 
        WITH (lists = 50)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_threads_embedding 
        ON threads USING ivfflat (thread_embedding vector_cosine_ops) 
        WITH (lists = 100)
      `);

      logger.info('SimpleSlackDB: tables and indexes created');
    } finally {
      if (client) client.release();
    }
  }

  // 채널 저장/업데이트
  async upsertChannel(channel: Channel): Promise<number> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      const embeddingString = channel.channelEmbedding 
        ? `[${channel.channelEmbedding.join(',')}]` 
        : null;

      const result = await client.query(`
        INSERT INTO channels (
          channel_id, name, topic, purpose, is_private, 
          channel_summary, channel_embedding, message_count, 
          participant_count, last_activity_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (channel_id) 
        DO UPDATE SET
          name = EXCLUDED.name,
          topic = EXCLUDED.topic,
          purpose = EXCLUDED.purpose,
          is_private = EXCLUDED.is_private,
          channel_summary = EXCLUDED.channel_summary,
          channel_embedding = EXCLUDED.channel_embedding,
          message_count = EXCLUDED.message_count,
          participant_count = EXCLUDED.participant_count,
          last_activity_at = EXCLUDED.last_activity_at,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [
        channel.channelId,
        channel.name || null,
        channel.topic || null,
        channel.purpose || null,
        channel.isPrivate || false,
        channel.channelSummary || null,
        embeddingString,
        channel.messageCount || 0,
        channel.participantCount || 0,
        channel.lastActivityAt || null
      ]);

      return result.rows[0].id;
    } finally {
      if (client) client.release();
    }
  }

  // 쓰레드 저장/업데이트
  async upsertThread(thread: Thread): Promise<number> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      const embeddingString = thread.threadEmbedding 
        ? `[${thread.threadEmbedding.join(',')}]` 
        : null;

      const result = await client.query(`
        INSERT INTO threads (
          channel_id, thread_ts, root_user_id, root_username, root_message,
          thread_summary, thread_embedding, reply_count, participant_count,
          last_reply_at, category, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (channel_id, thread_ts)
        DO UPDATE SET
          root_user_id = EXCLUDED.root_user_id,
          root_username = EXCLUDED.root_username,
          root_message = EXCLUDED.root_message,
          thread_summary = EXCLUDED.thread_summary,
          thread_embedding = EXCLUDED.thread_embedding,
          reply_count = EXCLUDED.reply_count,
          participant_count = EXCLUDED.participant_count,
          last_reply_at = EXCLUDED.last_reply_at,
          category = EXCLUDED.category,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [
        thread.channelId,
        thread.threadTs,
        thread.rootUserId || null,
        thread.rootUsername || null,
        thread.rootMessage || null,
        thread.threadSummary || null,
        embeddingString,
        thread.replyCount || 0,
        thread.participantCount || 0,
        thread.lastReplyAt || null,
        thread.category || null,
        thread.status || 'active'
      ]);

      return result.rows[0].id;
    } finally {
      if (client) client.release();
    }
  }

  // 채널에서 검색
  async searchChannels(
    queryEmbedding: number[], 
    limit = 5,
    similarityThreshold = 0.3
  ): Promise<SearchResult[]> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      const result = await client.query(`
        SELECT *, 1 - (channel_embedding <=> $1::vector) as similarity
        FROM channels
        WHERE channel_embedding IS NOT NULL
        AND 1 - (channel_embedding <=> $1::vector) > $2
        ORDER BY channel_embedding <=> $1::vector
        LIMIT $3
      `, [`[${queryEmbedding.join(',')}]`, similarityThreshold, limit]);

      return result.rows.map(row => ({
        type: 'channel' as const,
        similarity: row.similarity,
        data: {
          id: row.id,
          channelId: row.channel_id,
          name: row.name,
          topic: row.topic,
          purpose: row.purpose,
          isPrivate: row.is_private,
          channelSummary: row.channel_summary,
          messageCount: row.message_count,
          participantCount: row.participant_count,
          lastActivityAt: row.last_activity_at
        }
      }));
    } finally {
      if (client) client.release();
    }
  }

  // 쓰레드에서 검색
  async searchThreads(
    queryEmbedding: number[], 
    channelId?: string,
    limit = 10,
    similarityThreshold = 0.3
  ): Promise<SearchResult[]> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      let query = `
        SELECT *, 1 - (thread_embedding <=> $1::vector) as similarity
        FROM threads
        WHERE thread_embedding IS NOT NULL
        AND 1 - (thread_embedding <=> $1::vector) > $2
      `;
      
      const params: any[] = [`[${queryEmbedding.join(',')}]`, similarityThreshold];
      
      if (channelId) {
        query += ` AND channel_id = $3`;
        params.push(channelId);
        query += ` ORDER BY thread_embedding <=> $1::vector LIMIT $4`;
        params.push(limit);
      } else {
        query += ` ORDER BY thread_embedding <=> $1::vector LIMIT $3`;
        params.push(limit);
      }

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        type: 'thread' as const,
        similarity: row.similarity,
        data: {
          id: row.id,
          channelId: row.channel_id,
          threadTs: row.thread_ts,
          rootUserId: row.root_user_id,
          rootUsername: row.root_username,
          rootMessage: row.root_message,
          threadSummary: row.thread_summary,
          replyCount: row.reply_count,
          participantCount: row.participant_count,
          lastReplyAt: row.last_reply_at,
          category: row.category,
          status: row.status
        }
      }));
    } finally {
      if (client) client.release();
    }
  }

  // 통합 검색 (채널 + 쓰레드)
  async searchAll(
    queryEmbedding: number[], 
    limit = 15
  ): Promise<SearchResult[]> {
    const [channelResults, threadResults] = await Promise.all([
      this.searchChannels(queryEmbedding, Math.floor(limit * 0.3)),
      this.searchThreads(queryEmbedding, undefined, Math.floor(limit * 0.7))
    ]);

    return [...channelResults, ...threadResults]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // 특정 쓰레드 조회
  async getThread(channelId: string, threadTs: string): Promise<Thread | null> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      const result = await client.query(
        'SELECT * FROM threads WHERE channel_id = $1 AND thread_ts = $2',
        [channelId, threadTs]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        channelId: row.channel_id,
        threadTs: row.thread_ts,
        rootUserId: row.root_user_id,
        rootUsername: row.root_username,
        rootMessage: row.root_message,
        threadSummary: row.thread_summary,
        replyCount: row.reply_count,
        participantCount: row.participant_count,
        lastReplyAt: row.last_reply_at,
        category: row.category,
        status: row.status
      };
    } finally {
      if (client) client.release();
    }
  }

  // 쓰레드 임베딩 존재 여부 확인
  async hasThreadEmbedding(channelId: string, threadTs: string): Promise<boolean> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      const result = await client.query(
        'SELECT thread_embedding FROM threads WHERE channel_id = $1 AND thread_ts = $2 AND thread_embedding IS NOT NULL',
        [channelId, threadTs]
      );

      return result.rows.length > 0;
    } finally {
      if (client) client.release();
    }
  }

  // 채널 임베딩 존재 여부 확인
  async hasChannelEmbedding(channelId: string): Promise<boolean> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      const result = await client.query(
        'SELECT channel_embedding FROM channels WHERE channel_id = $1 AND channel_embedding IS NOT NULL',
        [channelId]
      );

      return result.rows.length > 0;
    } finally {
      if (client) client.release();
    }
  }

  // 특정 채널 조회
  async getChannel(channelId: string): Promise<Channel | null> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      const result = await client.query(
        'SELECT * FROM channels WHERE channel_id = $1',
        [channelId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        channelId: row.channel_id,
        name: row.name,
        topic: row.topic,
        purpose: row.purpose,
        isPrivate: row.is_private,
        channelSummary: row.channel_summary,
        messageCount: row.message_count,
        participantCount: row.participant_count,
        lastActivityAt: row.last_activity_at
      };
    } finally {
      if (client) client.release();
    }
  }

  // 통계
  async getStats(): Promise<{
    totalChannels: number;
    channelsWithEmbedding: number;
    totalThreads: number;
    threadsWithEmbedding: number;
    threadsByCategory: Record<string, number>;
  }> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      
      const [channelCount, channelEmbedding, threadCount, threadEmbedding, categories] = await Promise.all([
        client.query('SELECT COUNT(*) as count FROM channels'),
        client.query('SELECT COUNT(*) as count FROM channels WHERE channel_embedding IS NOT NULL'),
        client.query('SELECT COUNT(*) as count FROM threads'),
        client.query('SELECT COUNT(*) as count FROM threads WHERE thread_embedding IS NOT NULL'),
        client.query('SELECT category, COUNT(*) as count FROM threads WHERE category IS NOT NULL GROUP BY category')
      ]);

      const threadsByCategory: Record<string, number> = {};
      categories.rows.forEach(row => {
        threadsByCategory[row.category] = parseInt(row.count, 10);
      });

      return {
        totalChannels: parseInt(channelCount.rows[0].count, 10),
        channelsWithEmbedding: parseInt(channelEmbedding.rows[0].count, 10),
        totalThreads: parseInt(threadCount.rows[0].count, 10),
        threadsWithEmbedding: parseInt(threadEmbedding.rows[0].count, 10),
        threadsByCategory
      };
    } finally {
      if (client) client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

const simpleDb = new SimpleSlackDB();
export default simpleDb;
export { Channel, Thread, SearchResult };
