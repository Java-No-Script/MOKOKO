import { pinoLogger as logger } from './logger';

class EmbeddingService {
  constructor() {
    logger.info('EmbeddingService initialized (simulation mode)');
  }

  /**
   * 임베딩 생성 (시뮬레이션 모드)
   * 실제 환경에서는 OpenAI, AWS Bedrock 등의 임베딩 서비스를 사용
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      logger.info({
        textLength: text.length,
        textPreview: text.substring(0, 50),
      }, 'Generating embedding (simulation)');

      // 실제 임베딩 대신 null 반환 (임베딩 없음으로 처리)
      logger.info('Embedding generation skipped (simulation mode)');
      return null;

    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length,
      }, 'Failed to generate embedding');
      return null;
    }
  }

  /**
   * 배치 임베딩 생성 (시뮬레이션 모드)
   */
  async generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    logger.info({
      batchSize: texts.length 
    }, 'Generating batch embeddings (simulation)');

    // 모든 텍스트에 대해 null 반환반환
    return texts.map(() => null);
  }

  /**
   * 임베딩 차원 수 반환 (시뮬레이션용)
   */
  getEmbeddingDimension(): number {
    return 1536; // Titan Embeddings v1의 차원 수
  }
}

const embeddingService = new EmbeddingService();
export default embeddingService;