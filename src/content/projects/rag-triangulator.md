---
title: "RAG Triangulator"
description: "You're not chatting with an AI - you're investigating why one gave a confident, wrong answer. Inspect a simulated retrieval pipeline, change Top-K and context budget, and prove where the failure actually happened."
date: "2026-08-17"
tags:
  - "Game"
  - "AI Testing"
  - "RAG"
  - "ai-in-testing"
---

Three missions, three distinct failure layers - a stale document that outranked the current policy on pure relevance, a critical document that was retrieved but dropped before it reached the model, and a low-authority source that won on relevance over the official policy. No real LLM, no API keys, no backend - a fully deterministic simulation with an unambiguous correct answer per mission.

[Play RAG Triangulator](/projects/rag-triangulator)
