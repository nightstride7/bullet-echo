// SAMPLE DATA — fictional products. Replace with your own assessed launches.
// Schema is documented in docs/DATA-SCHEMA.md. Generate entries with prompts/assess.md.
export const FEED_DATE = "2026-01-01";

export const SEED = [
  {
    id: "acme-notes", name: "Acme Notes", tagline: "Meeting notes that write their own follow-ups",
    upvotes: 212, phUrl: "https://www.producthunt.com/products/acme-notes", url: "https://example.com/acme-notes",
    category: "Productivity · AI",
    assessment: {
      score: 78, isRelaunch: false, worthMessaging: true, founderPlay: true,
      positioning: "AI notetaker that turns calls into drafted follow-up emails and CRM updates.",
      claimsToChallenge: "Accuracy on accented English and non-English calls is unproven.",
      architecturalObservation: "Writes back into the CRM instead of stopping at a summary — the right place in the workflow.",
      opportunityAngle: "Your target market is full of sales teams that run calls in two languages. A notetaker that handles that wins an underserved segment.",
      linkedInMessage: "Hi — {YourName} here. Acme Notes caught my eye because it writes back into the CRM instead of stopping at a summary. I help tools like yours enter {Market} with warm intros and localized positioning. Open to a 15-min call?",
      connectionNote: "Acme Notes caught my eye — writing back into the CRM is the right place in the workflow. I help products enter {Market}. Worth connecting?",
      messageTarget: "founder", linkedInUrl: null, postWorthy: false, linkedInAngle: null,
      replyToolkit: {
        theyreInterested: "Key question: how does it handle bilingual calls? That's the wedge in {Market}.",
        theyreQuiet: "Quick nudge — happy to share 3 {Market} accounts that fit your ICP. Worth a look?",
        theyreTheRightPerson: "Who owns international expansion on your side? Happy to send a one-pager.",
        phCommentAngle: "Love that follow-ups land in the CRM. Curious how you handle mixed-language calls.",
      },
      reasoning: "Score 78 — clear B2B ICP, fresh launch, reachable founder, market gap.",
    },
  },
  {
    id: "loopback", name: "Loopback", tagline: "User interviews on autopilot",
    upvotes: 96, phUrl: "https://www.producthunt.com/products/loopback", url: "https://example.com/loopback",
    category: "Research · AI",
    assessment: {
      score: 54, isRelaunch: false, worthMessaging: false, founderPlay: false,
      positioning: "Recruits, runs and summarizes user interviews automatically.",
      claimsToChallenge: "Participant quality outside the US/EU is not addressed.",
      architecturalObservation: "Solid product, but the regional fit is thin.",
      opportunityAngle: "Only worth messaging if participant panels in your market are a real pain point.",
      linkedInMessage: "", connectionNote: "", messageTarget: "founder", linkedInUrl: null, postWorthy: false, linkedInAngle: null,
      replyToolkit: { theyreInterested: "", theyreQuiet: "", theyreTheRightPerson: "", phCommentAngle: "" },
      reasoning: "Score 54 — below threshold. Kill, don't fire.",
    },
  },
];
