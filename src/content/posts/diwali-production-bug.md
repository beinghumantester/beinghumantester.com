---
title: "An Uninvited Guest in the Diwali Party"
description: "A real story about how a production bug interrupted a Diwali celebration and what it taught about pairwise testing."
author: "Ujjwal Kumar Singh"
tags:
  - "Testing"
  - "Pairwise Testing"
  - "Bug Investigation"
---

# An Uninvited Guest in the Diwali Party

## Why Updating with a Condition Is Important

It was a usual evening, and in just a couple of hours the Diwali party was about to begin. Excitement was in the air and everyone was looking forward to creating some memorable moments. Some people were dressed in ethnic wear while others were in casual clothes, but the shared excitement and team spirit were clear.

Before the party everyone was trying to wrap up their work to enjoy the evening stress free. But as we all know, no software is perfect. Sometimes it is all about the timing when a bug shows up.

## Incident Reported

Just half an hour before finishing up, we got word of a bug in the production environment. Initially it seemed like a simple issue that could be fixed quickly with a hotfix.

But since it was already time for the Diwali party, some people started heading there while my team gathered in the boardroom hoping to solve the issue fast.

Within 10 minutes everyone was there — front end, back end, QA and PM.

## Debugging Begins

With everyone in the room we started digging into the problem. As time passed we realized the debugging was getting more complicated. But finding the root cause was the priority before fixing it.

The team began pairwise testing, trying different combinations.

After nearly an hour we finally found the root cause: a small error in variable name declaration.

Even though it seemed like a minor issue, every production bug is critical.

## Deployment Process

Once the issue was fixed, testing began.

We tested on the test environment first, then moved to staging. After a quick sanity check on staging we got sign off for production.

This whole process took around five hours.

By the time we deployed the hotfix, we were already late to the party.

## Lessons Learned

- **Every bug teaches a lesson**
  Some team members missed the Diwali party, but we didn't want to miss the opportunity to learn from the bug.

- **Choose the smartest testing approach**
  When time is limited, selecting a testing strategy that ensures quality is critical.

- **The value of pairwise testing**
  Pairwise testing works well when systems have multiple inputs and combinations.

- **Focus on key combinations**
  Instead of testing everything, pairwise testing helps focus on meaningful combinations.

- **Catch hidden bugs faster**
  Prioritized combinations reveal hidden issues earlier.

- **Teamwork is essential**
  Critical situations highlight how important collaboration is.
