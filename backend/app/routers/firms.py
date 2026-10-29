from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.firm import Firm
from app.schemas.firm import FirmCreate, FirmUpdate, FirmResponse

router = APIRouter(prefix="/firms", tags=["Firms"])


@router.get("/", response_model=List[FirmResponse])
def get_firms(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    """List all registered firms."""
    query = db.query(Firm)
    if active_only:
        query = query.filter(Firm.is_active == True)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Firm.name.ilike(search_filter)) | (Firm.gstin.ilike(search_filter))
        )
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=FirmResponse, status_code=status.HTTP_201_CREATED)
def create_firm(firm_in: FirmCreate, db: Session = Depends(get_db)):
    """Register a new firm."""
    if firm_in.gstin:
        existing = db.query(Firm).filter(Firm.gstin == firm_in.gstin).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Firm with GSTIN '{firm_in.gstin}' already exists.",
            )

    firm = Firm(**firm_in.model_dump())
    db.add(firm)
    db.commit()
    db.refresh(firm)
    return firm


@router.get("/{firm_id}", response_model=FirmResponse)
def get_firm(firm_id: int, db: Session = Depends(get_db)):
    """Fetch details of a single firm by ID."""
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firm with id {firm_id} not found.",
        )
    return firm


@router.patch("/{firm_id}", response_model=FirmResponse)
def update_firm(firm_id: int, firm_in: FirmUpdate, db: Session = Depends(get_db)):
    """Update details of an existing firm."""
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firm with id {firm_id} not found.",
        )

    update_data = firm_in.model_dump(exclude_unset=True)
    if "gstin" in update_data and update_data["gstin"] != firm.gstin:
        existing = (
            db.query(Firm)
            .filter(Firm.gstin == update_data["gstin"], Firm.id != firm_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Firm with GSTIN '{update_data['gstin']}' already exists.",
            )

    for field, value in update_data.items():
        setattr(firm, field, value)

    db.commit()
    db.refresh(firm)
    return firm


@router.delete("/{firm_id}", status_code=status.HTTP_200_OK)
def delete_firm(
    firm_id: int,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Soft-delete firm by default, or permanently delete if hard_delete=True."""
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firm with id {firm_id} not found.",
        )

    if hard_delete:
        db.delete(firm)
    else:
        firm.is_active = False

    db.commit()
    return {"message": f"Firm {firm_id} {'deleted' if hard_delete else 'deactivated'} successfully."}
