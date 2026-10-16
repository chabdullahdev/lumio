/**
 * Sample mode data API.
 *
 * Implements the same LumioApi contract as the live Supabase API, but against
 * the bundled sample library and a small local store (AsyncStorage). It exists
 * so the whole journey — onboarding, queue, reading, completion, streak — can
 * be used before the generation pipeline has produced real lessons.
 *
 * The UI clearly labels everything from this API as sample content. Sample mode
 * enforces the same product rules as the backend:
 * - at most 3 upcoming lessons, no duplicates;
 * - completion updates streak and covered concepts;
 * - the queue is replenished after completion.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceTimezone, localDateString, nextStreak } from '../lib/dates';
import { SAMPLE_LESSONS, SAMPLE_LESSON_META, SAMPLE_TOPICS } from './sample-lessons';
import type {
  CompletionSummary,
  HomeSnapshot,
  LessonContent,
  LessonSummary,
  LumioApi,
  ProfileSnapshot,
  QueueItem,
  QueueStatus,
  Streak,
  Topic,
} from './types';

const STORE_KEY = 'lumio.sample.v1';
const QUEUE_TARGET = 3;

type StoredQueueItem = { lessonId: string; position: 1 | 2 | 3; status: QueueStatus };

type StoredProgress = {
  furthestBlockIndex: number;
  startedAt: string | null;
  completedAt: string | null;
};

type SampleDb = {
  onboarded: boolean;
  interestIds: string[];
  displayName: string | null;
  remindersEnabled: boolean;
  queue: StoredQueueItem[];
  progress: Record<string, StoredProgress>;
  activity: Record<string, number>;
  streak: Streak;
};

const EMPTY_DB: SampleDb = {
  onboarded: false,
  interestIds: [],
  displayName: null,
  remindersEnabled: true,
  queue: [],
  progress: {},
  activity: {},
  streak: { current: 0, longest: 0, lastCompletedOn: null },
};

async function loadDb(): Promise<SampleDb> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) {
      return { ...EMPTY_DB };
    }
    const parsed = JSON.parse(raw) as Partial<SampleDb>;
    return {
      ...EMPTY_DB,
      ...parsed,
      streak: { ...EMPTY_DB.streak, ...(parsed.streak ?? {}) },
    };
  } catch {
    // A corrupted local store should not brick the app; start over.
    return { ...EMPTY_DB };
  }
}

async function saveDb(db: SampleDb): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(db));
}

export function sampleLessonSummary(lesson: LessonContent): LessonSummary {
  return {
    id: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    categoryName: lesson.categoryName,
    estimatedMinutes: lesson.estimatedMinutes,
    isSample: lesson.isSample,
  };
}

function isCompleted(db: SampleDb, lessonId: string): boolean {
  return Boolean(db.progress[lessonId]?.completedAt);
}

/** Lessons matching the user's interests that are neither queued nor completed. */
function refillCandidates(db: SampleDb): string[] {
  const queued = new Set(db.queue.map(item => item.lessonId));
  const completedByTopic: Record<string, number> = {};
  for (const [lessonId, progress] of Object.entries(db.progress)) {
    if (!progress.completedAt) {
      continue;
    }
    const topicId = SAMPLE_LESSON_META[lessonId]?.topicId;
    if (topicId) {
      completedByTopic[topicId] = (completedByTopic[topicId] ?? 0) + 1;
    }
  }
  return SAMPLE_LESSONS.filter(
    lesson =>
      db.interestIds.includes(SAMPLE_LESSON_META[lesson.id]?.topicId ?? '') &&
      !queued.has(lesson.id) &&
      !isCompleted(db, lesson.id),
  )
    .sort((a, b) => {
      const topicA = SAMPLE_LESSON_META[a.id]?.topicId ?? '';
      const topicB = SAMPLE_LESSON_META[b.id]?.topicId ?? '';
      const byFewestRead = (completedByTopic[topicA] ?? 0) - (completedByTopic[topicB] ?? 0);
      return byFewestRead !== 0 ? byFewestRead : a.id.localeCompare(b.id);
    })
    .map(lesson => lesson.id);
}

/** Fill free queue positions up to three, in position order. */
function replenish(db: SampleDb): SampleDb {
  const queue = [...db.queue];
  for (let position = 1; position <= QUEUE_TARGET; position++) {
    if (queue.some(item => item.position === position)) {
      continue;
    }
    const [next, ...rest] = refillCandidates({ ...db, queue });
    if (!next) {
      break;
    }
    queue.push({ lessonId: next, position: position as 1 | 2 | 3, status: 'pending' });
    rest;
  }
  return { ...db, queue };
}

/** Drop queued lessons that no longer match the user's interests. */
function pruneQueue(db: SampleDb): SampleDb {
  const queue = db.queue.filter(item =>
    db.interestIds.includes(SAMPLE_LESSON_META[item.lessonId]?.topicId ?? ''),
  );
  return { ...db, queue };
}

function toQueueItems(db: SampleDb): QueueItem[] {
  return [...db.queue]
    .sort((a, b) => a.position - b.position)
    .map((item): QueueItem | null => {
      const lesson = SAMPLE_LESSONS.find(l => l.id === item.lessonId);
      return lesson
        ? {
            queueId: `sample:${item.lessonId}`,
            position: item.position,
            status: item.status,
            lesson: sampleLessonSummary(lesson),
          }
        : null;
    })
    .filter((item): item is QueueItem => item !== null);
}

function completedCount(db: SampleDb): number {
  return Object.values(db.progress).filter(p => p.completedAt).length;
}

function conceptsCovered(db: SampleDb): number {
  return Object.entries(db.progress)
    .filter(([, p]) => p.completedAt)
    .reduce((total, [lessonId]) => total + (SAMPLE_LESSON_META[lessonId]?.concepts.length ?? 0), 0);
}

function recentActivity(db: SampleDb, days: number): { date: string; lessons: number }[] {
  const today = localDateString(new Date(), deviceTimezone());
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
    date.setUTCDate(date.getUTCDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates.map(date => ({ date, lessons: db.activity[date] ?? 0 }));
}

async function getTopics(): Promise<Topic[]> {
  return SAMPLE_TOPICS;
}

export const sampleApi: LumioApi = {
  mode: 'sample',

  getTopics,

  async getProfile(): Promise<ProfileSnapshot> {
    const db = await loadDb();
    return {
      email: null,
      displayName: db.displayName,
      timezone: deviceTimezone(),
      remindersEnabled: db.remindersEnabled,
      interests: SAMPLE_TOPICS.filter(topic => db.interestIds.includes(topic.id)),
      streak: db.streak,
      lessonsCompleted: completedCount(db),
      conceptsCovered: conceptsCovered(db),
      activity: recentActivity(db, 14),
    };
  },

  async completeOnboarding(topicIds: string[]): Promise<void> {
    const db = await loadDb();
    const interestIds = topicIds.filter(id => SAMPLE_TOPICS.some(topic => topic.id === id));
    if (interestIds.length === 0) {
      throw new Error('Choose at least one topic to continue.');
    }
    await saveDb(replenish({ ...db, onboarded: true, interestIds }));
  },

  async updateInterests(topicIds: string[]): Promise<void> {
    const db = await loadDb();
    const interestIds = topicIds.filter(id => SAMPLE_TOPICS.some(topic => topic.id === id));
    if (interestIds.length === 0) {
      throw new Error('Keep at least one topic.');
    }
    await saveDb(replenish(pruneQueue({ ...db, interestIds })));
  },

  async updateSettings(patch): Promise<void> {
    const db = await loadDb();
    await saveDb({
      ...db,
      displayName: patch.displayName !== undefined ? patch.displayName : db.displayName,
      remindersEnabled:
        patch.remindersEnabled !== undefined ? patch.remindersEnabled : db.remindersEnabled,
    });
  },

  async getHome(): Promise<HomeSnapshot> {
    const db = await loadDb();
    const items = toQueueItems(db);
    const exhausted = items.length < QUEUE_TARGET && refillCandidates(db).length === 0;
    return {
      next: items[0] ?? null,
      upcoming: items.slice(1),
      streak: db.streak,
      lessonsCompleted: completedCount(db),
      sampleLibraryExhausted: exhausted,
    };
  },

  async getLesson(lessonId: string): Promise<LessonContent> {
    const lesson = SAMPLE_LESSONS.find(l => l.id === lessonId);
    if (!lesson) {
      throw new Error('Lesson not found.');
    }
    return lesson;
  },

  async markOpened(lessonId: string): Promise<void> {
    const db = await loadDb();
    const progress = db.progress[lessonId] ?? {
      furthestBlockIndex: 0,
      startedAt: null,
      completedAt: null,
    };
    await saveDb({
      ...db,
      progress: {
        ...db.progress,
        [lessonId]: { ...progress, startedAt: progress.startedAt ?? new Date().toISOString() },
      },
      queue: db.queue.map(item =>
        item.lessonId === lessonId && item.status === 'pending'
          ? { ...item, status: 'active' as QueueStatus }
          : item,
      ),
    });
  },

  async saveProgress(lessonId: string, blockIndex: number): Promise<void> {
    const db = await loadDb();
    const progress = db.progress[lessonId] ?? {
      furthestBlockIndex: 0,
      startedAt: null,
      completedAt: null,
    };
    await saveDb({
      ...db,
      progress: {
        ...db.progress,
        [lessonId]: {
          ...progress,
          furthestBlockIndex: Math.max(progress.furthestBlockIndex, blockIndex),
        },
      },
    });
  },

  async completeLesson(lessonId: string): Promise<CompletionSummary> {
    const lesson = SAMPLE_LESSONS.find(l => l.id === lessonId);
    if (!lesson) {
      throw new Error('Lesson not found.');
    }
    let db = await loadDb();
    const progress = db.progress[lessonId] ?? {
      furthestBlockIndex: 0,
      startedAt: null,
      completedAt: null,
    };

    if (!progress.completedAt) {
      const today = localDateString(new Date(), deviceTimezone());
      db = {
        ...db,
        progress: {
          ...db.progress,
          [lessonId]: { ...progress, completedAt: new Date().toISOString() },
        },
        activity: { ...db.activity, [today]: (db.activity[today] ?? 0) + 1 },
        streak: nextStreak(db.streak, today),
      };
    }

    // Completion removes the lesson from the upcoming queue; replenish keeps
    // three prepared whenever the sample library still has suitable lessons.
    db = replenish({ ...db, queue: db.queue.filter(item => item.lessonId !== lessonId) });
    await saveDb(db);

    const items = toQueueItems(db);
    return {
      streak: db.streak,
      lessonsCompleted: completedCount(db),
      nextLesson: items[0]?.lesson ?? null,
    };
  },
};
