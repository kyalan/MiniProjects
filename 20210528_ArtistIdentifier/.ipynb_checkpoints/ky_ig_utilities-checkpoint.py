class ky_ig_player():
    
    from instaloader import Instaloader, Profile, TopSearchResults
    import time
    
    def __init__(self):
        from instaloader import Instaloader, Profile, TopSearchResults
        
        self.L = Instaloader(download_video_thumbnails=False, save_metadata=False, compress_json=False, download_videos=False)
        self.L.login('ky.alan', 't23Ecuhk3')
        
    def download_ig_posts(self, username, npost):

        from instaloader import Instaloader, Profile, TopSearchResults
        import time        

        profile = Profile.from_username(self.L.context, username)

        ipost = 0
        for post in profile.get_posts():
            ipost += 1
            self.L.download_post(post, target=profile.username)
            if ipost >= npost:    break

        return True

    def get_ig_username(self, txt):

        from instaloader import Instaloader, Profile, TopSearchResults
        import time
        
        searcher = TopSearchResults(self.L.context, txt)

        result = next(searcher.get_profiles())
        print(f'get_ig_username {txt} --> {result.username}')

        return result.username