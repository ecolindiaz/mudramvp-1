from requests_oauthlib import OAuth1
import requests
import sys


consumer_key = "j1L06HFb61P0rbePvbWr2us0g"
consumer_secret = "Lc6ozMIpw3VcLQtdK2yIJdNEYe1KzQIFTKB9V5cqIDlLLg2EjT"
access_token = '1928475713767981056-8j2NRHcoTYsZRnTqlJxZPuM1lrnsbh'
access_token_secret = '2sFaMe6t3F2XuZaF0Hx5tFRl1VORB41eOajUYdIFB2rYx'

auth = OAuth1(
    consumer_key,
    consumer_secret,
    access_token,
    access_token_secret,
    signature_type='auth_header'
)
print("Access Token:", access_token)
print("Access Secret:", access_token_secret)

resp = requests.post(
    "https://api.twitter.com/2/tweets",
    json={"text": "Testing tweet from script"},
    auth=auth
)

print(resp.status_code, resp.text)