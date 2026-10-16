/**
 * LUMIO domain types shared by the data layer (sample and live modes) and the
 * screens. These mirror the Supabase schema so switching a screen from sample
 * data to the real backend never changes the UI contract.
 */

export type Topic = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
};

/** Ordered content blocks rendered by the reader. */
export type LessonBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string; attribution?: string };

export type SourceUsage = 'direct_quote' | 'paraphrase' | 'synthesis';

/** A traceable source reference shown at the end of a lesson. */
export type LessonSourceRef = {
  id: string;
  title: string;
  authorLine: string | null;
  usage: SourceUsage;
  quote: string | null;
  pageLabel: string | null;
  url: string | null;
  licenseLabel: string | null;
};

export type LessonSummary = {
  id: string;
  title: string;
  summary: string | null;
  categoryName: string | null;
  estimatedMinutes: number;
  isSample: boolean;
};

export type LessonContent = LessonSummary & {
  blocks: LessonBlock[];
  takeaways: string[];
  sources: LessonSourceRef[];
};

export type QueueStatus = 'pending' | 'active' | 'completed';

export type QueueItem = {
  /** lesson_queue row id (null in sample mode before it is persisted). */
  queueId: string | null;
  position: 1 | 2 | 3;
  status: QueueStatus;
  lesson: LessonSummary;
};

export type Streak = {
  current: number;
  longest: number;
  /** User-local ISO date (YYYY-MM-DD) of the last completed lesson. */
  lastCompletedOn: string | null;
};

export type HomeSnapshot = {
  /** The recommended lesson (first active/pending queue item). */
  next: QueueItem | null;
  /** The remaining upcoming lessons, in order. */
  upcoming: QueueItem[];
  streak: Streak;
  lessonsCompleted: number;
  sampleLibraryExhausted: boolean;
};

export type ActivityDay = { date: string; lessons: number };

export type ProfileSnapshot = {
  email: string | null;
  displayName: string | null;
  timezone: string;
  remindersEnabled: boolean;
  interests: Topic[];
  streak: Streak;
  lessonsCompleted: number;
  conceptsCovered: number;
  /** Recent reading activity, oldest first. */
  activity: ActivityDay[];
};

export type CompletionSummary = {
  streak: Streak;
  lessonsCompleted: number;
  nextLesson: LessonSummary | null;
};

/**
 * The app-facing data API. `sampleApi` implements it against a bundled
 * placeholder library (clearly labelled in the UI); `supabaseApi` implements
 * it against the real schema with Row Level Security.
 */
export interface LumioApi {
  readonly mode: 'sample' | 'live';

  getTopics(): Promise<Topic[]>;
  getProfile(): Promise<ProfileSnapshot>;
  completeOnboarding(topicIds: string[]): Promise<void>;
  updateInterests(topicIds: string[]): Promise<void>;
  updateSettings(patch: { displayName?: string | null; remindersEnabled?: boolean }): Promise<void>;

  getHome(): Promise<HomeSnapshot>;
  getLesson(lessonId: string): Promise<LessonContent>;
  markOpened(lessonId: string): Promise<void>;
  saveProgress(lessonId: string, blockIndex: number): Promise<void>;
  completeLesson(lessonId: string): Promise<CompletionSummary>;
}
