"use client"

"use client"
import { useState, useEffect } from "react";
import { useBrandProfile } from "@/components/brand-profile-context";
import { Campaign } from "@/lib/llm/post-process-campaigns";
import CampaignCards from "@/components/campaign-cards";
import { buildLLMTwitterPrompt } from "@/lib/llm/build-llm-twitter-prompts";
import { useSession, signIn, signOut } from "next-auth/react";

const STORAGE_KEY = "mudra_campaigns";

function parseCampaignsFromString(result: string): Campaign[] {
  try {
    const start = result.indexOf("[");
    const end = result.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = result.slice(start, end + 1);
      const cleaned = jsonStr.replace(/,\s*([\]}])/g, "$1");
      return JSON.parse(cleaned);
    }
    return JSON.parse(result);
  } catch {
    return [{ title: "Raw Output", description: result } as Campaign];
  }
}

export function CampaignGenerator() {
  const { profile } = useBrandProfile();
  const { data: session, status } = useSession();
  const [result, setResult] = useState<Campaign[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tweetPrompt, setTweetPrompt] = useState<string>("");
  const [tweetExamples, setTweetExamples] = useState<any[]>([]);
  const [tweetLoading, setTweetLoading] = useState(false);
  const [tweetError, setTweetError] = useState<string | null>(null);
  const [tweets, setTweets] = useState<string[]>([]);
  const [twitterAuthLoading, setTwitterAuthLoading] = useState(false);
  const [twitterAuthError, setTwitterAuthError] = useState<string | null>(null);

  useEffect(() => {
    const storedCampaigns = localStorage.getItem(STORAGE_KEY);
    if (storedCampaigns) {
      try {
        setResult(JSON.parse(storedCampaigns));
      } catch {}
    }
    const storedTweets = localStorage.getItem("mudra_tweets");
    if (storedTweets) {
      try {
        setTweets(JSON.parse(storedTweets));
      } catch {}
    }
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/llm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandProfile: profile })
      });
      if (!res.ok) throw new Error("Failed to generate campaigns");
      const json = await res.json();
      let campaigns: Campaign[] = [];
      if (typeof json.result === "string") {
        campaigns = parseCampaignsFromString(json.result);
      } else if (Array.isArray(json.result)) {
        campaigns = json.result;
      }
      setResult(campaigns);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Parse tweets for rendering
  let parsedTweets: { tweet: string }[] = [];
  if (tweets.length > 0) {
    try {
      if (typeof tweets[0] === "string" && tweets.length === 1) {
        let raw = tweets[0].trim();
        if (raw.startsWith("```")) raw = raw.replace(/```[a-zA-Z]*\n?/, "");
        if (raw.endsWith("```")) raw = raw.replace(/```$/, "");
        raw = raw.trim();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsedTweets = parsed;
      } else if (Array.isArray(tweets)) {
        parsedTweets = tweets.map((t: any) => {
          if (typeof t === "string") {
            let raw = t.trim();
            if (raw.startsWith("```")) raw = raw.replace(/```[a-zA-Z]*\n?/, "");
            if (raw.endsWith("```")) raw = raw.replace(/```$/, "");
            raw = raw.trim();
            try {
              const parsed = JSON.parse(raw);
              return parsed.tweet ? parsed : { tweet: raw };
            } catch {
              return { tweet: raw };
            }
          } else if (typeof t === "object" && t !== null && "tweet" in t) {
            return t;
          } else {
            return { tweet: JSON.stringify(t) };
          }
        });
      }
    } catch {
      parsedTweets = [];
    }
  }

  return (
    <div>
      {/* NextAuth login/logout buttons */}
      {status === "authenticated" ? (
        <div className="mb-4 flex items-center gap-4">
          <span className="text-green-700">Logged in as {session.user?.name || session.user?.email || "Twitter user"}</span>
          <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => signOut()}>Logout</button>
        </div>
      ) : (
        <button className="bg-blue-600 text-white px-4 py-2 rounded mb-4 mr-2" onClick={() => signIn("twitter")}>Login with Twitter</button>
      )}
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4 mr-2"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate Campaigns"}
      </button>
      {twitterAuthError && <div className="text-red-500 mt-2">{twitterAuthError}</div>}
      <button
        className="bg-green-600 text-white px-4 py-2 rounded mb-4"
        onClick={async () => {
          setTweetLoading(true)
          setTweetError(null)
          setTweetPrompt("")
          setTweets([])
          try {
            // Query vector store for tweet examples
            const res = await fetch("/api/llm/query-tweets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ brandProfile: profile, n_results: 5 })
            })
            if (!res.ok) throw new Error("Failed to fetch tweet examples")
            const json = await res.json()
            setTweetExamples(json.results || [])
            // Build LLM prompt for tweet generation
            const prompt = buildLLMTwitterPrompt({ brandProfile: profile, tweetExamples: json.results || [] })
            setTweetPrompt(prompt)
            // Call LLM to generate tweets
            const tweetRes = await fetch("/api/llm/generate-tweets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ brandProfile: profile, tweetExamples: json.results || [] })
            })
            if (!tweetRes.ok) throw new Error("Failed to generate tweets")
            const tweetJson = await tweetRes.json()
            // Parse tweets from LLM output (expecting a JSON array)
            let tweetsArr: string[] = []
            try {
              const arr = JSON.parse(tweetJson.result)
              if (Array.isArray(arr)) {
                tweetsArr = arr.map((t: any) => t.tweet || t.text || JSON.stringify(t)).slice(0, 3)
              }
            } catch {
              tweetsArr = [tweetJson.result]
            }
            setTweets(tweetsArr)
            localStorage.setItem("mudra_tweets", JSON.stringify(tweetsArr));
          } catch (e: any) {
            setTweetError(e.message || "Unknown error")
          } finally {
            setTweetLoading(false)
          }
        }}
        disabled={tweetLoading}
      >
        {tweetLoading ? "Loading..." : "Tweet Generator"}
      </button>
      {error && <div className="text-red-500 mt-2">{error}</div>}
      {result && <div className="mt-6"><CampaignCards campaigns={result} /></div>}
      {tweetError && <div className="text-red-500 mt-2">{tweetError}</div>}
      {/* Do not show the generated LLM prompt, only show the LLM output (tweets) */}
      {parsedTweets.length > 0 && (
        <div className="mt-6">
          <div className="font-bold mb-2">Generated Tweets:</div>
          <div className="flex flex-row gap-4">
            {parsedTweets.slice(0, 3).map((tweetObj, i) => (
              <div key={i} className="flex-1 border border-blue-300 rounded-lg p-4 text-center text-lg font-semibold shadow flex flex-col items-center justify-between" style={{ minWidth: 0, background: "inherit" }}>
                <div className="mb-4">{tweetObj.tweet}</div>
                <div className="flex flex-row gap-2">
                  <button
                    className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
                    onClick={() => navigator.clipboard.writeText(tweetObj.tweet)}
                  >
                    Copy
                  </button>
                  <button
                    className="bg-green-200 hover:bg-green-300 px-3 py-1 rounded text-sm"
                    onClick={() => alert('Thumbs up!')}
                  >
                    👍
                  </button>
                  <button
                    className="bg-red-200 hover:bg-red-300 px-3 py-1 rounded text-sm"
                    onClick={() => alert('Thumbs down!')}
                  >
                    👎
                  </button>
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                    onClick={async () => {
                      if (!session || !session.accessToken) {
                        alert("You must log in with Twitter before posting a tweet.");
                        return;
                      }
                      const response = await fetch("/api/llm/execute-tweet", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          tweet: tweetObj.tweet,
                          bearer_token: session.accessToken
                        })
                      });
                      const result = await response.json();
                      if (result.results && result.results[0].status === "success") {
                        alert("Tweet posted successfully! ID: " + result.results[0].id);
                      } else {
                        alert("Error posting tweet: " + (result.results && result.results[0].error));
                      }
                    }}
                  >
                    Execute
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
