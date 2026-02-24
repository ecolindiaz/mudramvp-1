# Run 02
> **ID:** `resp_0e9cd639bf3427f900699d709ac9c081949a6adbc661ccff3f`

## Token Usage
- Input: 4,437
- Output: 1,804
- Reasoning: 896
- Total: 6,241

## Search Calls

## Sites Referenced


## Products Mentioned

AWS Lambda, Azure Container, Docker, E2B, Firecracker, Google Cloud Run, Judge0, Kata Containers, Modal, Piston, StackBlitz, WebContainers, gVisor, nsjail

## Final Report

If you’re using **e2b.dev** for “run untrusted / AI-generated code in an isolated sandbox and verify it with tests,” the main alternatives fall into three buckets: **hosted code-execution APIs**, **serverless/container platforms you harden**, and **self-hosted sandbox stacks**.

## 1) Hosted “code runner / online judge” style APIs (closest to e2b’s use-case)
These are built specifically for executing arbitrary user code with limits.

- **Judge0 (CE / self-host / some hosted options)**  
  Multi-language code execution with time/memory limits; commonly used for running untrusted snippets and tests. Good if you want an API that accepts source + stdin and returns stdout/stderr + exit code.

- **Sphere Engine**  
  Similar “online judge” product offering API-based compilation/execution across many languages; more enterprise-y.

- **Piston (self-host)**  
  Lightweight self-hosted multi-language execution engine (popular in developer tools). Often used when you want something simple you can run inside your own infra.

When to pick these: you want “submit code → run → get results” with minimal infrastructure work, and you don’t need a full VM-like environment per run.

## 2) Serverless / container platforms (you supply the sandboxing)
If you’re okay assembling the security model yourself, these can work well for running tests at scale.

- **AWS Lambda (container images or zip)** / **Google Cloud Run** / **Azure Container Apps**  
  Strong isolation primitives, easy scaling, and short-lived execution. You still must design: filesystem constraints, outbound network policy, secrets isolation, per-tenant separation, and resource limits.

- **Modal** (serverless containers)  
  Good developer experience for ephemeral compute. Still “your job” to lock down what the executed code can access (network, filesystem, credentials).

When to pick these: you’re already on a cloud and want scalable execution, but you’re comfortable doing the security hardening and building the “runner” service.

## 3) Self-hosted “real sandboxing” building blocks (most control, most work)
If “secure” really means “assume the code is hostile,” this is the direction.

**Isolation layer options:**
- **Firecracker microVMs** (very strong isolation; common for hostile workloads)
- **gVisor** (container sandbox with a user-space kernel boundary; often used under Kubernetes)
- **Kata Containers** (VM-backed containers)

**Jail / policy tooling:**
- **nsjail** (namespaces/cgroups/seccomp-based jailing)
- **bubblewrap** (lightweight sandboxing on Linux)

When to pick these: you need stronger boundaries than plain Docker, want tight egress control, and/or need compliance/auditability.

## 4) In-browser sandboxes (useful for some languages / lower risk)
- **Pyodide (Python in WASM)**  
- **StackBlitz WebContainers (Node.js-like environment in browser)**  

When to pick these: you can run everything client-side and avoid server risk, or you want a “preview” sandbox. Not a drop-in for arbitrary native deps.

---

# Practical recommendation (most common “secure AI code testing” setup)
If you want a solid, scalable baseline without reinventing everything:

- **Execution engine:** Judge0 or Piston (API-style execution)
- **Hardening:** run each job in an ephemeral container **under gVisor or Kata**, with:
  - strict CPU/memory/time limits (cgroups)
  - read-only base image + tmpfs workspace
  - no host mounts
  - **no credentials present**
  - outbound network **blocked by default** (or allowlist only)
  - per-run fresh environment (no reuse)

This tends to get you close to e2b’s value (ephemeral, isolated runs) while staying portable.

---

## Quick questions (so I can narrow to the best 2–3 options)
1) Which languages do you need to run (Python only, or multi-language)?  
2) Do you need internet access during tests (pip/npm downloads, API calls), or can it be fully offline?  
3) Do you prefer **SaaS** or **self-hosted**? (and roughly how many runs/minute at peak?)