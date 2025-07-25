import faiss
import json
import numpy as np
from fastapi import FastAPI, Request
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModel
import torch
import os


app = FastAPI()
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
transformer_model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

def mean_pooling(model_output, attention_mask):
    token_embeddings = model_output[0] # First element of output contains token embeddings
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)


# Load tweets (assume each tweet is a dict with 'content')
TWEETS_PATH = os.path.join(os.path.dirname(__file__), "dataset", "twitter_case_studies.json")
with open(TWEETS_PATH, "r", encoding="utf-8") as f:
    tweets = json.load(f)
texts = [t["text"] for t in tweets]

def get_embeddings(text_list):
    # Tokenize sentences
    encoded_input = tokenizer(text_list, padding=True, truncation=True, return_tensors='pt')
    # Compute token embeddings
    with torch.no_grad():
        model_output = transformer_model(**encoded_input)
    # Perform pooling
    sentence_embeddings = mean_pooling(model_output, encoded_input['attention_mask'])
    return sentence_embeddings.cpu().numpy().astype("float32")

embeddings = get_embeddings(texts)

# Build FAISS index
index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(embeddings)


class BrandProfile(BaseModel):
    name: str
    tagline: str = ""
    description: str = ""
    target_audience: str = ""
    tone: str = ""
    stage: str = ""
    goals: list[str] = []

@app.post("/query-tweets")
async def query_tweets(profile: BrandProfile, n_results: int = 5):
    # Build query string from brand profile
    query_text = f"{profile.tagline}. {profile.description} Targeting {profile.target_audience}. Tone: {profile.tone}. Goals: {', '.join(profile.goals)}."
    query_emb = get_embeddings([query_text])
    D, I = index.search(query_emb, n_results)
    results = [tweets[i] for i in I[0]]
    return {"results": results}
