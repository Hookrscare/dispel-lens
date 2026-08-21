"""
Metering & Tier Routing Service.
Manages subscription quotas (Free 15/day, Pro Unlimited, Enterprise Metered API),
enforces rate limits, and governs unit economics tier access.
"""

from typing import Dict, Any, Optional
import time


class MeteringService:
    def __init__(self):
        # In-memory user usage database: user_id -> usage_record
        self._user_usage: Dict[str, Dict[str, Any]] = {}
        self.TIER_LIMITS = {
            "free": {
                "daily_scan_limit": 15,
                "deep_tier_allowed": True,
                "audio_sync_allowed": True,
                "certificate_export": True,
                "price_monthly_usd": 0.0
            },
            "pro": {
                "daily_scan_limit": 999999,
                "deep_tier_allowed": True,
                "audio_sync_allowed": True,
                "certificate_export": True,
                "price_monthly_usd": 9.99
            },
            "enterprise": {
                "daily_scan_limit": 9999999,
                "deep_tier_allowed": True,
                "audio_sync_allowed": True,
                "certificate_export": True,
                "price_monthly_usd": 499.0
            }
        }

    def _get_or_create_user(self, user_id: str, default_tier: str = "free") -> Dict[str, Any]:
        today_date = time.strftime("%Y-%m-%d")
        if user_id not in self._user_usage:
            self._user_usage[user_id] = {
                "user_id": user_id,
                "tier": default_tier,
                "date": today_date,
                "scans_today": 0,
                "total_scans_all_time": 0,
                "created_at": time.time()
            }
        else:
            # Check if date rolled over
            user_data = self._user_usage[user_id]
            if user_data.get("date") != today_date:
                user_data["date"] = today_date
                user_data["scans_today"] = 0

        return self._user_usage[user_id]

    def check_and_consume_quota(self, user_id: str, requested_tier: str = "deep") -> Dict[str, Any]:
        """
        Check quota and record a scan consumption.
        Returns authorization result with remaining quota.
        """
        user = self._get_or_create_user(user_id)
        tier = user["tier"]
        tier_cfg = self.TIER_LIMITS.get(tier, self.TIER_LIMITS["free"])

        limit = tier_cfg["daily_scan_limit"]
        used = user["scans_today"]

        if used >= limit:
            return {
                "authorized": False,
                "reason": "daily_quota_exceeded",
                "tier": tier,
                "scans_used": used,
                "daily_limit": limit,
                "scans_remaining": 0,
                "upgrade_url": "/upgrade"
            }

        # Consume 1 scan
        user["scans_today"] += 1
        user["total_scans_all_time"] += 1
        remaining = max(0, limit - user["scans_today"])

        return {
            "authorized": True,
            "tier": tier,
            "scans_used": user["scans_today"],
            "daily_limit": limit,
            "scans_remaining": remaining,
            "is_pro": tier in ["pro", "enterprise"]
        }

    def get_user_quota_status(self, user_id: str) -> Dict[str, Any]:
        user = self._get_or_create_user(user_id)
        tier = user["tier"]
        tier_cfg = self.TIER_LIMITS.get(tier, self.TIER_LIMITS["free"])
        limit = tier_cfg["daily_scan_limit"]
        used = user["scans_today"]

        return {
            "user_id": user_id,
            "tier": tier,
            "scans_used_today": used,
            "daily_limit": limit,
            "scans_remaining": max(0, limit - used),
            "tier_benefits": tier_cfg
        }

    def set_user_tier(self, user_id: str, tier: str) -> Dict[str, Any]:
        user = self._get_or_create_user(user_id)
        if tier in self.TIER_LIMITS:
            user["tier"] = tier
        return self.get_user_quota_status(user_id)
