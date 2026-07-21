from unittest.mock import AsyncMock, patch

from django.test import SimpleTestCase, override_settings

from prescription.services import mappls


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


@override_settings(MAPPLS_CLIENT_ID="client", MAPPLS_CLIENT_SECRET="secret")
class MapplsServiceTests(SimpleTestCase):
    async def test_search_normalizes_and_orders_mappls_suggestions(self):
        client = AsyncMock()
        client.get.return_value = FakeResponse({
            "suggestedLocations": [
                {"eLoc": "SECOND", "placeName": "Second", "placeAddress": "Pune", "orderIndex": 2},
                {"eLoc": "FIRST1", "placeName": "First", "placeAddress": "Pune", "orderIndex": 1},
            ]
        })
        with patch.object(mappls, "get_access_token", AsyncMock(return_value="token")):
            results = await mappls.search(client, "medical store", "18.5", "73.8")

        self.assertEqual(results[0]["place_id"], "mappls:FIRST1")
        self.assertEqual(results[0]["display_name"], "First, Pune")
        self.assertTrue(results[0]["is_prediction"])
        self.assertEqual(client.get.call_args.kwargs["params"]["location"], "18.5,73.8")

    async def test_place_details_returns_coordinates(self):
        client = AsyncMock()
        client.get.return_value = FakeResponse({"latitude": 18.5204, "longitude": 73.8567})
        with patch.object(mappls, "get_access_token", AsyncMock(return_value="token")):
            result = await mappls.place_details(client, "mappls:FIRST1")

        self.assertEqual(result, {"lat": "18.5204", "lon": "73.8567"})
