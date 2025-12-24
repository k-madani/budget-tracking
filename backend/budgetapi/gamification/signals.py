from django.db.models.signals import post_save
from django.dispatch import receiver
from transactions.models import Transaction
from .utils import update_user_streak
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Transaction)
def update_streak_on_transaction(sender, instance, created, **kwargs):
    """
    Automatically update user streak whenever a transaction is created
    Uses the transaction's spent_at date for streak calculation
    """
    if created:
        try:
            # Use spent_at date for streak, not creation date
            transaction_date = instance.spent_at.date()
            result = update_user_streak(instance.owner, transaction_date)
            logger.info(
                f"Streak updated for {instance.owner.username} (spent_at: {transaction_date}): "
                f"current={result.current_streak}, longest={result.longest_streak}, "
                f"total_transactions={result.total_transactions}"
            )
        except Exception as e:
            logger.error(
                f"Failed to update streak for {instance.owner.username}: {str(e)}",
                exc_info=True
            )
            # Re-raise in development to see the error
            # Comment out in production
            raise