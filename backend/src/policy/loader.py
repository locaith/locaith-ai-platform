import json
import threading
import pathlib
from typing import Optional

_POLICY_PATH = pathlib.Path(__file__).parent / "locaith_ai_system_prompt.json"
_policy_cache: Optional[str] = None
# Use a re-entrant lock to avoid race on reload/first load
_POLICY_LOCK = threading.RLock()


def _load_policy_from_disk() -> str:
    if not _POLICY_PATH.exists():
        # Fallback minimal preamble to avoid crashes if policy file is missing
        return (
            "You are Locaith AI. Follow safety, accuracy, and helpfulness. "
            "Answer clearly, show sources when you cite, and refuse unsafe or illegal requests."
        )
    with _POLICY_LOCK:
        with _POLICY_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
            # Expect a JSON object with a `preamble` or `system_prompt` field
            preamble = (
                data.get("preamble")
                or data.get("system_prompt")
                or data.get("policy_text")
            )
            if isinstance(preamble, dict):
                # If structured, try joining values
                preamble = "\n".join(str(v) for v in preamble.values())
            if not preamble:
                preamble = (
                    "You are Locaith AI. Follow safety, accuracy, and helpfulness. "
                    "Answer clearly, show sources when you cite, and refuse unsafe or illegal requests."
                )
            return str(preamble)


def get_system_preamble() -> str:
    global _policy_cache
    with _POLICY_LOCK:
        if _policy_cache is None:
            _policy_cache = _load_policy_from_disk()
        return _policy_cache


def reload_policy() -> str:
    """Reload the policy JSON from disk and update the cache."""
    global _policy_cache
    with _POLICY_LOCK:
        _policy_cache = _load_policy_from_disk()
        return _policy_cache