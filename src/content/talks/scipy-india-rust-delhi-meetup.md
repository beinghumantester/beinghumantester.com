---
title: "Finding What Your Tests Miss - Property Based Testing in Python"
date: "2026-08-22"
event: "SciPy India x Rust Delhi Meetup, Noida"
external_url: "https://scipy.in/events/#scipy-india-rust-delhi-meetup"
description: "An introduction to property based testing in Python using Hypothesis - how defining invariants and mathematical properties catches edge cases that example based tests consistently miss, especially in numerical and scientific Python code."
tags:
  - "Python"
  - "Property-Based Testing"
  - "Scientific Computing"
  - "Hypothesis"
---

## Event

**Upcoming Talk**
Hosted by SciPy India x Rust Delhi Meetup

Event Page:
https://scipy.in/events/#scipy-india-rust-delhi-meetup

**Format:** Talk (20-25 minutes + Q&A)
**Domain:** Computational Tools and Scientific Python Infrastructure
**When:** Saturday, 22 August 2026, IST

---

## Abstract

Most Python tests verify what we expect. Property based testing finds what we never thought to check. This talk introduces property based testing using Hypothesis, showing how defining invariants and mathematical properties catches edge cases that example based tests consistently miss, especially in numerical and scientific Python code.

## Talk Overview

Scientific computing code carries a hidden testing problem. We write tests for the cases we can imagine - known inputs, expected outputs, familiar edge cases. But numerical code fails at boundaries we never thought to test. Floating point precision, unexpected input distributions, boundary conditions at scale - these are exactly where bugs live, and exactly where traditional example based testing is blind.

Property based testing flips the model. Instead of asking "does this input produce this output?", you ask "what must always be true about this function, regardless of input?" You define the property. The library finds inputs that break it.

This talk introduces property based testing in Python using Hypothesis, one of the most mature property based testing libraries in the ecosystem. We will walk through the core mental model shift from example based to property based thinking, explore how Hypothesis generates and shrinks test cases, and look at where this approach is particularly powerful for scientific Python code.

The talk is structured around three questions: What is a property? How does Hypothesis find violations? And where does this matter most for people writing numerical, data, or simulation code in Python?

We will look at real examples - testing mathematical invariants like commutativity and idempotency, validating data pipeline transformations, and catching numerical stability issues that unit tests would never surface. Every example will be runnable pytest code.

The goal is not to replace your existing tests. It is to show you a class of bugs your current tests cannot see, and give you a practical tool to find them.

## Key Takeaways

- What property based testing is and how it differs fundamentally from example based testing
- How Hypothesis generates, runs, and shrinks failing test cases automatically
- How to identify testable properties in scientific and numerical Python code
- How to write your first Hypothesis test inside an existing pytest suite
- Where property based testing adds the most value in data pipelines and numerical code

## Who This Is For

Python developers and researchers who write or maintain scientific computing code. Basic familiarity with pytest is helpful but not required. No prior knowledge of property based testing is assumed - this talk starts from zero.

Useful pre-reading if interested: [Hypothesis documentation](https://hypothesis.readthedocs.io/)

## Resources

Hypothesis library: https://hypothesis.readthedocs.io/
