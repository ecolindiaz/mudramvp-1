import requests
from bs4 import BeautifulSoup
import pandas as pd
import time

HEADERS = {'User-Agent': 'Mozilla/5.0'}

def scrape_indie_hackers():
    print("Scraping Indie Hackers...")
    base_url = "https://www.indiehackers.com/interviews?page="
    links = set()
    for page in range(1, 10):
        url = base_url + str(page)
        soup = BeautifulSoup(requests.get(url, headers=HEADERS).text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("/interview/"):
                links.add("https://www.indiehackers.com" + href)
        time.sleep(1)
    return list(links)

def scrape_andrew_chen():
    print("Scraping Andrew Chen's blog...")
    base_url = "https://andrewchen.com"
    soup = BeautifulSoup(requests.get(base_url, headers=HEADERS).text, "html.parser")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("https://andrewchen.com/") and len(href.split("/")) > 3:
            links.add(href)
    return list(links)

def scrape_ycombinator_library():
    print("Scraping YC Library...")
    url = "https://www.ycombinator.com/library"
    soup = BeautifulSoup(requests.get(url, headers=HEADERS).text, "html.parser")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/library/"):
            links.add("https://www.ycombinator.com" + href)
    return list(links)

def scrape_lenny_archive():
    print("Scraping Lenny’s Newsletter...")
    url = "https://www.lennysnewsletter.com/archive"
    soup = BeautifulSoup(requests.get(url, headers=HEADERS).text, "html.parser")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("https://www.lennysnewsletter.com/p/"):
            links.add(href)
    return list(links)

def run_all_scrapers():
    all_links = set()
    all_links.update(scrape_indie_hackers())
    all_links.update(scrape_andrew_chen())
    all_links.update(scrape_ycombinator_library())
    all_links.update(scrape_lenny_archive())
    return list(all_links)

if __name__ == "__main__":
    print("Starting scrape...")
    links = run_all_scrapers()
    print(f"\n✅ Total unique links collected: {len(links)}")
    
    # Save to CSV and JSON
    import os
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)
    df = pd.DataFrame(links, columns=["url"])
    df.to_csv(os.path.join(output_dir, "growth_hacking_articles.csv"), index=False)
    df.to_json(os.path.join(output_dir, "growth_hacking_articles.json"), orient="records", indent=2)
