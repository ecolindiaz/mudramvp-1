import axios, { AxiosInstance } from "axios"

let client: AxiosInstance | null = null

export function getDataForSEOClient(): AxiosInstance {
  if (!client) {
    const login = process.env.DATAFORSEO_LOGIN
    const password = process.env.DATAFORSEO_PASSWORD
    if (!login || !password) throw new Error("DATAFORSEO_LOGIN/PASSWORD not configured")
    client = axios.create({
      baseURL: "https://api.dataforseo.com/v3",
      auth: { username: login, password },
      headers: { "Content-Type": "application/json" },
      timeout: 30_000,
    })
  }
  return client
}
