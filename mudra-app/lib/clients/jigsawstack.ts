import { JigsawStack } from "jigsawstack"

let client: ReturnType<typeof JigsawStack> | null = null

export function getJigsawClient() {
  if (!client) {
    const apiKey = process.env.JIGSAWSTACK_API_KEY
    if (!apiKey) throw new Error("JIGSAWSTACK_API_KEY not configured")
    client = JigsawStack({ apiKey })
  }
  return client
}
