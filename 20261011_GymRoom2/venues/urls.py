from django.urls import path

from . import views

urlpatterns = [
    path("", views.map_page, name="map"),
    path("api/venues/", views.venue_list, name="venues-api"),
    path("api/venues/<int:pk>/", views.venue_detail_view, name="venue-detail"),
    path("api/sync/", views.sync_start, name="sync-start"),
    path("api/sync/status/", views.sync_status, name="sync-status"),
]
