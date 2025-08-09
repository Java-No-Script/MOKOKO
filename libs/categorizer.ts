export const THREAD_CATEGORIES = [
  'HR',
  'IT Support',
  'Engineering',
  'DevOps/Release',
  'Bug',
  'Feature Request',
  'Product/Design',
  'Sales/Marketing',
  'Operations/Admin',
  'General',
] as const;

export type ThreadCategory = typeof THREAD_CATEGORIES[number];

const KEYWORDS: Record<ThreadCategory, string[]> = {
  HR: [
    '휴가', '연차', '병가', '채용', '복지', '인사', '급여', '근태', '퇴사', '입사', '평가',
  ],
  'IT Support': [
    '장애', '오류', '접속', '로그인', '네트워크', 'vpn', '프린터', '메일', '권한', '계정', '지원',
  ],
  Engineering: [
    '코드', '리팩토링', '리뷰', '테스트', 'typescript', 'node', 'api', '패키지', '성능', '최적화', '알고리즘',
  ],
  'DevOps/Release': [
    '배포', '릴리즈', '쿠버네티스', 'kubernetes', 'helm', 'docker', '도커', 'ci', 'cd', '파이프라인', '모니터링', '알람',
  ],
  Bug: [
    '버그', '에러', 'exception', 'stack', 'trace', '핫픽스', 'hotfix', '이슈', 'crash', 'fail', '고장',
  ],
  'Feature Request': [
    '기능', '요청', '제안', '개선', '추가', 'feature', 'requirement', '요구사항', 'roadmap',
  ],
  'Product/Design': [
    '기획', '제품', '디자인', 'ux', 'ui', '프로토타입', '사용성', '와이어프레임', '리서치', '스토리보드',
  ],
  'Sales/Marketing': [
    '세일즈', '영업', '마케팅', '캠페인', '광고', '리드', 'crm', 'conversion', '전환', '브랜딩',
  ],
  'Operations/Admin': [
    '운영', '관리', '정책', '프로세스', '정산', '구매', '비용', '자산', '보안', '컴플라이언스',
  ],
  General: [
    '공지', '안내', '질문', '문의', '회의', '스케줄', '잡담', '일반', '공지사항', '공유',
  ],
};

export function classifyThread(text: string): ThreadCategory {
  const normalized = text.toLowerCase();
  let best: { cat: ThreadCategory; score: number } = { cat: 'General', score: 0 };

  for (const cat of THREAD_CATEGORIES) {
    const keywords = KEYWORDS[cat];
    let score = 0;
    for (const kw of keywords) {
      const needle = kw.toLowerCase();
      if (normalized.includes(needle)) score += 1;
    }
    if (score > best.score) best = { cat, score };
  }

  return best.cat;
}


