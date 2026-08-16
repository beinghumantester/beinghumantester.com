---
title: "Pipeline Playground"
description: "You inherited a broken CI/CD pipeline. Move stages, parallelize, change runner tiers, and run 20 PRs through it - there's no perfect pipeline, only trade-offs between speed, cost, and risk."
date: "2026-08-16"
tags:
  - "Game"
  - "CI-CD"
  - "DevOps"
  - "Learning"
---

Design a pipeline against a discrete-event simulation engine, not a flowchart. Every run pushes 20 PRs through your configuration on a shared, limited runner pool - watch PR feedback time, cost, and risk move against each other as you parallelize stages, relocate gates between PR/Merge/Release, and change runner capacity. One seeded integration defect is hiding in the batch; whether it escapes to production depends entirely on where you put your test coverage.

[Play Pipeline Playground](/projects/pipeline-playground)
