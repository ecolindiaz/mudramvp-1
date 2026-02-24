# Run 03
> **ID:** `resp_0b1d323a73c9126b00699d709b2644819090416d6b6551fed4`

## Token Usage
- Input: 22,830
- Output: 3,112
- Reasoning: 1,748
- Total: 25,942

## Search Calls

### Search 1: `e2b.dev secure sandbox for AI generated code testing alternatives`
  - e2b.dev secure sandbox for AI generated code testing alternatives
  - open source sandboxed code execution platform firecracker gvisor alternatives for LLM code execution
  - Modal sandboxed execution LLM agent code runner
  - Daytona dev environment API sandbox for agents

### Search 2: `Daytona.io AI agent sandbox sub-90ms provisioning`
  - Daytona.io AI agent sandbox sub-90ms provisioning
  - Vercel Sandbox beta Firecracker 45 minute limit
  - Northflank isolation Firecracker Kata gVisor secure untrusted code execution
  - Google Cloud Run gVisor sandbox untrusted code execution

### Search 3: `nsjail Linux seccomp namespace sandbox untrusted code GitHub`
  - nsjail Linux seccomp namespace sandbox untrusted code GitHub
  - Google Sandbox2 seccomp namespaces sandbox2 open source
  - Kata Containers microVM container runtime Firecracker
  - AWS Firecracker microVM open source runtime secure sandbox untrusted code

## Sites Referenced

- [Modal Sandboxes are generally available](https://modal.com/blog/sandbox-launch?utm_source=openai)
- [Solutions - Coding agents | Modal](https://modal.com/solutions/coding-agents?utm_source=openai)
- [Vercel Sandbox pricing and limits](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai)
- [Codemode · Cloudflare Agents docs](https://developers.cloudflare.com/agents/api-reference/codemode/?utm_source=openai)
- [Build a Coding Agent Using Codex SDK and Daytona | Daytona](https://www.daytona.io/docs/en/codex-sdk-interactive-terminal-sandbox?utm_source=openai)
- [Code execution in Cloud Run  |  Google Cloud](https://cloud.google.com/run/docs/code-execution?utm_source=openai)
- [Isolate AI code execution with Agent Sandbox  |  GKE AI/ML  |  Google Cloud Documentation](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/agent-sandbox?utm_source=openai)
- [Secure runtime for codegen tools: microVMs, sandboxing, and execution at scale | Blog — Northflank](https://northflank.com/blog/secure-runtime-for-codegen-tools-microvms-sandboxing-and-execution-at-scale?utm_source=openai)
- [How to spin up a secure code sandbox & microVM in seconds with Northflank | Blog — Northflank](https://northflank.com/blog/how-to-spin-up-a-secure-code-sandbox-and-microvm-in-seconds-with-northflank-firecracker-gvisor-kata-clh?utm_source=openai)
- [RespCode — Multi-Model AI Code Generation & Sandbox Execution](https://respcode.com/?utm_source=openai)
- [RespCode Documentation - Multi-Model AI Code Generation](https://respcode.com/docs?utm_source=openai)
- [GitHub - firecracker-microvm/firecracker-containerd: firecracker-containerd enables containerd to manage containers as Firecracker microVMs](https://github.com/firecracker-microvm/firecracker-containerd?utm_source=openai)
- [Deploying microVM on Top of Kubernetes | Blog](https://katacontainers.org/blog/deploying-microvm-on-top-of-kubernetes/?utm_source=openai)
- [GKE Sandbox  |  GKE security  |  Google Cloud Documentation](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods?utm_source=openai)
- [GitHub - google/nsjail: A lightweight process isolation tool that utilizes Linux namespaces, cgroups, rlimits and seccomp-bpf syscall filters, leveraging the Kafel BPF language for enhanced security.](https://github.com/google/nsjail?utm_source=openai)
- [What is Sandbox2?  |  Code Sandboxing  |  Google for Developers](https://developers.google.com/code-sandboxing/sandbox2?utm_source=openai)
- [GitHub - netblue30/firejail: Linux namespaces and seccomp-bpf sandbox](https://github.com/netblue30/firejail?utm_source=openai)
- [GitHub - instavm/coderunner: A secure local sandbox to run LLM-generated code using Apple containers](https://github.com/BandarLabs/coderunner?utm_source=openai)

## Products Mentioned

Cloudflare, Coder, Daytona, E2B, Firecracker, GKE Sandbox, Google Cloud Run, Kata Containers, Modal, Northflank, Spin, Vercel Sandbox, gVisor, nsjail

## Final Report

## Cloud/hosted “E2B-like” sandboxes (run untrusted AI-generated code)

| Option | Isolation model | Good fit | Notes / limits |
|---|---|---|---|
| **Modal Sandboxes** | Container sandboxing with **gVisor**, plus controls around networking, observability, etc. ([modal.com](https://modal.com/blog/sandbox-launch?utm_source=openai)) | Production-ish agent/code-runner backends where you want a managed platform | Explicitly positioned for “untrusted code,” and they call out granular outbound networking control. ([modal.com](https://modal.com/solutions/coding-agents?utm_source=openai)) |
| **Vercel Sandbox (beta)** | (Vercel-managed sandbox) | If you’re already on Vercel and need quick Node/Python execution for tools/agents | Node.js or Python; runtime limits depend on plan (e.g., Hobby 45 min; Pro/Ent up to 5 hours). ([vercel.com](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai)) |
| **Cloudflare Workers + Codemode (beta)** | Executes generated TypeScript inside an isolated **Worker sandbox** ([developers.cloudflare.com](https://developers.cloudflare.com/agents/api-reference/codemode/?utm_source=openai)) | Tool-orchestration logic and “code that calls tools,” not arbitrary Linux | Great for *workflow code* (TypeScript) with strong isolation; not a general Linux box. ([developers.cloudflare.com](https://developers.cloudflare.com/agents/api-reference/codemode/?utm_source=openai)) |
| **Daytona** | “Sandbox” dev environments for agents | When you want an agent to install deps, run servers, and iterate like a dev box | They document running an OpenAI Codex-based agent inside a Daytona sandbox. ([daytona.io](https://www.daytona.io/docs/en/codex-sdk-interactive-terminal-sandbox?utm_source=openai)) |
| **Google Cloud Run (DIY sandbox service)** | Google describes a **two-layer sandbox** (hardware-backed + software kernel layer) ([cloud.google.com](https://cloud.google.com/run/docs/code-execution?utm_source=openai)) | If you’d rather build your own “code runner API” on managed infra | Google explicitly recommends restricting IAM + VPC/firewall rules for untrusted code. ([cloud.google.com](https://cloud.google.com/run/docs/code-execution?utm_source=openai)) |
| **GKE “Agent Sandbox” / GKE Sandbox (gVisor)** | Kubernetes + **gVisor** sandboxed pods ([docs.cloud.google.com](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/agent-sandbox?utm_source=openai)) | If you already run Kubernetes and want on-demand ephemeral sandboxes | More operational work, but strong controls and k8s-native workflows. ([docs.cloud.google.com](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/agent-sandbox?utm_source=openai)) |
| **Northflank microVM runtime (platform)** | MicroVM-backed isolation (often via **Kata/Firecracker**) ([northflank.com](https://northflank.com/blog/secure-runtime-for-codegen-tools-microvms-sandboxing-and-execution-at-scale?utm_source=openai)) | “Bring-your-own-container” secure execution at scale (incl. BYOC-style) | More “platform” than a simple sandbox SDK. ([northflank.com](https://northflank.com/blog/how-to-spin-up-a-secure-code-sandbox-and-microvm-in-seconds-with-northflank-firecracker-gvisor-kata-clh?utm_source=openai)) |
| **RespCode** | “Isolated sandboxes” / Firecracker microVM execution (positioned around multi-model code + execution) ([respcode.com](https://respcode.com/?utm_source=openai)) | If you like the idea of generating + running + comparing outputs in one place | More opinionated (codegen + execution), but can replace the “run it safely” part for many flows. ([respcode.com](https://respcode.com/docs?utm_source=openai)) |

---

## Self-hosted building blocks (if you want maximum control)

### VM / microVM-grade isolation
- **Firecracker**-based approach via **firecracker-containerd** (run OCI containers inside Firecracker microVMs). ([github.com](https://github.com/firecracker-microvm/firecracker-containerd?utm_source=openai))  
- **Kata Containers** (run containers “as VMs,” can use Firecracker as a VMM in some setups). ([katacontainers.org](https://katacontainers.org/blog/deploying-microvm-on-top-of-kubernetes/?utm_source=openai))  

### Process / syscall sandboxing (lighter-weight than VMs)
- **gVisor** (app-kernel approach; also the basis of GKE Sandbox). ([docs.cloud.google.com](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods?utm_source=openai))  
- **nsjail** (namespaces + cgroups + seccomp-bpf) for tight per-process sandboxes. ([github.com](https://github.com/google/nsjail?utm_source=openai))  
- **Google Sandbox2** (C++ sandbox using namespaces/seccomp; part of Sandboxed API). ([developers.google.com](https://developers.google.com/code-sandboxing/sandbox2?utm_source=openai))  
- **Firejail** (pragmatic Linux desktop/server sandboxing using namespaces/seccomp/caps). ([github.com](https://github.com/netblue30/firejail?utm_source=openai))  

### Local “run AI code on my machine, safely”
- **CodeRunner (MCP server, macOS)**: runs AI-generated code locally using Apple containers, positioned as VM-level isolation. ([github.com](https://github.com/BandarLabs/coderunner?utm_source=openai))  

---

## Choosing quickly (rules of thumb)
- If your threat model includes **untrusted users** (multi-tenant): prefer **microVMs** (E2B-style, Vercel Sandbox, Firecracker/Kata, Northflank microVM) or at least **gVisor** with strict egress controls. ([cloud.google.com](https://cloud.google.com/run/docs/code-execution?utm_source=openai))  
- If you mainly need the LLM to orchestrate tools safely and fast: **Cloudflare Workers/Codemode** is often enough (but it’s not a general Linux executor). ([developers.cloudflare.com](https://developers.cloudflare.com/agents/api-reference/codemode/?utm_source=openai))  
- If you need “agent devbox” behavior (install deps, run servers, previews): look at **Daytona**. ([daytona.io](https://www.daytona.io/docs/en/codex-sdk-interactive-terminal-sandbox?utm_source=openai))  

---

If you tell me:
1) languages (Python only vs “any Linux”),  
2) do you need **internet egress** from the sandbox, and  
3) hosted vs self-hosted,  
I can narrow this to 2–3 best matches and suggest a secure default policy set (timeouts, egress rules, filesystem/secrets model).