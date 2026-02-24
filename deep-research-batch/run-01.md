# Run 01
> **ID:** `resp_06bf7c14de0e670a00699d709a5d4c8196865c363e73d37427`

## Token Usage
- Input: 24,382
- Output: 3,424
- Reasoning: 2,181
- Total: 27,806

## Search Calls

### Search 1: `e2b.dev product secure sandboxed code execution AI agents`
  - e2b.dev product secure sandboxed code execution AI agents
  - alternatives to E2B sandbox code execution API
  - Piston API sandboxed code execution open source
  - Modal secure sandbox python code execution containers

### Search 2: `Daytona.io workspace provisioning for AI agents sandboxes`
  - Daytona.io workspace provisioning for AI agents sandboxes
  - Vercel Sandbox beta Firecracker 45 minute limit
  - Cloudflare Workers V8 isolates security model
  - gVisor runsc container sandboxing untrusted code

### Search 3: `daytona.io documentation workspace api provisioning milliseconds`
  - daytona.io documentation workspace api provisioning milliseconds
  - Daytona AI agent sandbox firecracker
  - gVisor documentation runsc sandboxed container runtime
  - Kata Containers sandboxed containers VM isolation untrusted code

### Search 4: `Judge0 API sandbox code execution Isolate security`
  - Judge0 API sandbox code execution Isolate security
  - Google Cloud Run sandbox untrusted code best practices gVisor
  - AWS Lambda Firecracker microVM isolation run untrusted code
  - Google Cloud Batch sandbox run untrusted user code

### Search 5: `Vertex AI Agent Engine Code Execution documentation preview stateful sandbox up to 14 days`
  - Vertex AI Agent Engine Code Execution documentation preview stateful sandbox up to 14 days
  - Google Vertex AI Agent Engine code execution sandbox API reference
  - Judge0 open source code execution system Isolate
  - OpenAI code interpreter sandbox product for agents API

## Sites Referenced

- [E2B | The Enterprise AI Agent Cloud](https://e2b.dev/ai-agents/b2-ai?utm_source=openai)
- [Sandboxes | Modal Docs](https://modal.com/docs/guide/sandboxes?utm_source=openai)
- [Daytona | Secure AI Code Execution Platform](https://daytonadocs.com/?utm_source=openai)
- [Agent Sandbox - Secure Code Execution API for AI Agents](https://www.agentsandbox.co/?utm_source=openai)
- [Vercel Sandbox pricing and limits](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai)
- [Agent Engine Code Execution  |  Vertex AI Agent Builder  |  Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/code-execution/overview?utm_source=openai)
- [Introducing the Amazon Bedrock AgentCore Code Interpreter | Artificial Intelligence](https://aws.amazon.com/blogs/machine-learning/introducing-the-amazon-bedrock-agentcore-code-interpreter/?utm_source=openai)
- [Code Interpreter | OpenAI API](https://platform.openai.com/docs/guides/tools-code-interpreter?utm_source=openai)
- [Security model · Cloudflare Workers docs](https://developers.cloudflare.com/workers/reference/security-model/?utm_source=openai)
- [What is gVisor? - gVisor](https://gvisor.dev/docs/?utm_source=openai)
- [GKE Sandbox  |  GKE security  |  Google Cloud Documentation](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods?utm_source=openai)
- [Pod Sandboxing with Azure Kubernetes Service (AKS) - Azure Kubernetes Service | Microsoft Learn](https://learn.microsoft.com/en-us/azure/aks/use-pod-sandboxing?utm_source=openai)
- [Code execution in Cloud Run  |  Google Cloud Documentation](https://docs.cloud.google.com/run/docs/code-execution?utm_source=openai)
- [GitHub - engineer-man/piston: A high performance general purpose code execution engine.](https://github.com/engineer-man/piston?utm_source=openai)
- [GitHub - openedx/codejail: Secure code execution](https://github.com/openedx/codejail?utm_source=openai)
- [GitHub - Katakate/k7: Your own self-hosted infra for lightweight VM sandboxes to safely execute untrusted code. CLI, API, Python SDK. ⭐ Star it if you like it! ⭐](https://github.com/Katakate/k7?utm_source=openai)
- [GitHub - judge0/judge0: Robust, fast, scalable, and sandboxed open-source online code execution system for humans and AI.](https://github.com/judge0/judge0?utm_source=openai)

## Products Mentioned

Cloudflare, Daytona, Docker, E2B, Firecracker, GKE Sandbox, Judge0, Kata Containers, Modal, Piston, Vercel Sandbox, gVisor

## Final Report

If you’re using **E2B** mainly as a **secure, isolated runtime to execute/test LLM-generated code** (E2B runs each sandbox on Firecracker microVMs), these are the most common alternatives—grouped by “managed like E2B” vs “self-host / build-your-own”. ([e2b.dev](https://e2b.dev/ai-agents/b2-ai?utm_source=openai))

## Managed sandboxes (closest to E2B’s “API to run untrusted code”)
- **Modal Sandboxes** — managed “secure containers for executing untrusted user or agent code”, good for running test suites/linting against generated code. ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))  
- **Daytona** — positioned specifically for “secure… execution… for AI-generated code and agent workflows” (including state/persistence and “computer use” style sandboxes). ([daytonadocs.com](https://daytonadocs.com/?utm_source=openai))  
- **Agent Sandbox (agentsandbox.co)** — managed secure execution API oriented around agents, plus files/artifacts in/out and dependency install manifests. ([agentsandbox.co](https://www.agentsandbox.co/?utm_source=openai))  
- **Vercel Sandbox (Beta)** — managed sandboxes for **Node.js or Python**, with explicit duration/concurrency limits depending on plan (Hobby up to 45 min; Pro/Ent up to 5 hours). ([vercel.com](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai))  
- **Google Vertex AI Agent Engine – Code Execution (Preview)** — managed **secure, isolated sandbox**; fast create/exec; state TTL up to 14 days; **no network access**; currently region-limited (for example `us-central1`). ([docs.cloud.google.com](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/code-execution/overview?utm_source=openai))  
- **AWS Bedrock AgentCore – Code Interpreter** — managed secure sandbox for agent code execution (Python/JavaScript/TypeScript), with session state + configurable network policies (isolated vs controlled public). ([aws.amazon.com](https://aws.amazon.com/blogs/machine-learning/introducing-the-amazon-bedrock-agentcore-code-interpreter/?utm_source=openai))  
- **OpenAI API – Code Interpreter tool** — easiest if you’re already on OpenAI and only need **Python** execution in a sandbox as part of model tool-use. ([platform.openai.com](https://platform.openai.com/docs/guides/tools-code-interpreter?utm_source=openai))  

## “Edge isolate” option (great isolation, but not a full Linux box)
- **Cloudflare Workers** — runs code in **V8 isolates** (fast, strong tenant isolation model), but it’s not a general-purpose Linux VM/container environment (language/runtime constraints apply). ([developers.cloudflare.com](https://developers.cloudflare.com/workers/reference/security-model/?utm_source=openai))  

## Self-host / build-your-own (best control, more work)
### Run code in containers, but hardened for untrusted workloads
- **gVisor (`runsc`)** — OCI runtime that adds a strong isolation layer between containers and the host; can be used directly with Docker/Kubernetes. ([gvisor.dev](https://gvisor.dev/docs/?utm_source=openai))  
- **GKE Sandbox (uses gVisor)** — Google’s “extra layer of security” for pods running unknown/untrusted code. ([docs.cloud.google.com](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods?utm_source=openai))  
- **AKS Pod Sandboxing** — Azure mechanism to run pods in isolated lightweight “pod VMs” for untrusted/malicious code scenarios. ([learn.microsoft.com](https://learn.microsoft.com/en-us/azure/aks/use-pod-sandboxing?utm_source=openai))  
- **Cloud Run “code sandbox tool” approach** — Google explicitly describes hosting a sandbox in Cloud Run and recommends tightening IAM + VPC/firewall to restrict internet access. ([docs.cloud.google.com](https://docs.cloud.google.com/run/docs/code-execution?utm_source=openai))  

### Purpose-built code-execution engines (you host the API)
- **Piston** (open source) — executes many languages in an Isolate-based sandbox; disables outgoing network by default and enforces process/file/time/memory/output limits. ([github.com](https://github.com/engineer-man/piston?utm_source=openai))  
- **CodeJail** (open source, Python-focused) — uses AppArmor profiles for confinement (depends on correct OS/AppArmor setup). ([github.com](https://github.com/openedx/codejail?utm_source=openai))  
- **K7 (Kata Containers / Firecracker-based)** — self-hosted infra for lightweight VM sandboxes; explicitly markets VM isolation via Kata/Firecracker. ([github.com](https://github.com/Katakate/k7?utm_source=openai))  
- **Judge0** — popular multi-language engine, but it’s had serious sandbox-escape style vulns reported in the past; only consider with strong hardening and careful, up-to-date patching. ([github.com](https://github.com/judge0/judge0?utm_source=openai))  

---

## What to pick (quick guidance)
- **Need “any language / run arbitrary Linux commands” like E2B:** Modal Sandboxes, Daytona, Agent Sandbox; or self-host with Docker+gVisor/Kata.
- **Need strong cloud-provider controls/compliance:** Vertex AI Code Execution or AWS AgentCore Code Interpreter. ([docs.cloud.google.com](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/code-execution/overview?utm_source=openai))  
- **Need to keep costs low + self-host:** Piston, Docker+gVisor, or Kata/Firecracker-based stacks. ([github.com](https://github.com/engineer-man/piston?utm_source=openai))  

## 3 questions to narrow this to the best 2–3 options
1) What languages do you need to execute (Python only, or arbitrary Linux + compilers)?  
2) Should the sandbox have **internet access**, or must it be **blocked by default**?  
3) Do you need **self-hosting** (for IP/compliance), or is a managed API okay?