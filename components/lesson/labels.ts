/**
 * Chrome labels for the lesson UI.
 *
 * Only the model-generated EDUCATIONAL CONTENT reflects the user's requested
 * language. The application UI / navigation chrome stays in English so the
 * platform feels consistent regardless of which course you're reading.
 *
 * `labelsFor()` accepts a language argument for backward compatibility with
 * call sites, but always returns the English label set.
 */

export interface LessonLabels {
  chapter: string
  goal: string
  buildsOn: string
  watchOut: string
  mistake: string
  whyItHappens: string
  fix: string
  keyTakeaways: string
  tryItYourself: string
  showHint: string
  revealSolution: string
  hint: string
  solution: string
  example: string
  exampleNofM: (n: number, total: number) => string
  minRead: (n: number) => string
  chaptersCount: (n: number) => string

  // ─── Edit panel ───
  read: string
  edit: string
  editPanelTitle: string
  editPanelSubtitle: string
  actionEditChapter: string
  actionAddChapter: string
  actionApplyAll: string
  actionExpand: string
  actionSimplify: string
  actionDirection: string
  pickAChapter: string
  appendAtEnd: string
  insertAfter: string
  whatToChange: string
  whatNewChapter: string
  whatCourseChange: string
  whatDirectionChange: string
  apply: string
  applying: string
  cancel: string
}

const EN: LessonLabels = {
  chapter: 'Chapter',
  goal: 'Goal',
  buildsOn: 'Builds on',
  watchOut: 'Watch out — common mistakes',
  mistake: 'Mistake',
  whyItHappens: 'Why it happens',
  fix: 'Fix',
  keyTakeaways: 'Key takeaways',
  tryItYourself: 'Try it yourself',
  showHint: 'Show hint',
  revealSolution: 'Reveal solution',
  hint: 'Hint',
  solution: 'Solution',
  example: 'Example',
  exampleNofM: (n, total) => `Example ${total > 1 ? `${n} of ${total}` : ''}`.trim(),
  minRead: n => `${n} min read`,
  chaptersCount: n => `${n} chapter${n !== 1 ? 's' : ''}`,

  // Edit panel — UI chrome, English in every language
  read: 'Read',
  edit: 'Edit',
  editPanelTitle: 'Edit Course',
  editPanelSubtitle: 'Request changes — we’ll rewrite affected chapters.',
  actionEditChapter: 'Edit Chapter',
  actionAddChapter: 'Add New Chapter',
  actionApplyAll: 'Apply to Entire Course',
  actionExpand: 'Expand Content',
  actionSimplify: 'Simplify Explanation',
  actionDirection: 'Course Direction',
  pickAChapter: 'Select Chapter',
  appendAtEnd: 'Append at the end',
  insertAfter: 'Insert after',
  whatToChange: 'What do you want changed?',
  whatNewChapter: 'What should the new chapter cover?',
  whatCourseChange: 'What should change across the course?',
  whatDirectionChange: 'How should the course direction shift?',
  apply: 'Apply',
  applying: 'Working…',
  cancel: 'Cancel',
}

/**
 * Returns the chrome label set. The `language` argument is kept for backward
 * compatibility with existing call sites but is ignored — UI chrome is always
 * English so navigation stays consistent across courses.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function labelsFor(_language?: string | null): LessonLabels {
  return EN
}
