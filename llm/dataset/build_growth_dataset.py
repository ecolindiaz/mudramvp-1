import os
import json
from newspaper import Article
from tqdm import tqdm
import nltk

nltk.download('punkt')  # For sentence tokenization
nltk.download('punkt_tab')
# 1. Define your list of URLs
URLS = [
    "https://growth.design/case-studies/duolingo-onboarding/",
    "https://andrewchen.com/dropbox-grew-3900-percent/",
    "https://www.ycombinator.com/library/6p-how-airbnb-grew",
    # Add more URLs here
]

# 2. Helper: Download and clean an article
def get_clean_text(url):
    try:
        article = Article(url)
        article.download()
        article.parse()
        article.nlp()  # optional for summary/keywords
        return {
            "title": article.title,
            "text": article.text,
            "url": url
        }
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")
        return None

# 3. Helper: Chunk text into ~500-character segments
def chunk_text(text, chunk_size=500, overlap=100):
    sentences = nltk.sent_tokenize(text)
    chunks, current_chunk = [], ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += " " + sentence
        else:
            chunks.append(current_chunk.strip())
            current_chunk = sentence
    if current_chunk:
        chunks.append(current_chunk.strip())

    # Add overlap
    final_chunks = []
    for i in range(0, len(chunks)):
        chunk = " ".join(chunks[max(0, i-1):i+1])
        final_chunks.append(chunk)

    return final_chunks

# 4. Main
def main():
    os.makedirs("llm/dataset/output", exist_ok=True)
    output_path = "llm/dataset/output/growth_chunks.jsonl"

    with open(output_path, "w", encoding="utf-8") as f:
        for url in tqdm(URLS):
            result = get_clean_text(url)
            if result:
                chunks = chunk_text(result["text"])
                for i, chunk in enumerate(chunks):
                    json.dump({
                        "id": f"{url.split('//')[-1]}_chunk_{i}",
                        "text": chunk,
                        "source": result["title"],
                        "url": result["url"]
                    }, f)
                    f.write("\n")

    print(f"\n✅ Saved {output_path}")

if __name__ == "__main__":
    main()
