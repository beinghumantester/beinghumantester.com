---
title: "What I Learned Building a Testing Framework for a Local AI Model Engine"
description: "A real story about building a testing framework for a local AI inference engine, and what it taught about verifying assumptions before trusting your own tests."
author: "Ujjwal Kumar Singh"
tags:
  - "Testing"
  - "AI Testing"
  - "Bug Investigation"
  - "Quality Assurance"
---
# What I Learned Building a Testing Framework for a Local AI Model Engine

I recently built a testing framework called `camelid evals` for a project called Camelid, which is a local AI inference engine that lets you run language models on your own machine instead of calling an API. This post is about that experience. What Camelid actually does, what I tried, how I tested it, and what I would still like to test in the future.

If you have ever wondered how you actually check whether an AI system does what it claims to do, I think this story is a useful one, because most of the interesting parts were not about writing clever code. They were about being honest with myself about what I had actually verified and what I was only assuming.

## What Camelid is

Camelid runs on your own computer and exposes an API that looks like the OpenAI API. You load a model file, and then you can send it chat messages, ask it for text embeddings, and so on, the same way you would with a hosted service. There are many projects like this. What made Camelid interesting to me is that it does not just claim to support things. It publishes, inside its own code, exact lists of what it supports and what it does not.

There are three of these lists. One says exactly which request types the API is willing to accept and how it responds to each. One is a ledger that tracks, model by model, exactly how validated each one is. Not just "this model works" but which exact version and file format, and how thoroughly it was tested. And the third tracks experimental engine features and whether they are turned on by default.

Camelid also states its own policy plainly. A model or feature is only considered supported once there is real evidence for it. And if something is not supported, the system should return a clear error instead of quietly trying its best and giving you a lower quality answer without telling you.

That last point matters a lot for testing. It means Camelid is not just claiming to work. It is making specific, checkable claims, and those claims can be tested against reality.

## The machine I tested on

I want to mention this early because it shaped almost every decision I made. I tested everything on my own laptop, an HP EliteBook with an Intel processor, no dedicated graphics card, and fourteen gigabytes of memory. I was running one specific released version of Camelid, with one specific small model loaded.

This matters because a testing framework that does not know exactly what hardware and version it is running against will happily report results that are not actually true anymore, or were never true for that machine in the first place.

## My first approach was wrong

My first instinct was to list out categories of things worth testing. Does the system validate its inputs correctly. Does streaming work. Can it use tools. Is it fast. Is it secure. That is a fine list to brainstorm, but it turned out to be a bad starting point, because it is very easy to fill in that list with things that sound reasonable but that nobody has actually confirmed.

So before writing any test, I went back to the actual Camelid source code and started checking every claim against it directly, using the exact version I had installed, not the newest code on the project's main branch. If I could not confirm something precisely, I marked it as unverified instead of guessing. That single habit ended up catching two real problems that would have quietly made my results wrong.

## The first problem I found

The list of supported API behaviors had grown a lot since the version I was running. Several validation rules I wanted to test were only officially listed in the newer code, not in my version. If I had written my tests assuming those newer entries applied to me, I would have been testing against a version of Camelid that did not actually exist on my machine.

The good news was that when I checked more carefully, the actual behavior those rules described was already present in my version, just not documented in that particular list yet. So the fix was not to throw the test away. It was to be precise about what I was actually citing as proof. Instead of pointing to "the official list says so," I pointed to the actual code and the actual existing tests that proved the behavior was real, at the exact version I was running.

## The second problem, and the one I am proudest of catching

There is a known bug in Camelid that was already fixed in a later update. It has to do with how streamed responses are put together when a stop condition overlaps awkwardly with how the text is being generated. The fix is well documented, with a very specific example that reliably triggers the old bug.

My first plan was simple. Write a test that checks the fixed, correct behavior. If Camelid produces the wrong output, the test fails.

Before doing that, I checked exactly when that fix was released, compared to the version I was running. It turned out the fix had not shipped yet, not just in my version, but in the newest official release available at the time either. It only existed in the ongoing development code, not in anything anyone could actually download and run.

If I had shipped my original plan, my test would have failed every single time I ran it, on every machine running any currently available version of Camelid, even though nothing was actually wrong. That is a serious kind of mistake, because a test that is wrong in that direction quietly trains you to ignore your own results.

So instead, I split it into two separate checks. One check expects the old, known bug to still be present on any version that predates the fix, and reports that as a known limitation rather than a failure. The other check is meant to guard against the bug coming back, but it only actually runs once a version containing the real fix exists. Until then, it correctly reports that there is nothing to check yet.

This meant building a small vocabulary of outcomes, not just pass and fail.

## Teaching the tests to say why, not just yes or no

Once I saw how many ways a test could fail to apply cleanly, pass and fail alone were not enough. A test can fail because something is genuinely broken. It can also fail to run because the model loaded does not support that feature, or because the hardware simply cannot do that thing, or because there is not enough evidence yet to even know what the correct answer should be.

So every test in this framework reports one of a small number of outcomes. Passed. Failed. Known limitation, expected for this version. Not applicable, because the environment cannot do this at all. Blocked, because the right model or setting is not currently active. Unverified, because there is not enough proof yet either way. Or error, meaning the testing tool itself broke, which is never counted against Camelid.

Only an actual failure or an actual tool error is allowed to break an automated run. Everything else has to explain itself. I made a personal rule that any result other than a clear pass or fail must come with a short explanation of why. A test that just quietly says "skipped" with no reason attached is not useful information. It is a small deception waiting to confuse someone later.

That rule led to two principles I kept coming back to throughout this project. I should never blame Camelid for something the current computer or the currently loaded model simply cannot do. And I should never assume something works just because the documentation says it exists, without actually checking it.

## Checking the environment before trusting anything else

Because everything in this framework depends on knowing exactly what version and model I am talking to, the very first thing the test suite does is check that. It asks the running system for its version number, confirms it matches what I expect, confirms the correct model is actually loaded, and confirms that no graphics card acceleration is active, since my laptop does not have one.

If any of those checks come back wrong, the whole run prints a clear warning and every other result from that run should be treated as unconfirmed rather than trusted. The rest of the tests still run anyway, because seeing what a mismatched setup actually produces is useful information on its own, but nothing gets quietly assumed to be reliable.

## Different models can do very different things

Camelid can load many different model files, and they are not all capable of the same things. Some can use tools. Some can only produce plain chat responses. Some are built specifically for generating embeddings rather than conversation.

I had five real model files on my laptop, and I built a small profile for each one describing exactly what it could do, based on the project's own official records rather than guessing from the model's name or reputation. This turned out to matter, because it would have been easy to assume that any modern looking model probably supports tool use, and that assumption would have been wrong for most of the five I had.

Any test that needs a capability the currently loaded model does not have is marked as blocked, with a clear reason, instead of quietly skipped or, worse, run against the wrong model and reported incorrectly.

## Checking the process, not just the final answer

Every test I had built so far only checked the final answer a system gave. None of them checked how it got there. That matters a lot for anything that involves a sequence of steps, like using a tool before answering a question. A model can produce a confident, correct sounding answer while having actually skipped the step that was supposed to make that answer trustworthy.

So I added a way to check the process itself, separately from the final content. For example, a rule that requires a specific tool to be called before any text is written, or a rule that certain fields in a structured answer must never be set to a made up value. These checks run as simple, deterministic code, completely separate from anything that involves judgment calls, which keeps them reliable and repeatable.

## Being honest about what I actually tested versus what I only described

I ended up with two clear groups of tests. Ones that are fully real and actually run automatically. And ones where I wrote out exactly what should be tested and why, but did not build fake infrastructure just to make them technically runnable.

The real tests cover things like the environment check described earlier, input validation on the API, the streaming bug described earlier, and checks against the project's own model support records, including some deliberately tricky examples designed to catch overly simple reasoning, like assuming that because one version of a model is supported, a very similar sounding version must be too.

The tests I only described, rather than built, are things like tool use by the model itself, security checks that need real external credentials, and anything that would need a second computer with different hardware to properly compare results against. In each of those cases, I decided that building a fake stand in system just to have something technically pass would only prove that my fake system agreed with itself. It would not actually prove anything about Camelid. I would rather be honest that those tests do not exist yet than pretend a fake version of them counts.

## A mistake in my own process, not in Camelid

One more story worth telling, because it happened to me directly rather than being about Camelid. I set up an automated check meant to prove that my streaming bug test actually detects the bug coming back, not just that it always reports success no matter what. That check kept failing in a confusing way that looked at first like my test logic was broken.

It turned out the actual problem was much simpler. I was trying to stop one background test server and start a new one on the same address, but the way I was stopping the first one did not actually shut it down completely. A leftover process kept quietly answering requests in the background, so my new server never actually got a chance to run, and I did not notice because something was still answering on that address the whole time.

The fix was simple once I understood it. Instead of trying to carefully stop and restart on the same address, I just ran the second test server on a different one entirely. That avoided the whole problem instead of trying to work around it.

## What this taught me about testing in general

A few things I would carry into any future project like this.

Always tie a claim to the exact version you tested, not just to the source code in general. The gap between those two things is exactly where my streaming bug mistake came from.

Never let a test silently do nothing without saying why. Every non pass and non fail result in my framework explains itself, and that habit cost very little effort while making the whole system far more trustworthy.

Test your own testing code, not just the thing you are testing. I wrote a separate set of tests just for my own testing scripts, completely independent of Camelid itself, because a bug in the testing tool can quietly produce wrong results everywhere without ever looking like a bug.

And finally, prove that your tests can actually fail, not just that they can pass. I only found my background process mistake because I had specifically built in a check meant to confirm that a known problem, if reintroduced, would actually be caught. A single green checkmark on its own tells you much less than you think it does.

## What I would like to test next

In order of what I would tackle first. Confirming a handful of smaller details I currently marked as unverified, rather than leaving them as open questions forever. Getting proper credentials set up so the security related checks can actually run instead of just being described. Loading one of my tool capable models and finally building the real tool use tests, since that is the area most likely to hide the kind of subtle bug I want to catch. Getting access to a second machine with different hardware so I can properly compare results across systems instead of only describing what that comparison would look like. And repeating this entire verification process whenever I update to a newer version, since every version specific claim I made has an expiration date, and assuming otherwise is exactly the mistake this whole project was meant to avoid.

If you are building something similar yourself, my honest advice is this. Be very clear about which parts you actually verified and which parts you are only assuming, and make your tests say so out loud. That distinction ended up mattering far more than any specific piece of code I wrote.
