import unittest

from app import build_market_analysis, merge_places, radius_zoom


def places(count, prefix="İşletme", reviews=120):
    return [{"data_id": f"{prefix}-{index}", "title": f"{prefix} {index}", "reviews": reviews, "rating": 4.2} for index in range(count)]


class MarketAnalysisTests(unittest.TestCase):
    def analysis(self, direct_count, proxies=True):
        direct = {str(radius): places(direct_count, f"direct-{radius}") for radius in (500, 1000, 2000, 3000, 5000)}
        proxy = {key: places(8, key) for key in ("commercial_activity", "target_customer_presence", "accessibility", "indirect_demand")} if proxies else {}
        return build_market_analysis(direct, proxy, True)

    def test_mode_thresholds(self):
        for count in (0, 1, 2):
            self.assertEqual(self.analysis(count)["mode"], "demand_validation")
        for count in (3, 10):
            self.assertEqual(self.analysis(count)["mode"], "early_market")
        self.assertEqual(self.analysis(11)["mode"], "competition")

    def test_zero_competition_is_not_automatically_an_opportunity(self):
        result = self.analysis(0, proxies=False)
        self.assertNotEqual(result["classification"], "Opportunity")
        self.assertEqual(result["confidence"]["level"], "low")

    def test_sparse_market_uses_catchment_validation_instead_of_fake_comparables(self):
        result = self.analysis(2)
        self.assertEqual(result["evaluation_method"]["id"], "catchment_proxy_validation")
        self.assertTrue(result["evaluation_method"]["steps"])

    def test_competition_market_uses_direct_benchmark_method(self):
        result = self.analysis(11)
        self.assertEqual(result["evaluation_method"]["id"], "direct_competitor_benchmark")

    def test_weights_total_one(self):
        self.assertAlmostEqual(sum(self.analysis(4)["weights"].values()), 1)

    def test_merge_places_deduplicates(self):
        self.assertEqual(len(merge_places(places(2), places(2))), 2)

    def test_radius_zoom_is_bounded(self):
        self.assertGreaterEqual(radius_zoom(5000), 11)
        self.assertLessEqual(radius_zoom(500), 17)


if __name__ == "__main__":
    unittest.main()
