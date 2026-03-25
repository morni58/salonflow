from fastapi import APIRouter, Query
from app.core.database import get_supabase

router = APIRouter()


@router.get("/portfolio")
async def get_portfolio(tenant_id: str = Query(...)):
    """Get portfolio photos grouped by category."""
    sb = get_supabase()

    photos = (
        sb.table("portfolio")
        .select("id, category_id, image_url, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    )

    categories = (
        sb.table("categories")
        .select("id, name")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .filter("deleted_at", "is", "null")
        .execute()
    )

    cat_map = {c["id"]: c["name"] for c in categories.data}

    grouped: dict[str, list] = {}
    for p in photos.data:
        cat_name = cat_map.get(p["category_id"], "Другое")
        if cat_name not in grouped:
            grouped[cat_name] = []
        grouped[cat_name].append({
            "id": p["id"],
            "url": p["image_url"],
            "created_at": p["created_at"],
        })

    return {"portfolio": [{"category": k, "images": v} for k, v in grouped.items()]}


@router.get("/reviews")
async def get_reviews(tenant_id: str = Query(...)):
    """Get review screenshots."""
    sb = get_supabase()

    reviews = (
        sb.table("reviews")
        .select("id, image_url, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "reviews": [
            {"id": r["id"], "url": r["image_url"], "created_at": r["created_at"]}
            for r in reviews.data
        ]
    }
