// Copy for the Support screen. Content slice. Every answer restates something the
// app already says or does; if the app changes, change the answer with it.

/** Where the Contact button sends mail. Leave empty and the button is replaced by a note. */
export const SUPPORT_EMAIL = '';

export const SUPPORT_COPY = {
  title: 'Support',
  intro: 'How the app works, what stays private, and how to reach us.',
  faqHeading: 'Common questions',
  contactHeading: 'Contact us',
  contactBody: 'Stuck, or something looks wrong? Send us a note.',
  contactButton: 'Email support',
  contactMissing: 'Contact details are coming soon.',
};

export type FaqItem = { id: string; question: string; answer: string };

export const FAQ: FaqItem[] = [
  {
    id: 'how-matching-works',
    question: 'How are my matches chosen?',
    answer:
      'Your answers become a profile. We score every listing we know about against it, on this device, and rank the best fits first. Each match says why it fits and where it falls short, so you can judge it yourself.',
  },
  {
    id: 'what-listings-are',
    question: 'Are these real job postings?',
    answer:
      'Events are live Detroit listings, and the Events page shows when they were last updated. Jobs are types of work in metro Detroit, with what they pay and how to get in, rather than individual postings, because postings go stale within days. Some entries are samples for the demo, and those say "sample" in their title.',
  },
  {
    id: 'privacy',
    question: 'What happens to my answers?',
    answer:
      'They are saved on this device, and nothing leaves it until you choose "Send to matching" on your profile. Age and gender are optional, are kept on your profile only, and never affect your matches.',
  },
  {
    id: 'change-answers',
    question: 'Can I change my answers or start over?',
    answer:
      'Yes. Open your profile and choose "Change an answer", or open the career intake and choose "Start over". You can skip any question and come back to it later.',
  },
  {
    id: 'send-to-matching',
    question: 'What does "Send to matching" do?',
    answer:
      'It shows the exact request built from your profile, with each inferred value tied to the question it came from. It sends that request to the matching service once one is set up for this app.',
  },
  {
    id: 'no-profile',
    question: 'Can I browse without answering the questions?',
    answer:
      'Yes. Jobs, Internships, Programs, Research Programs and Events all list everything without a profile. Answering the questions adds a match score and puts the best fits first.',
  },
];
