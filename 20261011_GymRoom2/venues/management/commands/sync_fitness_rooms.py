from django.core.management.base import BaseCommand

from venues.models import SyncRun
from venues.pipeline.sync import enqueue_sync, execute_sync


class Command(BaseCommand):
    help = "Download LCSD fitness-room data and store it now."

    def handle(self, *args, **options):
        run, created, _cooldown = enqueue_sync(SyncRun.Trigger.CLI, bypass_cooldown=True)
        if not created:
            self.stdout.write(f"A sync is already {run.status}: #{run.pk}")
            return
        self.stdout.write(f"Starting sync #{run.pk}")
        execute_sync(run)
        run.refresh_from_db()
        self.stdout.write(f"Sync #{run.pk} {run.status}")
        if run.status != SyncRun.Status.SUCCESS:
            raise SystemExit(1)
