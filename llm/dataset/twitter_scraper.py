import json
import os
import numpy as np
from transformers import AutoTokenizer, AutoModel
import torch
import faiss
import requests
from bs4 import BeautifulSoup

"""
Scrape case study web pages about Twitter strategies and build a FAISS vector store
Each section (header + paragraphs) is embedded separately.
"""

CASE_STUDY_URLS = [
    # Add URLs of case studies on Twitter strategies here
    "https://www.socialmediaexaminer.com/how-to-create-twitter-marketing-strategy/",
    "https://buffer.com/library/twitter-case-studies/",
    "https://sproutsocial.com/insights/twitter-marketing-strategy/",
    'https://www.socialsellinator.com/social-selling-blog/twitter-marketing-case-studies/',''
    'https://medium.com/@postlyy/growing-through-engagement-5-real-case-studies-of-brand-growth-on-twitter-34523352518f/',
    'https://appliednetsci.springeropen.com/articles/10.1007/s41109-023-00593-/',
    'https://grumomedia.com/find-the-perfect-tweet-that-defines-your-startup/',
    'https://tweethunter.io/tweets/startup/',
    'https://marketingartfully.com/100-great-twitter-tweet-examples/',
    'https://www.dansiepen.io/growth-checklists/twitter-x-growth-strategies/',
    'https://www.socialmediaexplorer.com/social-media-marketing/5-twitter-marketing-strategies-to-boost-your-brand/',
    'https://startgrowimprove.com/twitter-marketing/?srsltid=AfmBOopo__C0fZYTE4M21j6QqMcVqm51EmwO47_33_xxtLe_YibK4_No/',
    'https://www.startups.com/questions/828/how-to-increase-and-maintain-the-growth-of-my-twitter-account/',
    'https://brand24.com/blog/twitter-marketing-strategy-guide/'
    # ...add more URLs as needed
]

VEC_PATH = "llm/dataset/twitter_case_studies.index"
EMB_PATH = "llm/dataset/twitter_case_studies.npy"
TEXTS_PATH = "llm/dataset/twitter_case_studies.json"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

def embed_texts(texts):
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME)
    encoded_input = tokenizer(texts, padding=True, truncation=True, return_tensors='pt')
    with torch.no_grad():
        model_output = model(**encoded_input)
    embeddings = model_output.last_hidden_state.mean(dim=1)
    return embeddings.numpy().astype("float32")

def scrape_case_study_sections():
    sections = []
    for url in CASE_STUDY_URLS:
        try:
            resp = requests.get(url, timeout=20)
            soup = BeautifulSoup(resp.text, "html.parser")
            # Find all h2/h3 headers and their following paragraphs
            for header in soup.find_all(['h2', 'h3']):
                header_text = header.get_text().strip()
                section_paragraphs = []
                # Get all sibling paragraphs until the next header
                for sib in header.find_next_siblings():
                    if sib.name in ['h2', 'h3']:
                        break
                    if sib.name == 'p' and len(sib.get_text().strip()) > 40:
                        section_paragraphs.append(sib.get_text().strip())
                if section_paragraphs:
                    section_text = header_text + "\n" + "\n".join(section_paragraphs)
                    sections.append({"url": url, "header": header_text, "text": section_text})
            # If no headers found, fallback to long paragraphs
            if not sections:
                paragraphs = soup.find_all("p")
                for p in paragraphs:
                    text = p.get_text().strip()
                    if len(text) > 100:
                        sections.append({"url": url, "header": None, "text": text})
            print(f"Scraped {url} ({len(sections)} sections)")
        except Exception as e:
            print(f"Error scraping {url}: {e}")
    return sections

def main():
    sections = scrape_case_study_sections()
    os.makedirs(os.path.dirname(TEXTS_PATH), exist_ok=True)
    with open(TEXTS_PATH, "w", encoding="utf-8") as f:
        json.dump(sections, f, ensure_ascii=False, indent=4)
    print(f"Scraped {len(sections)} sections.")

    texts = [s["text"] for s in sections]
    if not texts:
        print("No case study sections to embed. Exiting.")
        return
    embeddings = embed_texts(texts)
    np.save(EMB_PATH, embeddings)
    print(f"Saved embeddings to {EMB_PATH}")

    # Build and save FAISS index
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)
    faiss.write_index(index, VEC_PATH)
    print(f"Saved FAISS index to {VEC_PATH}")

if __name__ == "__main__":
    main()