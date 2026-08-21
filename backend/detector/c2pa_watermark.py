"""
C2PA & Watermark Attestation Cross-Checker.
Inspects payload metadata for C2PA (Content Credentials) cryptographic manifests,
JUMBF boxes, and digital watermarking signatures (e.g., SynthID, Truepic).
"""

from typing import Dict, Any, Optional
import re


class C2PAWatermarkDetector:
    def __init__(self):
        # Known C2PA signature byte markers and regexes
        self.c2pa_box_patterns = [
            b"c2pa",
            b"c2ma",
            b"jumb",
            b"urn:c2pa:",
            b"http://c2pa.org"
        ]
        self.synthetic_claim_keywords = [
            "generative_ai",
            "synthetic_content",
            "ai_generated",
            "dall-e",
            "midjourney",
            "sora",
            "runway",
            "kling",
            "stable_diffusion",
            "flux"
        ]

    def inspect_raw_bytes(self, payload_bytes: bytes) -> Dict[str, Any]:
        """
        Inspect binary payload for C2PA manifests and watermark signatures.
        """
        if not payload_bytes:
            return {
                "c2pa_present": False,
                "watermark_detected": False,
                "synthetic_claim": False,
                "issuer": None,
                "confidence": 0.0
            }

        c2pa_found = any(pat in payload_bytes for pat in self.c2pa_box_patterns)
        
        # Check text search in metadata
        text_content = ""
        try:
            text_content = payload_bytes.decode("utf-8", errors="ignore").lower()
        except Exception:
            pass

        synthetic_claim = False
        detected_claims = []
        for kw in self.synthetic_claim_keywords:
            if kw in text_content:
                synthetic_claim = True
                detected_claims.append(kw)

        # Detect SynthID / imperceptible watermark marker presence heuristic
        synthid_marker_found = (b"SynthID" in payload_bytes) or ("synthid" in text_content)

        issuer = None
        if "c2pa.org" in text_content:
            issuer = "C2PA Provenance Manifest (Content Credentials)"
        elif "adobe" in text_content and c2pa_found:
            issuer = "Adobe Content Credentials"

        confidence = 0.95 if (c2pa_found or synthid_marker_found) else 0.0

        return {
            "c2pa_present": c2pa_found,
            "synthetic_claim": synthetic_claim,
            "synthetic_claims_detail": detected_claims,
            "watermark_detected": synthid_marker_found,
            "watermark_type": "SynthID Marker" if synthid_marker_found else None,
            "issuer": issuer,
            "confidence": confidence
        }
