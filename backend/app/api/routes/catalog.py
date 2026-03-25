from fastapi import APIRouter, HTTPException, Query
from app.services.catalog import get_catalog
from app.models.schemas import CatalogResponse

router = APIRouter()


@router.get("/catalog", response_model=CatalogResponse)
async def catalog(tenant_id: str = Query(...)):
    """Get full catalog for a tenant."""
    result = await get_catalog(tenant_id)
    if not result.categories:
        return CatalogResponse(categories=[])
    return result
