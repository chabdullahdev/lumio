/**
 * Live data API — the real learning loop against Supabase.
 *
 * Uses the publishable key and the signed-in user's session; every table read
 * or written here is protected by the Row Level Security policies in
 * supabase/migrations. The mobile app never touches service-role operations:
 * queue replenishment and lesson generation are backend jobs.
 *
 * Response shapes are narrowed defensively because jsonb content is user-adjacent
 * data: unknown block types are dropped, missing rows produce readable errors.
 */
import { deviceTimezone, localDateString, addDays } from '../lib/dates';
import { getSupabase } from '../lib/supabase';
import type {
  ActivityDay,
  CompletionSummary,
  HomeSnapshot,
  LessonBlock,
  LessonContent,
  LessonSourceRef,
  LessonSummary,
  LumioApi,
  ProfileSnapshot,
  QueueItem,
  QueueStatus,
  SourceUsage,
  Streak,
  Topic,
} from './types';

const QUEUE_TARGET = 3;

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return typeof value === 'object' && value !== null ? (value as Row) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function unwrap<T>(data: T, error: { message: string } | null, context: string): T {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
  return data;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) {
    throw new Error(`Could not read your session: ${error.message}`);
  }
  const userId = data.session?.user.id;
  if (!userId) {
    throw new Error('You are signed out. Sign in again to continue.');
  }
  return userId;
}

function mapTopic(row: Row): Topic {
  return {
    id: String(row.id),
    name: str(row.name) ?? 'Topic',
    slug: str(row.slug),
    description: str(row.description),
  };
}

const LICENSE_LABELS: Record<string, string> = {
  public_domain: 'Public domain',
  cc_by: 'CC BY',
  cc_by_sa: 'CC BY-SA',
  cc_by_nc: 'CC BY-NC',
  cc_by_nd: 'CC BY-ND',
  permission_granted: 'Used with permission',
  purchased: 'Licensed content',
  unknown: 'Rights under review',
};

const USAGE_VALUES: SourceUsage[] = ['direct_quote', 'paraphrase', 'synthesis'];

function parseBlocks(content: unknown): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  for (const rawBlock of asArray(content)) {
    const block = asRow(rawBlock);
    const text = str(block?.text);
    if (!block || !text) {
      continue;
    }
    if (block.type === 'heading') {
      blocks.push({ type: 'heading', text });
    } else if (block.type === 'paragraph') {
      blocks.push({ type: 'paragraph', text });
    } else if (block.type === 'quote') {
      blocks.push({ type: 'quote', text, attribution: str(block.attribution) ?? undefined });
    }
    // Unknown block types are dropped rather than rendered incorrectly.
  }
  return blocks;
}

function mapLessonSummaryFromRow(row: Row, categoryName: string | null): LessonSummary {
  return {
    id: String(row.id),
    title: str(row.title) ?? 'Untitled lesson',
    summary: str(row.summary),
    categoryName,
    estimatedMinutes: num(row.estimated_minutes) ?? 15,
    isSample: false,
  };
}

function mapQueueItem(row: Row): QueueItem | null {
  const lessonRow = asRow(row.lesson);
  if (!lessonRow) {
    return null;
  }
  const categoryRow = asRow(lessonRow.categories);
  const status = str(row.status);
  const position = num(row.position);
  if (
    status !== 'pending' &&
    status !== 'active' &&
    status !== 'completed'
  ) {
    return null;
  }
  if (position !== 1 && position !== 2 && position !== 3) {
    return null;
  }
  return {
    queueId: String(row.id),
    position,
    status: status as QueueStatus,
    lesson: mapLessonSummaryFromRow(lessonRow, str(categoryRow?.name)),
  };
}

async function fetchStreak(userId: string): Promise<Streak> {
  const { data, error } = await getSupabase()
    .from('user_streaks')
    .select('current_streak, longest_streak, last_completed_on')
    .eq('user_id', userId)
    .maybeSingle();
  unwrap(data, error, 'Could not load your streak');
  const row = asRow(data);
  return {
    current: num(row?.current_streak) ?? 0,
    longest: num(row?.longest_streak) ?? 0,
    lastCompletedOn: str(row?.last_completed_on),
  };
}

async function countCompletedLessons(userId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('user_lesson_progress')
    .select('lesson_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('completed_at', 'is', null);
  if (error) {
    throw new Error(`Could not count completed lessons: ${error.message}`);
  }
  return count ?? 0;
}

async function fetchHome(userId: string): Promise<HomeSnapshot> {
  const supabase = getSupabase();
  const [queueResult, streak, lessonsCompleted] = await Promise.all([
    supabase
      .from('lesson_queue')
      .select(
        'id, position, status, lesson:lessons(id, title, summary, estimated_minutes, status, categories(name))',
      )
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .order('position'),
    fetchStreak(userId),
    countCompletedLessons(userId),
  ]);
  unwrap(queueResult.data, queueResult.error, 'Could not load your lesson queue');

  const items = asArray(queueResult.data)
    .map(asRow)
    .filter((row): row is Row => row !== null)
    .filter(row => str(asRow(row.lesson)?.status) === 'ready')
    .map(mapQueueItem)
    .filter((item): item is QueueItem => item !== null)
    .sort((a, b) => a.position - b.position);

  return {
    next: items[0] ?? null,
    upcoming: items.slice(1),
    streak,
    lessonsCompleted,
    // Live replenishment is a backend job; the UI shows a "preparing" state.
    sampleLibraryExhausted: false,
  };
}

function mapSource(row: Row, index: number): LessonSourceRef {
  const sourceRow = asRow(row.source) ?? {};
  const passageRow = asRow(row.passage) ?? {};
  const licenseRows = asArray(sourceRow.licensing_records)
    .map(asRow)
    .filter((r): r is Row => r !== null);
  const approved = licenseRows.find(r => str(r.status) === 'approved') ?? licenseRows[0];
  const licenseType = str(approved?.license_type);
  const authors = asArray(sourceRow.authors).filter(
    (author): author is string => typeof author === 'string',
  );
  const year = num(sourceRow.published_year);
  const authorLine =
    [
      authors.length > 0 ? authors.join(', ') : null,
      str(sourceRow.publisher),
      year !== null ? String(year) : null,
    ]
      .filter(Boolean)
      .join(' \u00b7 ') || null;

  const pageStart = num(passageRow.page_start);
  const pageEnd = num(passageRow.page_end);
  let pageLabel: string | null = null;
  if (pageStart !== null && pageEnd !== null && pageEnd !== pageStart) {
    pageLabel = `pp. ${pageStart}\u2013${pageEnd}`;
  } else if (pageStart !== null) {
    pageLabel = `p. ${pageStart}`;
  }

  const usage = str(row.source_usage);

  return {
    id: str(row.id) ?? `source-${index}`,
    title: str(sourceRow.title) ?? 'Source',
    authorLine,
    usage: (USAGE_VALUES.includes(usage as SourceUsage) ? usage : 'synthesis') as SourceUsage,
    quote: str(row.quote),
    pageLabel,
    url: str(sourceRow.source_url),
    licenseLabel: licenseType ? LICENSE_LABELS[licenseType] ?? licenseType : null,
  };
}

export const supabaseApi: LumioApi = {
  mode: 'live',

  async getTopics(): Promise<Topic[]> {
    const { data, error } = await getSupabase()
      .from('categories')
      .select('id, name, slug, description')
      .is('parent_id', null)
      .eq('status', 'approved')
      .order('name');
    unwrap(data, error, 'Could not load topics');
    return asArray(data)
      .map(asRow)
      .filter((row): row is Row => row !== null)
      .map(mapTopic);
  },

  async getProfile(): Promise<ProfileSnapshot> {
    const userId = await requireUserId();
    const supabase = getSupabase();
    const [profileResult, interestsResult, streak, lessonsCompleted, conceptsResult, activityResult] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, timezone, streak_reminders_enabled')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_interests')
          .select('category:categories(id, name, slug, description)')
          .eq('user_id', userId),
        fetchStreak(userId),
        countCompletedLessons(userId),
        supabase
          .from('user_covered_concepts')
          .select('concept_id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('reading_activity')
          .select('activity_date, lessons_completed')
          .eq('user_id', userId)
          .order('activity_date', { ascending: false })
          .limit(14),
      ]);
    unwrap(profileResult.data, profileResult.error, 'Could not load your profile');
    unwrap(interestsResult.data, interestsResult.error, 'Could not load your topics');
    unwrap(activityResult.data, activityResult.error, 'Could not load your activity');

    const profileRow = asRow(profileResult.data);
    const interests = asArray(interestsResult.data)
      .map(asRow)
      .map(row => asRow(row?.category))
      .filter((row): row is Row => row !== null)
      .map(mapTopic)
      .sort((a, b) => a.name.localeCompare(b.name));

    const activityByDate = new Map<string, number>();
    for (const rawRow of asArray(activityResult.data)) {
      const row = asRow(rawRow);
      const date = str(row?.activity_date);
      if (date) {
        activityByDate.set(date, num(row?.lessons_completed) ?? 0);
      }
    }

    const timezone = str(profileRow?.timezone) ?? deviceTimezone();
    const today = localDateString(new Date(), timezone);
    const activity: ActivityDay[] = [];
    for (let offset = 13; offset >= 0; offset--) {
      const date = addDays(today, -offset);
      activity.push({ date, lessons: activityByDate.get(date) ?? 0 });
    }

    const session = await supabase.auth.getSession();
    return {
      email: session.data.session?.user.email ?? null,
      displayName: str(profileRow?.display_name),
      timezone,
      remindersEnabled: profileRow?.streak_reminders_enabled !== false,
      interests,
      streak,
      lessonsCompleted,
      conceptsCovered: conceptsResult.count ?? 0,
      activity,
    };
  },

  async completeOnboarding(topicIds: string[]): Promise<void> {
    if (topicIds.length === 0) {
      throw new Error('Choose at least one topic to continue.');
    }
    const userId = await requireUserId();
    const supabase = getSupabase();
    const { error: interestsError } = await supabase
      .from('user_interests')
      .upsert(
        topicIds.map(categoryId => ({ user_id: userId, category_id: categoryId })),
        { onConflict: 'user_id,category_id' },
      );
    if (interestsError) {
      throw new Error(`Could not save your topics: ${interestsError.message}`);
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        onboarding_completed_at: new Date().toISOString(),
        timezone: deviceTimezone(),
      })
      .eq('id', userId);
    if (profileError) {
      throw new Error(`Could not finish onboarding: ${profileError.message}`);
    }
  },

  async updateInterests(topicIds: string[]): Promise<void> {
    if (topicIds.length === 0) {
      throw new Error('Keep at least one topic.');
    }
    const userId = await requireUserId();
    const supabase = getSupabase();
    const { error: upsertError } = await supabase
      .from('user_interests')
      .upsert(
        topicIds.map(categoryId => ({ user_id: userId, category_id: categoryId })),
        { onConflict: 'user_id,category_id' },
      );
    if (upsertError) {
      throw new Error(`Could not save your topics: ${upsertError.message}`);
    }
    const quoted = topicIds.map(id => `"${id}"`).join(',');
    const { error: deleteError } = await supabase
      .from('user_interests')
      .delete()
      .eq('user_id', userId)
      .not('category_id', 'in', `(${quoted})`);
    if (deleteError) {
      throw new Error(`Could not update your topics: ${deleteError.message}`);
    }
  },

  async updateSettings(patch): Promise<void> {
    const userId = await requireUserId();
    const update: Record<string, unknown> = {};
    if (patch.displayName !== undefined) {
      update.display_name = patch.displayName;
    }
    if (patch.remindersEnabled !== undefined) {
      update.streak_reminders_enabled = patch.remindersEnabled;
    }
    if (Object.keys(update).length === 0) {
      return;
    }
    const { error } = await getSupabase().from('profiles').update(update).eq('id', userId);
    if (error) {
      throw new Error(`Could not save your settings: ${error.message}`);
    }
  },

  async getHome(): Promise<HomeSnapshot> {
    const userId = await requireUserId();
    return fetchHome(userId);
  },

  async getLesson(lessonId: string): Promise<LessonContent> {
    const userId = await requireUserId();
    const supabase = getSupabase();
    const [lessonResult, takeawaysResult, sourcesResult] = await Promise.all([
      supabase
        .from('lessons')
        .select('id, title, summary, estimated_minutes, content, categories(name)')
        .eq('id', lessonId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('lesson_takeaways')
        .select('position, text')
        .eq('lesson_id', lessonId)
        .order('position'),
      supabase
        .from('lesson_sources')
        .select(
          'id, source_usage, quote, sort_order, passage:passages(page_start, page_end), source:sources(title, authors, publisher, published_year, source_url, licensing_records(license_type, license_url, status))',
        )
        .eq('lesson_id', lessonId)
        .order('sort_order'),
    ]);
    unwrap(lessonResult.data, lessonResult.error, 'Could not load the lesson');
    unwrap(takeawaysResult.data, takeawaysResult.error, 'Could not load the takeaways');
    unwrap(sourcesResult.data, sourcesResult.error, 'Could not load the lesson sources');

    const lessonRow = asRow(lessonResult.data);
    if (!lessonRow) {
      throw new Error('This lesson is not available.');
    }
    const blocks = parseBlocks(lessonRow.content);
    if (blocks.length === 0) {
      throw new Error('This lesson has no readable content yet.');
    }
    const takeaways = asArray(takeawaysResult.data)
      .map(asRow)
      .filter((row): row is Row => row !== null)
      .sort((a, b) => (num(a.position) ?? 0) - (num(b.position) ?? 0))
      .map(row => str(row.text))
      .filter((text): text is string => text !== null);
    const sources = asArray(sourcesResult.data)
      .map(asRow)
      .filter((row): row is Row => row !== null)
      .map(mapSource);

    return {
      ...mapLessonSummaryFromRow(lessonRow, str(asRow(lessonRow.categories)?.name)),
      blocks,
      takeaways,
      sources,
    };
  },

  async markOpened(lessonId: string): Promise<void> {
    const userId = await requireUserId();
    const supabase = getSupabase();
    const now = new Date().toISOString();
    // Insert-only first-open record; reopening updates last_opened_at below.
    const { error: insertError } = await supabase
      .from('user_lesson_progress')
      .upsert(
        { user_id: userId, lesson_id: lessonId, started_at: now, last_opened_at: now },
        { onConflict: 'user_id,lesson_id', ignoreDuplicates: true },
      );
    if (insertError) {
      throw new Error(`Could not record that you opened the lesson: ${insertError.message}`);
    }
    const { error: updateError } = await supabase
      .from('user_lesson_progress')
      .update({ last_opened_at: now })
      .eq('user_id', userId)
      .eq('lesson_id', lessonId);
    if (updateError) {
      throw new Error(`Could not record that you opened the lesson: ${updateError.message}`);
    }
    const { error: queueError } = await supabase
      .from('lesson_queue')
      .update({ status: 'active', activated_at: now })
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .eq('status', 'pending');
    if (queueError) {
      throw new Error(`Could not update your queue: ${queueError.message}`);
    }
  },

  async saveProgress(lessonId: string, blockIndex: number): Promise<void> {
    const userId = await requireUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_lesson_progress')
      .select('furthest_block_index')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();
    if (error) {
      throw new Error(`Could not save your progress: ${error.message}`);
    }
    const current = num(asRow(data)?.furthest_block_index) ?? 0;
    if (blockIndex <= current) {
      return;
    }
    const { error: updateError } = await supabase
      .from('user_lesson_progress')
      .upsert(
        { user_id: userId, lesson_id: lessonId, furthest_block_index: blockIndex },
        { onConflict: 'user_id,lesson_id' },
      );
    if (updateError) {
      throw new Error(`Could not save your progress: ${updateError.message}`);
    }
  },

  async completeLesson(lessonId: string): Promise<CompletionSummary> {
    const userId = await requireUserId();
    const supabase = getSupabase();
    const { data: existing, error: existingError } = await supabase
      .from('user_lesson_progress')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();
    unwrap(existing, existingError, 'Could not check your progress');

    if (!str(asRow(existing)?.completed_at)) {
      const { error: completeError } = await supabase
        .from('user_lesson_progress')
        .upsert(
          { user_id: userId, lesson_id: lessonId, completed_at: new Date().toISOString() },
          { onConflict: 'user_id,lesson_id' },
        );
      if (completeError) {
        throw new Error(`Could not complete the lesson: ${completeError.message}`);
      }
      // The completion trigger (migration 09) updates reading_activity,
      // user_streaks, user_covered_concepts, the queue row, and enqueues the
      // replenishment job — no client-side writes to summary tables.
    }

    const [streak, lessonsCompleted, home] = await Promise.all([
      fetchStreak(userId),
      countCompletedLessons(userId),
      fetchHome(userId),
    ]);
    return { streak, lessonsCompleted, nextLesson: home.next?.lesson ?? null };
  },
};

export { QUEUE_TARGET };
