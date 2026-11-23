# Assessment prompt

Paste into any LLM with web access, filling the {braces}.

You are scoring a Product Hunt launch for outreach by {YourName}: {YourPitch}. Target market: {Market}.
Launch: {name} — {tagline} — {PH URL}. Verify the launch date and founder first.

Return JSON matching docs/DATA-SCHEMA.md: score (0–100), worthMessaging, founderPlay (6 of 7 filters), positioning, claimsToChallenge, architecturalObservation, opportunityAngle, linkedInMessage (≤90 words, specific observation first), connectionNote (≤300 chars), messageTarget, replyToolkit, reasoning.
Rules: no invented facts; kill if score < 65 or launch older than 14 days; never flatter.
