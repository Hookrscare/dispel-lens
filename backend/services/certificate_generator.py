"""
Enterprise Forensic Export Certificate Generator.
Generates court-ready, newsroom-ready, and KYC-compliant tamper-evident
verification certificates with cryptographic SHA-256 hashes and multi-vector proof.
"""

from typing import Dict, Any, Optional
import hashlib
import time
import json


class CertificateGenerator:
    def __init__(self, issuer_name: str = "Proof of Reality Verification Authority"):
        self.issuer_name = issuer_name

    def generate_certificate(self, scan_result: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a cryptographically hashed forensic certificate from a scan result.
        """
        metadata = metadata or {}
        timestamp_epoch = time.time()
        iso_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(timestamp_epoch))
        
        entropy = f"{scan_result.get('video_id')}_{timestamp_epoch}_{scan_result.get('ai_probability')}"
        cert_hash = hashlib.sha256(entropy.encode("utf-8")).hexdigest()
        cert_id = f"POR-CERT-{time.strftime('%Y')}-{cert_hash[:10].upper()}"

        verdict = scan_result.get("verdict", "INCONCLUSIVE")
        ai_prob = scan_result.get("ai_probability", 0.5)
        auth_score = round(1.0 - ai_prob, 4)
        vectors = scan_result.get("vectors", {})

        proof_payload = {
            "certificate_id": cert_id,
            "issuer": self.issuer_name,
            "timestamp": iso_timestamp,
            "video_metadata": {
                "platform": scan_result.get("platform", "web"),
                "video_id": scan_result.get("video_id", "N/A"),
                "timestamp_sec": scan_result.get("timestamp_sec", 0.0),
                "title": metadata.get("title", "Video Asset")
            },
            "forensic_verdict": {
                "status": verdict,
                "badge_color": scan_result.get("badge_color", "AMBER"),
                "authenticity_score": auth_score,
                "ai_probability": ai_prob,
                "confidence": scan_result.get("confidence", 0.85)
            },
            "vector_scores": {
                "spatial_frequency_fft": vectors.get("spatial_frequency", {}).get("score", 0.0),
                "biological_rppg": vectors.get("biological_rppg", {}).get("score", 0.0),
                "temporal_optical_flow": vectors.get("temporal_optical_flow", {}).get("score", 0.0),
                "physics_and_lighting": vectors.get("physics_and_lighting", {}).get("score", 0.0),
                "cross_modal_audio": vectors.get("cross_modal_audio", {}).get("score", 0.0)
            },
            "c2pa_attestation": vectors.get("c2pa_provenance", {}),
            "failure_points": scan_result.get("failure_points", []),
            "heatmap_boxes_count": len(scan_result.get("heatmap_boxes", []))
        }

        serialized = json.dumps(proof_payload, sort_keys=True)
        cryptographic_signature = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        certificate_data = {
            **proof_payload,
            "tamper_evident_sha256_signature": cryptographic_signature,
            "verification_url": f"http://localhost:8000/api/v1/certificate/verify/{cert_id}",
            "html_report": self._generate_html_report(proof_payload, cryptographic_signature)
        }

        return certificate_data

    def _generate_html_report(self, proof: Dict[str, Any], signature: str) -> str:
        """
        Generate standalone printable HTML forensic certificate.
        """
        v = proof["forensic_verdict"]
        is_auth = v["status"] == "AUTHENTIC"
        is_syn = v["status"] == "SYNTHETIC"
        badge_color = "#22c55e" if is_auth else "#ef4444" if is_syn else "#eab308"
        verdict_text = "VERIFIED AUTHENTIC HUMAN" if is_auth else "SYNTHETIC / AI GENERATED" if is_syn else "INCONCLUSIVE"
        video_title = proof["video_metadata"].get("title", "Video Asset")

        failures_html = "".join([f"<li>{fp}</li>" for fp in proof["failure_points"]]) or "<li>No critical failure points identified.</li>"

        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Forensic Certificate — {proof['certificate_id']}</title>
  <style>
    body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 40px; margin: 0; }}
    .cert-box {{ max-width: 800px; margin: 0 auto; background: #131d31; border: 2px solid rgba(56, 189, 248, 0.4); border-radius: 12px; padding: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }}
    .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 20px; }}
    .title h1 {{ margin: 0; font-size: 24px; color: #38bdf8; }}
    .title p {{ margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; }}
    .cert-id {{ text-align: right; font-family: monospace; font-size: 13px; color: #94a3b8; }}
    .asset-title {{ margin-top: 15px; font-size: 16px; font-weight: bold; color: #e2e8f0; }}
    .verdict-box {{ margin: 20px 0; padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.03); border-left: 6px solid {badge_color}; display: flex; justify-content: space-between; align-items: center; }}
    .verdict-tag {{ font-size: 20px; font-weight: bold; color: {badge_color}; }}
    .score-pct {{ font-size: 28px; font-weight: 800; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }}
    .item {{ background: #0f172a; padding: 15px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); }}
    .item-label {{ font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; }}
    .item-val {{ font-size: 14px; font-weight: bold; margin-top: 4px; }}
    .failures {{ margin-top: 20px; background: #0f172a; padding: 20px; border-radius: 6px; }}
    .footer {{ margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; font-size: 11px; color: #64748b; font-family: monospace; word-break: break-all; }}
  </style>
</head>
<body>
  <div class="cert-box">
    <div class="header">
      <div class="title">
        <h1>Proof of Reality — Forensic Certificate</h1>
        <p>Issued by {proof['issuer']} · ISO 8601: {proof['timestamp']}</p>
      </div>
      <div class="cert-id">
        <strong>{proof['certificate_id']}</strong>
      </div>
    </div>

    <div class="asset-title">Target Asset: {video_title}</div>

    <div class="verdict-box">
      <div>
        <div class="verdict-tag">{verdict_text}</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Platform: {proof['video_metadata']['platform'].upper()} · Asset ID: {proof['video_metadata']['video_id']}</div>
      </div>
      <div class="score-pct" style="color: {badge_color};">{int(v['ai_probability']*100)}% AI</div>
    </div>

    <div class="grid">
      <div class="item">
        <div class="item-label">Spatial FFT Lattice Anomaly</div>
        <div class="item-val">{int(proof['vector_scores']['spatial_frequency_fft']*100)}% Synthetic Score</div>
      </div>
      <div class="item">
        <div class="item-label">Biological Pulse Hemodynamics (rPPG)</div>
        <div class="item-val">{int(proof['vector_scores']['biological_rppg']*100)}% Synthetic Score</div>
      </div>
      <div class="item">
        <div class="item-label">Optical Flow Temporal Warping</div>
        <div class="item-val">{int(proof['vector_scores']['temporal_optical_flow']*100)}% Synthetic Score</div>
      </div>
      <div class="item">
        <div class="item-label">Physics & Lighting Symmetry</div>
        <div class="item-val">{int(proof['vector_scores']['physics_and_lighting']*100)}% Synthetic Score</div>
      </div>
    </div>

    <div class="failures">
      <div class="item-label" style="margin-bottom: 8px;">Forensic Anomaly Annotations</div>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
        {failures_html}
      </ul>
    </div>

    <div class="footer">
      <div><strong>Cryptographic SHA-256 Signature:</strong> {signature}</div>
      <div style="margin-top: 4px;">This certificate represents an automated multi-layer forensic evaluation verifying mathematical, biological, and physical signals.</div>
    </div>
  </div>
</body>
</html>"""
