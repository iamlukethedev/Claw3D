# Hermes3D Vision

Hermes3D is an open-source 3D environment for visualizing and interacting with AI agents powered by OpenClaw.

The long-term goal of Hermes3D is to build a living 3D world where AI agents and humans collaborate: a kind of digital city where agents operate, communicate, and perform tasks in a shared visual space.

OpenClaw acts as the intelligence and orchestration engine, while Hermes3D provides the visual layer and interactive environment that makes agent activity understandable, inspectable, and collaborative.

This document explains the direction of the project and the guardrails guiding its development.

Project overview and developer documentation can be found in:

- [`README.md`](README.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Why Hermes3D Exists

AI systems are becoming increasingly capable, but their behavior is often invisible or difficult to understand.

Hermes3D aims to solve this by providing a visual interface for AI systems, allowing people to:

- observe AI agents operating in real time
- understand system behavior visually
- collaborate with AI in shared environments
- debug and inspect complex agent interactions

The ultimate vision is a 3D city of AI agents, where:

- agents represent services, tasks, and workflows
- humans can explore, monitor, and interact with them
- systems become understandable through spatial interaction

## Relationship to OpenClaw

Hermes3D is designed to work with OpenClaw, not replace it.

OpenClaw provides:

- agent orchestration
- tools and integrations
- communication channels
- task execution
- model provider integrations

Hermes3D provides:

- visualization
- interaction
- spatial representation of agents and systems
- collaborative environments for humans and AI

In simple terms:

```text
OpenClaw -> intelligence and task execution
Hermes3D   -> visualization and interaction layer
```

Maintaining compatibility with OpenClaw is an important design goal.

Features that require breaking OpenClaw integration will generally not be accepted unless there is a strong architectural reason.

## Current Priorities

Hermes3D is still in an early stage of development.

Current priorities include:

### Stability and Reliability

- bug fixes
- predictable rendering behavior
- improving the developer experience

### Core Architecture

- defining how agents map to visual entities
- building a scalable world model
- establishing a clean integration path with OpenClaw

### Developer Ergonomics

- clear APIs for extending the environment
- easy local setup
- straightforward contribution paths

### Visualization Primitives

- representing agents
- representing workflows
- representing system activity in spatial form

## Contribution Rules

To keep the project maintainable:

- One PR = one topic. Avoid bundling unrelated changes.
- Very large PRs may be declined or split into smaller pieces.
- Architectural changes should be discussed in issues before implementation.
- Contributors should respect the project's direction and scope.

Hermes3D is still evolving quickly, so iteration is expected.

## Architecture Direction

Hermes3D is designed as a visual layer on top of agent systems.

The system should remain:

- modular
- extensible
- easy to experiment with

The current stack focuses on:

- Three.js
- WebGL
- browser-based rendering
- integration with OpenClaw runtime systems

The goal is to keep the environment accessible to developers and contributors.

## What We Will Not Merge (For Now)

To maintain focus, the following types of contributions are generally avoided:

- features that break compatibility with OpenClaw
- major architectural rewrites without prior discussion
- replacing the rendering stack without strong technical justification
- heavy framework layers that reduce hackability
- extremely large PRs without prior coordination
- unrelated product experiments that do not advance the Hermes3D vision

This list is a directional guardrail, not a permanent restriction.

Strong technical arguments or user demand may change these decisions.

## Long-Term Direction

The long-term vision for Hermes3D is ambitious:

**A 3D city of AI agents.**

In this environment:

- AI agents operate as visible entities
- systems become spatially understandable
- humans can interact with agent systems in real time
- collaboration between humans and AI becomes natural

Instead of interacting with invisible systems through logs and dashboards, users will be able to walk through and interact with the systems themselves.

Hermes3D is an early step toward that future.
