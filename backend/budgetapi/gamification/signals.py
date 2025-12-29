from django.db.models.signals import post_save
from django.dispatch import receiver
from transactions.models import Transaction
from .utils import check_achievements
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Transaction)
def check_achievements_on_transaction(sender, instance, created, **kwargs):
    """Check achievements whenever a transaction is created"""
    if created:
        print(f"SIGNAL FIRED! User: {instance.owner.username}")  # DEBUG
        try:
            newly_unlocked = check_achievements(instance.owner)
            print(f"Newly unlocked: {[a.name for a in newly_unlocked]}")  # DEBUG
            
            if newly_unlocked:
                logger.info(
                    f"User {instance.owner.username} unlocked {len(newly_unlocked)} achievements: "
                    f"{[a.name for a in newly_unlocked]}"
                )
        except Exception as e:
            print(f"ERROR in check_achievements: {str(e)}")  # DEBUG
            logger.error(f"Failed to check achievements: {str(e)}", exc_info=True)
            raise