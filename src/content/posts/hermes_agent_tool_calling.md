---
title: "I Asked a Local AI Agent to Add 7 and 5"
description: "A hands on look at whether two small local models could actually call a tool in Hermes Agent, and why the database told a different story than the terminal screen."
author: "Ujjwal Kumar Singh"
tags:
  - "AI Testing"
  - "Local LLMs"
  - "Tool Calling"
---

# I Asked a Local AI Agent to Add 7 and 5

## Why Checking Tool Calls Matters

On October 4, 2026, I spent a day exploring Hermes Agent, a command line AI agent that can talk to many language model providers, including models that run entirely on your own machine through Ollama. The promise is that the agent can use tools, such as a terminal, to do real work for you. The question I wanted to answer was simple. When the agent says it used a tool, did it actually use one?

The test prompt was deliberately trivial: "Use the terminal to run a command that adds 7 and 5, and show me the exact output." A calculator can do that in a fraction of a second. If a model cannot complete a task like that, it is hard to trust it with anything harder.

## The Setup

I ran Hermes Agent locally and pointed it at an Ollama instance on localhost, using a custom endpoint with the chat completions API mode. I tested two models: llama3.1:8b and qwen3:4b.

Before I started, the hermes doctor command reported that my install was 43 commits behind and flagged five configuration and health issues. One of them was a stale custom providers list that needed to be migrated to a providers map, and I fixed that partway through. Keep the outdated install in mind, because it is one of the things I could not rule out.

## Why I Did Not Trust the Screen

Hermes keeps its session history in a SQLite database at ~/.hermes/state.db. The messages table has a tool_calls column, and Hermes maintains an index on that column that covers only assistant rows where it is populated. That tells me the column is the field Hermes itself treats as the real marker of a structured tool call, as opposed to text that merely looks like one. So I used that column as my ground truth.

Every finding in this post comes from querying it directly:

```sql
SELECT id, session_id, role, tool_name, tool_calls, timestamp
FROM messages
ORDER BY id;
```

Two other places I checked first were the sessions folder, which was empty, and the logs folder, which held only generic application logs. Neither contained a record of tool use.

## A Mistake I Made Along the Way

Partway through the testing, the terminal showed a clean JSON block that looked exactly like a function call. It had a type of function, a name of run, and a parameters object with a command that printed the sum of 7 and 5. I wrote that down as a real structured dispatch. It was not. When I queried the database for that message, the tool_calls field was empty. The JSON was narration, shaped like a tool call but sitting inside ordinary message text.

I am recording this on purpose, because it is the exact mistake this whole exercise is meant to catch: trusting that something happened because the output looks like it happened. It happened to me, the person doing the evaluation, and not only to the model. The lesson I took away is simple. Query the record, not the render.

## llama3.1:8b, Narration Only

Across two sessions and three assistant turns, llama3.1:8b never produced a populated tool_calls field. Its replies showed up in three different forms:

1. Clean JSON shaped text, presented as the answer to the question.
2. Plain prose narration, a step by step walkthrough that ended with the answer 12.
3. A fabricated description of a call to a shell tool. This one happened by accident. I had typed a real shell command into the Hermes chat prompt instead of a terminal, and the model responded by inventing a plausible looking tool invocation. Nothing was run.

Two of the three looked to me, reading the terminal, like tool use had happened. None of them had.

## qwen3:4b, Real Dispatches That Never Worked

This was the more interesting result. Unlike llama3.1:8b, qwen3:4b did produce real structured dispatches. The tool_calls field was populated several times, across two independent sessions. Hermes rejected every one of them for the same reason.

As far as I could tell, Hermes splits its tools into two groups. A small set is listed directly and can be called by name. A larger set is deferred and must be called through a generic wrapper named tool_call, with a payload shaped as a calls array, where each entry has a name and its arguments. qwen3:4b never got that shape right on its first attempt.

In the first session, the sequence went like this:

1. The first attempt called tool_call with a command argument and left out the calls wrapper. This was a real dispatch, and Hermes rejected it because the calls array was required.
2. The second attempt used the correct wrapper, but the model drifted to an unrelated search tool with a placeholder query and abandoned the actual task. Hermes rejected it again, because that tool is directly listed and should not go through the wrapper.
3. The third attempt went back to the missing wrapper. Rejected again. This time Hermes's own loop detector fired and told the model it was looping, that it should keep using tools and diagnose the problem before retrying. The model did not change its next move.
4. There was no useful fourth response. Hermes gave up after 381 seconds of waiting and reported the operation as interrupted.

From the prompt to that final timeout, the session took 58 minutes. I calculated that from the raw Unix timestamps stored in the database, not from my memory of how long it felt.

The second session was a repeat run with the same prompt and the same model. The first attempt used byte for byte the same arguments as the first attempt in the first session, and Hermes rejected it the same way. This time the model went silent after that one rejection, and Hermes waited about 18 minutes before giving up.

The recovery behavior differed between the two sessions, but the triggering mistake was deterministic. That is what makes this a different failure mode from the llama3.1:8b narration. Here the model made a genuine, validated attempt that failed for a concrete schema reason. The framework's own safeguard noticed the loop and asked the model to diagnose it, and the model did not manage that either time. The net result was zero completed executions of a task a calculator solves instantly, and roughly an hour of wall clock time in the first session alone.

## What This Adds Up To

Set beside my earlier LibreChat evaluation, the pattern is consistent. The gap between text that looks like tool use and a real, structured, successfully executed call is wide, it depends on the model, and it is not reliably visible from a chat window or a terminal.

Hermes adds one new lesson to that. A smaller model can clear the first bar, producing a real structured dispatch, and still get stuck in an unbounded failure loop because of a schema mismatch in a wrapper convention that is under documented. The framework's own guard noticed the problem but could not break the loop.

## What I Have Not Verified

1. I repeated only the qwen3:4b failure mode, and only twice. I did not run llama3.1:8b as a deliberate controlled repeat.
2. I did not test a more explicit prompt that names the tool_call wrapper and its calls schema. That would show whether the problem is the model's capability or the instructions Hermes gives it.
3. I did not test on a freshly updated Hermes install. Mine was 43 commits behind, so this schema mismatch may already be fixed upstream.
4. I did not test other local models. My machine also has llama3.2:3b and a few other models, so I cannot yet say whether this is specific to the qwen family, to model size, or to these two models alone.
5. The doctor output flagged vulnerability counts that rose slightly between runs. I did not investigate those.

## Lessons Learned

- **Query the record, not the render**
  The terminal showed a convincing tool call that the database did not contain.

- **Trust the framework's own ground truth**
  Hermes indexes the tool_calls column, so that column is the honest signal of a real call.

- **Trivial tasks expose big gaps**
  A calculator task is enough to separate narration from real execution.

- **A loop guard is not a recovery plan**
  Hermes detected the loop, but the model could not act on the warning.

- **Verify before you blame the model**
  The failure could come from the model, the prompt, or an outdated install, and each one needs its own check.
