# LUMIO: less scrolling, more understanding

An installable reading app that swaps a daily scroll for one source-grounded lesson from classic books, and saves every takeaway to a notebook the reader keeps.

**Role:** Founder, product design and build (with Claude Code)
**Timeline:** October – November 2026
**Platform:** Installable web app (PWA)
**Stack:** React, Vite, Supabase, Node, hosted or local AI
**Status:** Early testing with a small group of readers

## The problem

Most people want to learn regularly but give their spare minutes to feeds. Learning apps ask them to pick a course, build a plan and take quizzes, and they leave the first time they miss a day. Reading something good also leaves nothing behind: a week later the ideas are gone.

I wanted the opposite of a feed: one short, calm session a day that ends, and leaves the reader holding something.

## The idea

LUMIO picks one 15-minute lesson a day from a curated library of classic books. Each lesson ends with three to five takeaways, and every takeaway is saved to a searchable notebook. There is nothing to choose, no quiz, and a streak that never nags.

- **One lesson a day.** Three upcoming lessons are always prepared, so the home screen has one clear next step.
- **A notebook you keep.** Takeaways and your own notes are saved automatically and searchable, so reading adds up.
- **Traceable sources.** Every lesson lists the book passages it was built from, with licence information.

*Images: screens/home-dark.png, screens/lesson-dark.png, screens/notebook-dark.png. Screens are rendered from the app's own stylesheet with example reader data (name, streak and note).*

## Key decisions

**A web app people install, not a store app.** I restarted the product in November 2026 as a progressive web app. Android and desktop show an Install button, and iPhone uses Share, then Add to Home Screen. Readers get the app in seconds, and I ship updates without waiting for store review. The earlier React Native app stays in the project in case a store release makes sense later.

**Lessons that cannot make things up.** An AI writes the lessons, but only from passages of real, licensed books handed to it by code. Nothing it writes is trusted: every lesson is checked before a reader sees it.

Choose a topic → Pull book passages → Write the lesson → Validate → Store

- Length, structure and 3–5 takeaways are enforced.
- The lesson must name the concepts it was planned around.
- The pull quote is kept only if it appears word for word in a stored passage, so an invented quote is dropped.
- If a lesson states several numbers that appear in none of the source passages, it is rejected.

**Private by design.** Every table uses row-level security, so a reader can only see their own lessons, progress and notes. The app only ever holds a public key. The key that can write lessons stays on the server and is never shipped to the browser.

**Bad or missing lessons never stop a reader.** If the AI is offline, the app keeps working. Lessons already written stay available, and a refill rule moves the next ready lesson into the reader's queue when they finish one.

## The reading experience

- **Big idea first.** One sentence says what you will learn, so you know what you are getting.
- **A real line from the book.** A short quote, clearly attributed, makes it feel like reading the book.
- **Why it matters, try this, think about it.** The lesson ends by connecting the idea to daily life, with one small action and one open question.
- **Choose how you read.** A short version for busy days, a listen mode that reads the lesson aloud, and three text sizes.
- **Report a problem.** One tap to flag something that looks wrong, so accuracy stays ahead of everything else.

## The library, in numbers

70 books and articles · 28,800 searchable passages · 118 concepts to teach · 6 subject areas

Subjects: Politics, History, Islam, Psychology, Science and Geopolitics. Figures are from the live library in November 2026.

## Constraints and trade-offs

LUMIO started with a local AI model on my own computer, which meant new lessons only appeared while my machine was on. I also had no budget for paid services.

- **Hosted AI as an option.** A single setting switches the lesson writer from a local model to a hosted one, with a cheaper model for small decisions such as choosing the next topic.
- **A reserve of written lessons.** With a small group of readers, lessons can be written ahead of time from the real library and stored, then released automatically as readers finish.
- **Honest limits.** The library leans towards older books, so modern topics are thin. Open textbooks are the planned way to widen it.

## What I learned

- Constraints improve the product: designing for "the AI is off" produced a system that fails gracefully.
- Trust is a feature. Showing sources and dropping unverifiable quotes matters more to a reader than a clever lesson.
- A product that ends is easier to return to than one that never does.

**Next:** watch five to ten real readers go from sign-up to a finished first lesson, and measure day-two and day-seven return. Add reminders, offline reading and series of related lessons. Widen the library with open-licence textbooks for modern subjects.
