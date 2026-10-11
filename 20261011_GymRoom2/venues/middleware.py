class DefaultLanguageMiddleware:
    """Use Traditional Chinese until the visitor chooses a language."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if "django_language" not in request.COOKIES:
            request.META.pop("HTTP_ACCEPT_LANGUAGE", None)
        return self.get_response(request)
