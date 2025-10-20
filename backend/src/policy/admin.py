from fastapi import APIRouter
from .loader import get_system_preamble, reload_policy

router = APIRouter(prefix="/api/policy", tags=["policy"])

@router.get("/current")
def get_policy():
    """Return the current loaded system policy preamble."""
    return {"preamble": get_system_preamble()}

@router.post("/reload")
def reload():
    """Reload the policy JSON from disk and return the new preamble."""
    preamble = reload_policy()
    return {"status": "ok", "preamble": preamble}