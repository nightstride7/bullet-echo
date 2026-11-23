# Data schema

Each product in `SEED`:

| field | type | notes |
|---|---|---|
| id | string | unique slug |
| name, tagline, category | string | |
| upvotes | number | |
| phUrl, url | string | PH page, product site |
| assessment.score | 0–100 | ≥ ~65 usually worth messaging |
| assessment.worthMessaging | bool | fire vs kill |
| assessment.founderPlay | bool | passes 6 of 7 Founder Play filters |
| assessment.positioning / claimsToChallenge / architecturalObservation / opportunityAngle | string | analysis |
| assessment.linkedInMessage / connectionNote | string | outreach copy |
| assessment.messageTarget | "founder" \| other | who to contact |
| assessment.replyToolkit | object | theyreInterested, theyreQuiet, theyreTheRightPerson, phCommentAngle |
| assessment.reasoning | string | one-line score rationale |
