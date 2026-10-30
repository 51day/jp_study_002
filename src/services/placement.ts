import { Language, Word } from '../types';

export const EN_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const JA_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export interface PlacementQuestion {
  word: Word;
  level: string;
  options: string[];
  correctIndex: number;
}

export class PlacementEngine {
  public levels: string[];
  public currentIndex: number;
  public askedCount: number = 0;
  public isDone: boolean = false;
  public resultIndex: number = 0;
  public maxQuestions: number = 10;

  private streak: number = 0;
  private lastCorrect: boolean | null = null;

  constructor(language: Language = 'en') {
    this.levels = language === 'ja' ? JA_LEVELS : EN_LEVELS;
    // Start at middle level
    this.currentIndex = Math.floor((this.levels.length - 1) / 2);
    this.resultIndex = this.currentIndex;
  }

  public get currentLevel(): string {
    return this.levels[this.currentIndex];
  }

  public get resultLevel(): string {
    return this.levels[this.resultIndex];
  }

  public recordAnswer(correct: boolean): void {
    if (this.isDone) return;
    this.askedCount++;

    const sameAsLast = this.lastCorrect !== null && this.lastCorrect === correct;
    this.streak = sameAsLast ? this.streak + 1 : 1;
    this.lastCorrect = correct;

    // 2 consecutive correct answers: advance to higher level
    if (correct && this.streak >= 2) {
      if (this.currentIndex >= this.levels.length - 1) {
        this.finish(this.currentIndex);
      } else {
        this.currentIndex++;
        this.resetStreak();
      }
      return;
    }

    // 2 consecutive incorrect answers: drop down to lower level and conclude
    if (!correct && this.streak >= 2) {
      this.finish(this.currentIndex > 0 ? this.currentIndex - 1 : 0);
      return;
    }

    // Limit reached
    if (this.askedCount >= this.maxQuestions) {
      this.finish(correct ? this.currentIndex : (this.currentIndex > 0 ? this.currentIndex - 1 : 0));
    }
  }

  private finish(levelIndex: number): void {
    this.isDone = true;
    this.resultIndex = Math.max(0, Math.min(this.levels.length - 1, levelIndex));
  }

  private resetStreak(): void {
    this.streak = 0;
    this.lastCorrect = null;
  }
}
