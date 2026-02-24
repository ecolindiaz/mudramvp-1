# Run 04
> **ID:** `resp_02d676696cab4b7b00699d709c19848193921eb5251388c3bf`

## Token Usage
- Input: 43,080
- Output: 4,477
- Reasoning: 2,967
- Total: 47,557

## Search Calls

### Search 1: `e2b.dev sandbox API run untrusted code alternative`
  - e2b.dev sandbox API run untrusted code alternative
  - Judge0 API secure code execution sandbox
  - Piston code execution API sandbox
  - Modal secure sandbox run code containers

### Search 2: `engineer-man piston github code execution API sandbox`
  - engineer-man piston github code execution API sandbox
  - Sphere Engine code execution API sandbox
  - CodeSandbox Code Runner API execute code sandbox
  - Cloudflare Workers isolates V8 sandbox code execution untrusted

### Search 3: `Vercel Sandbox microVM run untrusted code 45 minutes beta`
  - Vercel Sandbox microVM run untrusted code 45 minutes beta
  - Daytona sandbox SDK run code isolated environment
  - Northflank microVM Firecracker untrusted code jobs
  - Kata Containers vs gVisor Firecracker isolation for running untrusted code

### Search 4: `InstaVM sandbox microVM API execute code`
  - InstaVM sandbox microVM API execute code
  - apify code sandbox actor containerized environment agentic coding
  - Google Cloud Run gVisor sandbox untrusted code
  - AWS Fargate Firecracker isolation run untrusted code

### Search 5: ``

### Search 6: `Daytona sandboxes Firecracker microVM`
  - Daytona sandboxes Firecracker microVM
  - site:daytona.io Firecracker
  - site:daytona.io microVM
  - Daytona sandbox isolation Firecracker

### Search 7: `Fly.io Machines run sandboxed code isolation`
  - Fly.io Machines run sandboxed code isolation
  - Fly Machines microVM firecracker
  - AWS Lambda uses Firecracker microVM
  - Google Cloud Run uses gVisor sandbox

### Search 8: `site:modal.com gVisor Sandboxes`
  - site:modal.com gVisor Sandboxes
  - Modal Sandboxes gVisor
  - Modal restricted functions gVisor

## Sites Referenced

- [Run untrusted code with Vercel Sandbox, now generally available - Vercel](https://vercel.com/blog/vercel-sandbox-is-now-generally-available?utm_source=openai)
- [Joining Together AI and Introducing CodeSandbox SDK - CodeSandbox](https://codesandbox.io/blog/joining-together-ai-introducing-codesandbox-sdk?utm_source=openai)
- [Sandboxes | Modal Docs](https://modal.com/docs/guide/sandboxes?utm_source=openai)
- [Overview · Cloudflare Sandbox SDK docs](https://developers.cloudflare.com/sandbox/?utm_source=openai)
- [Sandboxes | Daytona](https://www.daytona.io/docs/en/sandboxes/?utm_source=openai)
- [Fly Machines · Fly](https://fly.io/machines?utm_source=openai)
- [YepCode Run - Execution Sandbox environment for AI-generated code](https://yepcode.io/run/?utm_source=openai)
- [InstaVM | Secure AI Code Execution Platform](https://instavm.io/?utm_source=openai)
- [Hosting the Agent SDK - Claude API Docs](https://platform.claude.com/docs/en/agent-sdk/hosting?utm_source=openai)
- [GitHub - engineer-man/piston: A high performance general purpose code execution engine.](https://github.com/engineer-man/piston?utm_source=openai)
- [GitHub - judge0/judge0: Robust, fast, scalable, and sandboxed open-source online code execution system for humans and AI.](https://github.com/judge0/judge0?utm_source=openai)
- [GKE Sandbox  |  GKE security  |  Google Cloud Documentation](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods?utm_source=openai)
- [Isolate AI code execution with Agent Sandbox  |  GKE AI/ML  |  Google Cloud Documentation](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/agent-sandbox?utm_source=openai)
- [Announcing the Firecracker Open Source Technology: Secure and Fast microVM for Serverless Computing | AWS Open Source Blog](https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/?utm_source=openai)
- [Container runtime contract  |  Cloud Run  |  Google Cloud](https://cloud.google.com/run/docs/container-contract?utm_source=openai)
- [Understanding Sandboxes](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai)
- [Products - Sandboxes | Modal](https://modal.com/products/sandboxes?utm_source=openai)

## Products Mentioned

AWS Lambda, Cloudflare, CodeSandbox, Daytona, Docker, E2B, Firecracker, Fly.io, GKE Sandbox, Judge0, Modal, Piston, Vercel Sandbox, gVisor

## Final Report

If you’re using **E2B** to run *AI-generated/untrusted code* in an isolated environment (clone repo → install deps → run tests/lint → capture logs/artifacts), here are the closest **drop-in alternatives**, plus **self-host** options.

## Managed “sandbox API” alternatives (closest to E2B)

### 1) **Vercel Sandbox** (microVM / Firecracker)
On-demand Linux **microVMs** meant for running untrusted code; recently **generally available (Jan 30, 2026)** with a CLI/SDK. ([vercel.com](https://vercel.com/blog/vercel-sandbox-is-now-generally-available?utm_source=openai))  
**Best for:** short-lived test runs, PR validation, agent loops where strong isolation matters.

### 2) **CodeSandbox SDK** (microVM sandboxes + snapshots/persistence)
Programmatic sandboxes running in a **microVM**, with fast cloning from snapshots, FS persistence, and dev-container/Docker(-compose) style env customization. ([codesandbox.io](https://codesandbox.io/blog/joining-together-ai-introducing-codesandbox-sdk?utm_source=openai))  
**Best for:** “IDE-like” agent testing where you want reproducible environments and checkpoint/restore.

### 3) **Modal Sandboxes** (gVisor-based container isolation + strong controls)
“Sandbox” primitive to run arbitrary commands/code in isolated environments; their docs describe **networking controls** and a security model built on **gVisor**. ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))  
**Best for:** high-throughput evals/tests, lots of parallel sandboxes, and when you want programmable network blocking/allowlists.

### 4) **Cloudflare Sandbox SDK** (Workers-controlled containers; edge-native)
A Workers API to create/manage isolated Linux environments (containers) via a TypeScript SDK; designed for untrusted code execution and integrates with Durable Objects + Containers. ([developers.cloudflare.com](https://developers.cloudflare.com/sandbox/?utm_source=openai))  
**Best for:** products already on Cloudflare Workers that want sandboxed execution “next to” the edge app.

### 5) **Daytona Sandboxes**
SDK-managed isolated sandboxes with configurable resources, snapshots/warm pools, and network firewall settings (per their docs). ([daytona.io](https://www.daytona.io/docs/en/sandboxes/?utm_source=openai))  
**Best for:** agent workflows that need a simple “create sandbox → run code → destroy” loop with some statefulness.

### 6) **Fly.io Machines** (microVMs / Firecracker)
Fast-booting VMs that run containerized workloads; **uses Firecracker** (microVMs). ([fly.io](https://fly.io/machines?utm_source=openai))  
**Best for:** when you want more “real VM” semantics (services, longer runs) and global placement.

### 7) “Emerging/other hosted sandboxes”
- **YepCode Run** (serverless sandbox runtime; notable hard limits like execution time, deps, etc.). ([yepcode.io](https://yepcode.io/run/?utm_source=openai))  
- **InstaVM** (microVM-oriented agent runtime; strong focus on egress controls/auditing per product docs). ([instavm.io](https://instavm.io/?utm_source=openai))  

Also, Anthropic’s **Claude Agent SDK** deployment docs list several of these providers (Modal, Cloudflare, Daytona, E2B, Fly, Vercel) as common sandbox backends. ([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/hosting?utm_source=openai))

---

## Self-host / “run it in my infra” options (good for tighter control)

### A) **Piston** (open source)
A general-purpose code execution engine focused on running untrusted code; documents security measures like namespaces/cgroups, default network disablement, time/memory limits, etc. ([github.com](https://github.com/engineer-man/piston?utm_source=openai))  
**Best for:** “judge-style” execution (many languages, strict quotas) that you fully control.

### B) **Judge0** (open source + hosted)
Popular for multi-language execution, but be aware there have been reported sandbox vulnerabilities in the past—treat patching/isolation hardening as non-optional. ([github.com](https://github.com/judge0/judge0?utm_source=openai))  
**Best for:** broad language support + an established ecosystem, if you can own the security posture.

### C) Kubernetes isolation layers
- **GKE Sandbox** runs pods with **gVisor** (RuntimeClass) for stronger isolation. ([docs.cloud.google.com](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods?utm_source=openai))  
- Google also has **Agent Sandbox** on GKE specifically positioned for isolating AI/untrusted code execution using gVisor. ([docs.cloud.google.com](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/agent-sandbox?utm_source=openai))

### D) Cloud primitives that can be “good enough” with the right guardrails
- **AWS Fargate** and **AWS Lambda** are built on **Firecracker microVMs** (strong isolation baseline), though they’re not “interactive sandbox SDKs” by default. ([aws.amazon.com](https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/?utm_source=openai))  
- **Cloud Run (1st gen)** uses a **gVisor container sandbox**; 2nd gen emphasizes full Linux compatibility (so isolation properties differ). ([cloud.google.com](https://cloud.google.com/run/docs/container-contract?utm_source=openai))

---

## What to pick (fast heuristic)
- **Maximum isolation for untrusted code:** microVM-based offerings like **Vercel Sandbox**, **Fly Machines**, **CodeSandbox SDK**. ([vercel.com](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai))  
- **Massively parallel test/eval runs with good policy controls:** **Modal Sandboxes**. ([modal.com](https://modal.com/products/sandboxes?utm_source=openai))  
- **Edge-native + Worker orchestration:** **Cloudflare Sandbox SDK**. ([developers.cloudflare.com](https://developers.cloudflare.com/sandbox/?utm_source=openai))  
- **Full control / compliance / private networking needs:** self-host **Piston** or use **GKE Sandbox/Agent Sandbox**. ([github.com](https://github.com/engineer-man/piston?utm_source=openai))  

## 3 clarifying questions (so I can narrow to 1–2 best options)
1) Which languages/runtimes must run (Python/Node only, or “any language”)?  
2) Do you need **outbound internet** during tests (pip/npm/git), and do you need **domain allowlists**?  
3) Do you need **persistence/snapshots** across multiple agent steps, or is each run fully ephemeral?

Answer those and I’ll recommend the best-fit alternative with a concrete “secure test runner” setup (timeouts, egress policy, artifact capture, and secret-handling).