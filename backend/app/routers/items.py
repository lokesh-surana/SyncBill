from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate, ItemResponse

router = APIRouter(prefix="/items", tags=["Items"])


@router.get("/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    """Retrieve all unique product categories / sections sorted alphabetically."""
    rows = (
        db.query(Item.category)
        .filter(Item.is_active == True, Item.category.isnot(None), Item.category != "")
        .distinct()
        .order_by(Item.category.asc())
        .all()
    )
    categories = [r[0] for r in rows if r[0]]
    if "READYMADE GARMENTS" not in categories:
        categories.insert(0, "READYMADE GARMENTS")
    return categories


@router.get("/", response_model=List[ItemResponse])
def get_items(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=10000, description="Max items to return"),
    search: Optional[str] = Query(None, description="Search by item name or code"),
    category: Optional[str] = Query(None, description="Filter by section / category"),
    active_only: bool = Query(True, description="Filter only active items"),
    db: Session = Depends(get_db),
):
    """Retrieve items with optional searching, category filtering, and pagination."""
    query = db.query(Item)
    if active_only:
        query = query.filter(Item.is_active == True)
    if category and category != "all" and category != "ALL SECTIONS":
        query = query.filter(Item.category.ilike(category))
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Item.name.ilike(search_filter)) | 
            (Item.item_code.ilike(search_filter)) |
            (Item.category.ilike(search_filter)) |
            (Item.description.ilike(search_filter)) |
            (Item.item_type.ilike(search_filter))
        )
    return query.order_by(Item.name.asc()).offset(skip).limit(limit).all()


@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(item_in: ItemCreate, db: Session = Depends(get_db)):
    """Create a new item in the inventory."""
    if item_in.item_code:
        existing = db.query(Item).filter(Item.item_code == item_in.item_code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with code '{item_in.item_code}' already exists.",
            )

    item = Item(**item_in.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db)):
    """Fetch a single item by its ID."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found.",
        )
    return item


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, item_in: ItemUpdate, db: Session = Depends(get_db)):
    """Update fields of an existing item (partial update)."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found.",
        )

    update_data = item_in.model_dump(exclude_unset=True)
    if "item_code" in update_data and update_data["item_code"] != item.item_code:
        existing = (
            db.query(Item)
            .filter(Item.item_code == update_data["item_code"], Item.id != item_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with code '{update_data['item_code']}' already exists.",
            )

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
def delete_item(
    item_id: int,
    hard_delete: bool = Query(False, description="Permanently delete from database"),
    db: Session = Depends(get_db),
):
    """Soft-delete an item by default (mark inactive), or hard-delete if requested."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found.",
        )

    if hard_delete:
        db.delete(item)
    else:
        item.is_active = False

    db.commit()
    return {"message": f"Item {item_id} {'deleted' if hard_delete else 'deactivated'} successfully."}
