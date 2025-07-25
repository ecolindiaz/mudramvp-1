# Tweet Execution Agent (X API v2)
# This script receives a tweet (or list of tweets) and posts them to X (Twitter) using the v2 API and OAuth 2.0 Bearer Token.
# It should be called from your Next.js backend when a campaign includes tweet actions.
#
# Requirements:
#   pip install fastapi requests uvicorn
#
# Usage:
#   uvicorn tweet_execution_agent:app --host 0.0.0.0 --port 8000

import os
import requests
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import traceback
import sys

app = FastAPI()

print("Python executable:", sys.executable)




class TweetRequest(BaseModel):
    tweets: list[str]
    bearer_token: str  # OAuth 2.0 Bearer Token



from fastapi import Body
import json



@app.post("/execute-tweets")
async def execute_tweets(request: Request):
    raw_body = await request.body()
    print("Raw request body:", raw_body)
    try:
        data = json.loads(raw_body)
    except Exception as e:
        print("Error parsing JSON body:", e)
        raise HTTPException(status_code=400, detail="Invalid JSON body.")
    print("Parsed request data:", data)
    tweets = data.get("tweets")
    bearer_token = data.get("bearer_token")
    if not bearer_token:
        print("Missing bearer token.")
        raise HTTPException(status_code=400, detail="Missing Bearer Token.")
    if not isinstance(tweets, list):
        print("'tweets' must be a list of strings.")
        raise HTTPException(status_code=400, detail="'tweets' must be a list of strings.")
    results = []
    for tweet in tweets:
        try:
            url = "https://api.twitter.com/2/tweets"
            headers = {
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json"
            }
            payload = {"text": tweet}
            print(f"Posting to {url} with payload: {payload}")
            response = requests.post(url, headers=headers, json=payload)
            print("Response status:", response.status_code)
            print("Response body:", response.text)
            if response.status_code in [200, 201]:
                post_id = response.json().get("data", {}).get("id")
                results.append({"tweet": tweet, "status": "success", "id": post_id})
            else:
                results.append({"tweet": tweet, "status": "error", "error": response.text})
        except Exception as e:
            print("Error posting tweet:", e)
            traceback.print_exc()
            results.append({"tweet": tweet, "status": "error", "error": str(e)})
    print("Results:", results)
    return {"results": results}

# To use: POST to /execute-tweets with the tweet(s), bearer_token, and user_id.
