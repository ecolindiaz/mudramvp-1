# Run 08
> **ID:** `resp_0d0afcdf832943c600699d709debd88196b3015297bb9db569`

## Token Usage
- Input: 22,812
- Output: 3,426
- Reasoning: 2,027
- Total: 26,238

## Search Calls

### Search 1: `e2b.dev sandbox for AI agents secure code execution`
  - e2b.dev sandbox for AI agents secure code execution
  - Judge0 API run untrusted code sandbox
  - nsjail sandbox untrusted code execution
  - AWS Firecracker microVM run untrusted code

### Search 2: `Daytona sandbox AI agents code execution`
  - Daytona sandbox AI agents code execution
  - Vercel Sandboxes code execution secure
  - Northflank microVM sandbox code execution product
  - Modal sandboxes run untrusted code isolation gVisor

### Search 3: `Cloudflare Sandboxes code execution isolates product`
  - Cloudflare Sandboxes code execution isolates product
  - together ai sandbox microvm code execution
  - Modal gVisor isolation documentation
  - Vercel Sandbox documentation Firecracker microVM

## Sites Referenced

- [E2B | The Enterprise AI Agent Cloud](https://e2b.dev/ai-agents/b2-ai?utm_source=openai)
- [Understanding Sandboxes](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai)
- [Security model · Cloudflare Sandbox SDK docs](https://developers.cloudflare.com/sandbox/concepts/security/?utm_source=openai)
- [Secure sandboxes for multi-tenant workloads — Northflank](https://northflank.com/product/sandboxes?utm_source=openai)
- [Together Code Sandbox - Together.ai Docs](https://docs.together.ai/docs/together-code-sandbox?utm_source=openai)
- [Build a Coding Agent Using Codex SDK and Daytona | Daytona](https://www.daytona.io/docs/en/codex-sdk-interactive-terminal-sandbox?utm_source=openai)
- [AI Agent Sandbox - Fast, Secure & E2B-Compatible AI Runtime | Novita AI](https://novita.ai/sandbox?utm_source=openai)
- [GitHub - zerocore-ai/microsandbox: self-hosted plaform for secure execution of untrusted user or AI-generated code](https://github.com/zerocore-ai/microsandbox?utm_source=openai)
- [GitHub - openedx/codejail: Secure code execution](https://github.com/openedx/codejail?utm_source=openai)
- [Codemode · Cloudflare Agents docs](https://developers.cloudflare.com/agents/api-reference/codemode/?utm_source=openai)
- [Sandbox SDK Reference](https://vercel.com/docs/vercel-sandbox/sdk-reference?utm_source=openai)
- [Cloudflare Sandboxes - Secure Code Execution](https://workers.cloudflare.com/product/sandboxes?utm_source=openai)

## Products Mentioned

Cloudflare, CodeSandbox, Daytona, E2B, Firecracker, Northflank, Novita, Spin, Vercel Sandbox

## Final Report

If you’re using **E2B** as a way to **execute/test AI-generated (untrusted) code in isolation**, these are the closest alternatives—grouped by *security model* and typical use case. (E2B itself emphasizes **Firecracker microVM isolation** and fresh sandboxes for CI-style runs.) ([e2b.dev](https://e2b.dev/ai-agents/b2-ai?utm_source=openai))

## Managed “sandbox execution APIs” (closest to E2B)

### 1) **Vercel Sandboxes** (microVM / Firecracker)
- **Best for:** teams already on Vercel; want an SDK to spin up isolated Linux environments to run untrusted code.
- **Security/isolation:** each sandbox runs in a **Firecracker microVM** (dedicated kernel), with configurable network policies (including deny-all). ([vercel.com](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai))
- **Notes:** Vercel docs describe Amazon Linux 2023 base and that sandboxes provision in `iad1`. ([vercel.com](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai))

### 2) **Cloudflare Sandboxes** (Cloudflare Containers-backed; “VM per sandbox”)
- **Best for:** running sandboxes *from* Cloudflare Workers / Cloudflare ecosystem; “bring your own image” container workflow.
- **Security/isolation:** Cloudflare describes each sandbox as running in its **own VM** with filesystem/process/network isolation and resource limits. ([developers.cloudflare.com](https://developers.cloudflare.com/sandbox/concepts/security/?utm_source=openai))

### 3) **Northflank Sandboxes** (microVMs; can run in your VPC)
- **Best for:** **BYOC / VPC** needs, multi-tenant platforms, longer-lived or higher-scale workloads than a simple “code runner.”
- **Security/isolation:** positioned as microVM-based sandboxes for untrusted code at scale, in their cloud or your VPC. ([northflank.com](https://northflank.com/product/sandboxes?utm_source=openai))

### 4) **Together Code Sandbox / Together Code Interpreter** (CodeSandbox microVM infrastructure)
- **Best for:** productizing “code interpreter” experiences with strong snapshot/clone workflows.
- **What it is:** Together’s docs say sandboxes run on CodeSandbox’s **microVM infrastructure**, with fast template cloning and snapshot/restore flows. ([docs.together.ai](https://docs.together.ai/docs/together-code-sandbox?utm_source=openai))
- **Note:** availability may depend on plan (Together mentions custom plans; alternatively self-serve via CodeSandbox account). ([docs.together.ai](https://docs.together.ai/docs/together-code-sandbox?utm_source=openai))

### 5) **Daytona** (agent-focused sandboxes)
- **Best for:** “coding agent in a sandbox” workflows (interactive terminals, stateful workspaces).
- **Positioning:** Daytona explicitly documents running OpenAI Codex-style agents inside “Daytona sandboxes,” and markets as secure execution for AI-generated code. ([daytona.io](https://www.daytona.io/docs/en/codex-sdk-interactive-terminal-sandbox?utm_source=openai))

### 6) **Novita AI – Agent Sandbox**
- **Best for:** another hosted “agent runtime/sandbox” option to evaluate.
- **Caveat:** I could only confirm high-level claims (startup speed, isolation, concurrency) because the page is JS-heavy. ([novita.ai](https://novita.ai/sandbox?utm_source=openai))

## “Build it yourself” / self-hosted components

### 7) **microsandbox** (self-hosted microVM sandboxing)
- **Best for:** you want E2B-like isolation but **self-hosted** (more control/compliance).
- **What it is:** an open-source repo describing a self-hosted platform for executing untrusted user/AI code using microVM-style isolation. ([github.com](https://github.com/zerocore-ai/microsandbox?utm_source=openai))

### 8) **CodeJail** (Python-focused, AppArmor-based)
- **Best for:** self-hosted **Python** execution with OS policy enforcement.
- **Important detail:** security relies on **proper AppArmor support/config**; otherwise it won’t protect execution. ([github.com](https://github.com/openedx/codejail?utm_source=openai))

## If you only need *JavaScript tool-execution*, not “full Linux”
### 9) **Cloudflare Agents “codemode”** (Worker isolate execution)
- **Best for:** executing generated **JS** with tight defaults (not a full VM/devbox).
- **Security model:** runs in isolated Workers; docs note **network access is blocked by default**, with timeouts and captured logs. ([developers.cloudflare.com](https://developers.cloudflare.com/agents/api-reference/codemode/?utm_source=openai))

---

## Quick pick guide (tell me which column you’re in)
1) **Strongest isolation for truly untrusted code** (microVM boundary): *Vercel Sandboxes, Together/CodeSandbox microVMs, Northflank, (E2B)* ([vercel.com](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai))  
2) **Need BYOC / run inside your VPC:** *Northflank* ([northflank.com](https://northflank.com/product/sandboxes?utm_source=openai))  
3) **Already on Vercel + want a clean SDK:** *Vercel Sandboxes* ([vercel.com](https://vercel.com/docs/vercel-sandbox/sdk-reference?utm_source=openai))  
4) **Edge-centric / Cloudflare stack:** *Cloudflare Sandboxes* (or codemode for JS-only) ([workers.cloudflare.com](https://workers.cloudflare.com/product/sandboxes?utm_source=openai))  
5) **Self-host / air-gapped-ish:** *microsandbox* or *CodeJail* ([github.com](https://github.com/zerocore-ai/microsandbox?utm_source=openai))  

If you answer these 4 questions, I’ll narrow it to 1–2 best fits and suggest a secure testing pattern (timeouts, egress policy, secrets handling, artifact capture):
1) Languages you need to execute (Python/Node/“any Linux binary”)?  
2) Do you need **internet egress** during tests, or must it be deny-all?  
3) SaaS is OK, or must be **self-host / VPC**?  
4) Typical runtime per test (seconds vs 30–60 min vs hours)?