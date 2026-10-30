/**
 * FSRS (Free Spaced Repetition Scheduler) v5 Implementation
 * 科学记忆算法核心：纯计算模块，无外部依赖
 */
import { FSRSRating, FSRSState, WordProgress } from '../types';

// Default FSRS-5 parameters
const DEFAULT_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 0.22695, 0.5698, 2.85535,
];

const DESIRED_RETENTION = 0.90; // 90% target retention

export class FsrsService {
  private w = DEFAULT_WEIGHTS;

  /**
   * Calculate initial stability for a new card based on first rating
   */
  private initStability(rating: FSRSRating): number {
    return Math.max(0.1, this.w[rating - 1]);
  }

  /**
   * Calculate initial difficulty for a new card based on first rating
   */
  private initDifficulty(rating: FSRSRating): number {
    const d = this.w[4] - Math.exp(this.w[5] * (rating - 1)) + 1;
    return Math.min(10, Math.max(1, d));
  }

  /**
   * Calculate next stability after successful recall
   */
  private nextRecallStability(d: number, s: number, r: number, rating: FSRSRating): number {
    const hardPenalty = rating === 2 ? this.w[15] : 1;
    const easyBonus = rating === 4 ? this.w[16] : 1;
    const nextS = s * (1 + Math.exp(this.w[8]) *
      (11 - d) *
      Math.pow(s, -this.w[9]) *
      (Math.exp((1 - r) * this.w[10]) - 1) *
      hardPenalty *
      easyBonus);
    return Math.max(0.1, nextS);
  }

  /**
   * Calculate next stability after forgetting (Again rating)
   */
  private nextForgetStability(d: number, s: number, r: number): number {
    const nextS = this.w[11] *
      Math.pow(d, -this.w[12]) *
      (Math.pow(s + 1, this.w[13]) - 1) *
      Math.exp((1 - r) * this.w[14]);
    return Math.max(0.1, Math.min(s, nextS));
  }

  /**
   * Calculate updated difficulty
   */
  private nextDifficulty(d: number, rating: FSRSRating): number {
    const delta = -this.w[6] * (rating - 3);
    const raw = d + delta;
    // Mean reversion
    const nextD = this.w[7] * this.initDifficulty(3) + (1 - this.w[7]) * raw;
    return Math.min(10, Math.max(1, nextD));
  }

  /**
   * Current retrievability R(t, S)
   */
  public getRetrievability(progress: WordProgress, nowMs: number = Date.now()): number {
    if (!progress.lastReviewAt) return 1.0;
    const elapsedDays = Math.max(0, (nowMs - progress.lastReviewAt) / (1000 * 60 * 60 * 24));
    return Math.pow(1 + 0.19 * (elapsedDays / progress.stability), -0.5);
  }

  /**
   * Convert stability to scheduled days for desired retention (90%)
   */
  public stabilityToInterval(stability: number): number {
    const interval = (stability / 0.19) * (Math.pow(DESIRED_RETENTION, -2) - 1);
    return Math.max(1, Math.round(interval));
  }

  /**
   * Format human readable interval preview for UI buttons (e.g., "10分钟", "1天", "4天")
   */
  public getIntervalPreview(progress: WordProgress | null, rating: FSRSRating): string {
    if (!progress || progress.state === 0) {
      if (rating === 1) return '1分钟';
      if (rating === 2) return '10分钟';
      if (rating === 3) return '1天';
      return '3天';
    }

    const { nextProgress } = this.review(progress, rating);
    const days = nextProgress.scheduledDays;
    if (days <= 0) return '10分钟';
    if (days === 1) return '1天';
    if (days < 30) return `${days}天`;
    if (days < 365) return `${Math.round(days / 30)}个月`;
    return `${(days / 365).toFixed(1)}年`;
  }

  /**
   * Perform an FSRS review calculation on a word progress record
   */
  public review(
    previous: WordProgress | null,
    rating: FSRSRating,
    nowMs: number = Date.now()
  ): { nextProgress: WordProgress } {
    if (!previous) {
      // First review (New Card)
      const stability = this.initStability(rating);
      const difficulty = this.initDifficulty(rating);
      const isLearning = rating < 3;
      const state: FSRSState = isLearning ? 0 : 1;
      const scheduledDays = isLearning ? 0 : this.stabilityToInterval(stability);
      const due = isLearning
        ? nowMs + (rating === 1 ? 60 * 1000 : 10 * 60 * 1000)
        : nowMs + scheduledDays * 24 * 60 * 60 * 1000;

      const nextProgress: WordProgress = {
        id: crypto.randomUUID ? crypto.randomUUID() : `wp_${Date.now()}_${Math.random()}`,
        wordId: '',
        language: 'en',
        state,
        due,
        stability,
        difficulty,
        step: isLearning ? 1 : 0,
        elapsedDays: 0,
        scheduledDays,
        reps: 1,
        lapses: rating === 1 ? 1 : 0,
        lastReviewAt: nowMs,
        updatedAt: nowMs,
      };
      return { nextProgress };
    }

    const nowDays = Math.max(0, (nowMs - (previous.lastReviewAt || nowMs)) / (1000 * 60 * 60 * 24));
    const r = this.getRetrievability(previous, nowMs);

    let nextS = previous.stability;
    let nextD = this.nextDifficulty(previous.difficulty, rating);
    let nextState: FSRSState = previous.state;
    let nextLapses = previous.lapses;
    let scheduledDays = 0;
    let nextStep = previous.step;

    if (previous.state === 0) {
      // In Learning stage
      if (rating === 1) {
        nextStep = 1;
        nextS = this.initStability(1);
      } else if (rating === 2) {
        nextStep += 1;
        nextS = this.initStability(2);
      } else {
        // Graduate to Review
        nextState = 1;
        nextS = this.initStability(rating);
        scheduledDays = this.stabilityToInterval(nextS);
      }
    } else {
      // In Review or Relearning
      if (rating === 1) {
        nextState = 2; // Relearning
        nextLapses += 1;
        nextS = this.nextForgetStability(nextD, previous.stability, r);
        scheduledDays = 0;
      } else {
        nextState = 1; // Review
        nextS = this.nextRecallStability(nextD, previous.stability, r, rating);
        scheduledDays = this.stabilityToInterval(nextS);
      }
    }

    const due = scheduledDays === 0
      ? nowMs + (rating === 1 ? 60 * 1000 : 10 * 60 * 1000)
      : nowMs + scheduledDays * 24 * 60 * 60 * 1000;

    const nextProgress: WordProgress = {
      ...previous,
      state: nextState,
      due,
      stability: Number(nextS.toFixed(4)),
      difficulty: Number(nextD.toFixed(4)),
      step: nextStep,
      elapsedDays: Math.round(nowDays),
      scheduledDays,
      reps: previous.reps + 1,
      lapses: nextLapses,
      lastReviewAt: nowMs,
      updatedAt: nowMs,
    };

    return { nextProgress };
  }
}

export const fsrs = new FsrsService();
