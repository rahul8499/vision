# utils/notifications.py
import requests
import logging

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_CHUNK_SIZE = 100  # Expo's max per request
VALID_EXPO_PUSH_TOKEN_PREFIXES = ("ExponentPushToken", "ExpoPushToken")


def is_valid_expo_push_token(expo_push_token):
    """Return True for Expo push tokens produced by expo-notifications."""
    return bool(
        expo_push_token
        and isinstance(expo_push_token, str)
        and expo_push_token.startswith(VALID_EXPO_PUSH_TOKEN_PREFIXES)
    )


def send_push_notification(expo_push_token, title, body, data=None):
    """Send a single push notification."""
    if not is_valid_expo_push_token(expo_push_token):
        logger.warning(f"Invalid token skipped: {expo_push_token}")
        return None

    message = {
        "to": expo_push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
    }

    try:
        response = requests.post(EXPO_PUSH_URL, json=message, timeout=10)
        res_data = response.json()
        logger.info(f"Expo Push Response: {res_data}")
        return res_data
    except Exception as e:
        logger.error(f"Push send error: {e}")
        return None


def send_push_notification_batch(messages):
    """
    Send multiple push notifications in batch chunks of 100.
    messages: list of dicts with keys: to, title, body, data, sound
    Returns list of results.
    """
    if not messages:
        return []

    results = []
    for i in range(0, len(messages), EXPO_PUSH_CHUNK_SIZE):
        chunk = [
            message for message in messages[i:i + EXPO_PUSH_CHUNK_SIZE]
            if is_valid_expo_push_token(message.get("to"))
        ]
        if not chunk:
            continue

        try:
            response = requests.post(EXPO_PUSH_URL, json=chunk, timeout=15)
            response.raise_for_status()
            chunk_results = response.json().get('data', [])
            results.extend(chunk_results)
            logger.info(f"Batch sent: {len(chunk)} notifications, results: {chunk_results}")
        except Exception as e:
            logger.error(f"Batch push error for chunk {i}-{i+len(chunk)}: {e}")

    return results
