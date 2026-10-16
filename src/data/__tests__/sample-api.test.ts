/**
 * Sample-mode journey tests: onboarding, the three-lesson queue invariant,
 * completion, idempotency and interest changes — the same product rules the
 * backend enforces for live accounts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sampleApi } from '../sample-api';
import { SAMPLE_LESSONS, SAMPLE_TOPICS } from '../sample-lessons';

const THREE_TOPICS = SAMPLE_TOPICS.slice(0, 3).map(topic => topic.id);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('onboarding and the queue', () => {
  test('requires at least one topic', async () => {
    await expect(sampleApi.completeOnboarding([])).rejects.toThrow(/at least one topic/i);
  });

  test('fills exactly three unique upcoming lessons for the chosen topics', async () => {
    await sampleApi.completeOnboarding(THREE_TOPICS);
    const home = await sampleApi.getHome();

    expect(home.lessonsCompleted).toBe(0);
    expect(home.next).not.toBeNull();
    const all = [home.next!, ...home.upcoming];
    expect(all).toHaveLength(3);
    expect(new Set(all.map(item => item.lesson.id)).size).toBe(3);
    expect(all.map(item => item.position)).toEqual([1, 2, 3]);

    const topicIds = new Set(
      all.map(item =>
        SAMPLE_LESSONS.find(lesson => lesson.id === item.lesson.id)?.categoryName,
      ),
    );
    const chosenNames = new Set(
      SAMPLE_TOPICS.filter(topic => THREE_TOPICS.includes(topic.id)).map(topic => topic.name),
    );
    for (const name of topicIds) {
      expect(chosenNames.has(name ?? '')).toBe(true);
    }
  });

  test('replenishes the queue after a completion when lessons remain', async () => {
    await sampleApi.completeOnboarding(SAMPLE_TOPICS.map(topic => topic.id));
    const before = await sampleApi.getHome();
    const firstLessonId = before.next!.lesson.id;

    await sampleApi.completeLesson(firstLessonId);
    const after = await sampleApi.getHome();

    expect(after.lessonsCompleted).toBe(1);
    const all = [after.next!, ...after.upcoming];
    expect(all).toHaveLength(3);
    expect(all.map(item => item.lesson.id)).not.toContain(firstLessonId);
    expect(new Set(all.map(item => item.lesson.id)).size).toBe(3);
  });
});

describe('completion', () => {
  test('starts the streak, records activity and is idempotent', async () => {
    await sampleApi.completeOnboarding(THREE_TOPICS);
    const home = await sampleApi.getHome();
    const lessonId = home.next!.lesson.id;

    const first = await sampleApi.completeLesson(lessonId);
    expect(first.streak.current).toBe(1);
    expect(first.streak.longest).toBe(1);
    expect(first.streak.lastCompletedOn).not.toBeNull();
    expect(first.lessonsCompleted).toBe(1);

    const second = await sampleApi.completeLesson(lessonId);
    expect(second.lessonsCompleted).toBe(1);
    expect(second.streak.current).toBe(1);

    const profile = await sampleApi.getProfile();
    expect(profile.activity.reduce((total, day) => total + day.lessons, 0)).toBe(1);
  });

  test('counts covered concepts from the completed lesson', async () => {
    await sampleApi.completeOnboarding(THREE_TOPICS);
    const home = await sampleApi.getHome();
    await sampleApi.completeLesson(home.next!.lesson.id);
    const profile = await sampleApi.getProfile();
    expect(profile.conceptsCovered).toBeGreaterThan(0);
  });
});

describe('interest changes', () => {
  test('prunes queued lessons from removed topics and refills from new ones', async () => {
    const firstThree = SAMPLE_TOPICS.slice(0, 3).map(topic => topic.id);
    const otherThree = SAMPLE_TOPICS.slice(3).map(topic => topic.id);
    await sampleApi.completeOnboarding(firstThree);

    await sampleApi.updateInterests(otherThree);
    const home = await sampleApi.getHome();
    const allowedNames = new Set(
      SAMPLE_TOPICS.filter(topic => otherThree.includes(topic.id)).map(topic => topic.name),
    );

    for (const item of [home.next, ...home.upcoming]) {
      if (item) {
        expect(allowedNames.has(item.lesson.categoryName ?? '')).toBe(true);
      }
    }
  });
});

describe('reading progress', () => {
  test('tracks the furthest block read and survives reopening', async () => {
    await sampleApi.completeOnboarding(THREE_TOPICS);
    const home = await sampleApi.getHome();
    const lessonId = home.next!.lesson.id;

    await sampleApi.markOpened(lessonId);
    await sampleApi.saveProgress(lessonId, 4);
    // Progress must never move backwards.
    await sampleApi.saveProgress(lessonId, 2);

    const stored = JSON.parse((await AsyncStorage.getItem('lumio.sample.v1')) ?? '{}') as {
      progress?: Record<string, { furthestBlockIndex?: number }>;
    };
    expect(stored.progress?.[lessonId]?.furthestBlockIndex).toBe(4);

    const homeAfterOpen = await sampleApi.getHome();
    expect(homeAfterOpen.next?.status).toBe('active');
  });
});
