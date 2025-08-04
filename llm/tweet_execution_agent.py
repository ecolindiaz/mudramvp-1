# Tweet Execution Agent (X API v2)
# This script receives a tweet (or list of tweets) and posts them to X (Twitter) using the v2 API and OAuth 2.0 Bearer Token.
# It should be called from your Next.js backend when a campaign includes tweet actions.
#
# Requirements:
#   pip install fastapi requests uvicorn
#
# Usage:
#   uvicorn tweet_execution_agent:app --host 0.0.0.0 --port 8001

import os
from pathlib import Path
from dotenv import load_dotenv
import requests
from requests_oauthlib import OAuth1
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import traceback
import sys



# Load .env.local from the mudra-app directory (sibling to llm)
dotenv_path = Path(__file__).parent.parent / "mudra-app" / ".env.local"
if dotenv_path.exists():
    load_dotenv(dotenv_path)
    print(f"Loaded environment variables from {dotenv_path}")
else:
    print(f"Warning: {dotenv_path} does not exist. Twitter credentials may be missing.")

app = FastAPI()

print("Python executable:", sys.executable)




class TweetRequest(BaseModel):
    tweets: list[str]
    access_token: str  # OAuth 1.0a user access token
    access_token_secret: str  # OAuth 1.0a user access token secret



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
    access_token = data.get("access_token")
    access_token_secret = data.get("access_token_secret")
    if not access_token or not access_token_secret:
        print("Missing access token or secret. You must send both 'access_token' and 'access_token_secret' in the request body.")
        raise HTTPException(status_code=400, detail="Missing access token or secret. You must send both 'access_token' and 'access_token_secret' in the request body.")
    if not isinstance(tweets, list):
        print("'tweets' must be a list of strings.")
        raise HTTPException(status_code=400, detail="'tweets' must be a list of strings.")

    consumer_key = os.environ.get("TWITTER_CONSUMER_KEY")
    consumer_secret = os.environ.get("TWITTER_CONSUMER_SECRET")
    print(f"Consumer key: {consumer_key}, Consumer secret: {consumer_secret}")

    if not consumer_key or not consumer_secret:
        raise HTTPException(status_code=500, detail="Missing Twitter app credentials.")

    results = []
    for tweet in tweets:
        try:
            url = "https://api.twitter.com/2/tweets"
            auth = OAuth1(
                consumer_key,
                consumer_secret,
                access_token,
                access_token_secret,
                signature_type='auth_header'
            )
            payload = {"text": tweet}
            print(f"Posting to {url} with payload: {payload}")
            response = requests.post(url, auth=auth, json=payload)
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
