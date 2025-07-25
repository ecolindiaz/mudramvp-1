import tweepy

consumer_key = "iLz0Mp5UdjNza6IzgqeC3PQUb"
consumer_secret = "HXYSqFklG81yqjkvPiK7rLKEwcmOt5kEB0nt9zQM0GCfOiJ2dN"
access_token = "1928475713767981056-WR1Lsbr1OhIkrm5MciKJbuZe0J5qFN"
access_token_secret = "ZLJ8MV4tCmxoQZdcRrQAsxoTdqAB8qILnIhv8W5DtTq1R"

auth = tweepy.OAuth1UserHandler(consumer_key, consumer_secret, access_token, access_token_secret)
api = tweepy.API(auth)
api.update_status("Test tweet from Tweepy!")