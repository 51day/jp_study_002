import { Suggestion } from '../types';

export interface SuggestionInputs {
  streak: number;
  dueCount: number;
  recentAccuracy: number | null; // 0..100
  daysSinceLastStudy: number | null;
  dailyReviewLimit: number;
}

export class SuggestionEngine {
  public static build(inputs: SuggestionInputs): Suggestion[] {
    const list: Suggestion[] = [];

    // 1. Long absence -> Comeback half review
    if (inputs.daysSinceLastStudy !== null && inputs.daysSinceLastStudy >= 7) {
      const half = Math.max(10, Math.min(200, Math.floor(inputs.dailyReviewLimit / 2)));
      list.push({
        id: 'comeback',
        iconName: 'comeback',
        title: '欢迎回来！',
        body: `你已休息了 ${inputs.daysSinceLastStudy} 天。建议先将每日复习上限调至 ${half} 个，轻松找回学习节奏。`,
        actionLabel: `复习减半 (${half})`,
        actionType: 'half_review',
      });
    }

    // 2. Large backlog -> Clear due cards
    if (inputs.dueCount > 20) {
      list.push({
        id: 'clear-reviews',
        iconName: 'clear',
        title: '复习积压了',
        body: `当前有 ${inputs.dueCount} 个单词亟需巩固！先清空复习队列，记忆更牢固。`,
        actionLabel: '立即开始复习',
        actionType: 'start_study',
      });
    }

    // 3. High streak & accuracy -> Scale up
    if (inputs.streak >= 5 && inputs.recentAccuracy !== null && inputs.recentAccuracy >= 85) {
      list.push({
        id: 'scale-up',
        iconName: 'scale',
        title: '状态渐入佳境',
        body: `连续 ${inputs.streak} 天打卡，近期正确率 ${Math.round(inputs.recentAccuracy)}%，学习势头强劲，建议新词 +5！`,
        actionLabel: '新词配额 +5',
        actionType: 'add_quota',
      });
    }

    return list.slice(0, 2);
  }
}
