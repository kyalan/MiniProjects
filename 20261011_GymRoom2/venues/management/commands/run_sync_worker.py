import time

from django.core.management.base import BaseCommand

from venues.pipeline.sync import claim_queued, execute_sync


class Command(BaseCommand):
    help = "Run queued fitness-room sync jobs until the process stops."

    def handle(self, *args, **options):
        self.stdout.write("Sync worker started")
        while True:
            run = claim_queued()
            if run is None:
                time.sleep(2)
                continue
            self.stdout.write(f"Running sync #{run.pk}")
            execute_sync(run)
            run.refresh_from_db()
            self.stdout.write(f"Sync #{run.pk} finished with {run.status}")
