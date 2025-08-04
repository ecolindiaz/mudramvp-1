import faiss
import json
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModel
import torch
import os

app = FastAPI()
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
transformer_model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

def mean_pooling(model_output, attention_mask):
    token_embeddings = model_output[0]
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)

# Load case studies (assume each is a dict with 'text' and/or 'summary')
CASE_STUDY_PATH = os.path.join(os.path.dirname(__file__), "dataset", "twitter_case_studies.json")
with open(CASE_STUDY_PATH, "r", encoding="utf-8") as f:
    case_studies = json.load(f)
texts = [cs.get("summary") or cs.get("text") for cs in case_studies]

def get_embeddings(text_list):
    encoded_input = tokenizer(text_list, padding=True, truncation=True, return_tensors='pt')
    with torch.no_grad():
        model_output = transformer_model(**encoded_input)
    sentence_embeddings = mean_pooling(model_output, encoded_input['attention_mask'])
    return sentence_embeddings.cpu().numpy().astype("float32")

embeddings = get_embeddings(texts)

# Build FAISS index
index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(embeddings)

class QueryArgs(BaseModel):
    query: str
    n_results: int = 20

@app.post("/query-case-studies")
async def query_case_studies(args: QueryArgs):
    query_emb = get_embeddings([args.query])
    D, I = index.search(query_emb, args.n_results)
    results = [case_studies[i] for i in I[0]]
    return {"results": results}
