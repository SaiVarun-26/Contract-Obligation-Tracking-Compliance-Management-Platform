from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.obligation import Obligation
from app.models.contract import Contract
from app.models.user import User
from app.schemas.obligation_schema import (
    ObligationCreate,
    ObligationUpdate,
    ObligationStatusUpdate,
    ObligationResponse
)
from app.core.auth import get_current_user
from app.core.role_checker import require_role, require_any_role, normalize_role
from app.services.activity_logger import ActivityLogger

router = APIRouter(
    prefix="/obligations",
    tags=["Obligations"]
)


# ---------------- CREATE OBLIGATION ----------------

@router.post(
    "",
    response_model=ObligationResponse,
    status_code=status.HTTP_201_CREATED
)
def create_obligation(
    obligation_data: ObligationCreate,
    request: Request,
    current_user=Depends(require_any_role("Admin", "Legal Manager", "Contract Manager")),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == obligation_data.contract_id
    ).first()

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found"
        )

    user = db.query(User).filter(
        User.id == obligation_data.assigned_to
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Assigned user not found"
        )

    obligation = Obligation(
        contract_id=obligation_data.contract_id,
        title=obligation_data.title,
        description=obligation_data.description,
        obligation_type=obligation_data.obligation_type,
        priority=obligation_data.priority or "Medium",
        due_date=obligation_data.due_date,
        assigned_to=obligation_data.assigned_to,
        status="Pending"
    )

    db.add(obligation)
    db.commit()
    db.refresh(obligation)

    ActivityLogger.log(
        db=db,
        action="CREATE_OBLIGATION",
        description=f"Created obligation '{obligation.title}' on contract '{contract.title}'",
        user=current_user,
        entity_type="Obligation",
        entity_id=obligation.id,
        contract_id=obligation.contract_id,
        request=request,
        metadata={"priority": obligation.priority, "due_date": str(obligation.due_date)},
    )

    return obligation


# ---------------- GET ALL OBLIGATIONS ----------------

@router.get(
    "",
    response_model=list[ObligationResponse]
)
def get_obligations(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Obligation).all()


# ---------------- GET OBLIGATION BY ID ----------------

@router.get(
    "/{obligation_id}",
    response_model=ObligationResponse
)
def get_obligation(
    obligation_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    obligation = db.query(Obligation).filter(
        Obligation.id == obligation_id
    ).first()

    if not obligation:
        raise HTTPException(
            status_code=404,
            detail="Obligation not found"
        )

    return obligation


# ---------------- GET OBLIGATIONS FOR A CONTRACT ----------------

@router.get(
    "/contract/{contract_id}",
    response_model=list[ObligationResponse]
)
def get_contract_obligations(
    contract_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found"
        )

    return db.query(Obligation).filter(
        Obligation.contract_id == contract_id
    ).all()


# ---------------- UPDATE OBLIGATION ----------------

@router.put(
    "/{obligation_id}",
    response_model=ObligationResponse
)
def update_obligation(
    obligation_id: int,
    obligation_data: ObligationUpdate,
    request: Request,
    current_user=Depends(require_any_role("Admin", "Legal Manager", "Contract Manager")),
    db: Session = Depends(get_db)
):
    obligation = db.query(Obligation).filter(
        Obligation.id == obligation_id
    ).first()

    if not obligation:
        raise HTTPException(
            status_code=404,
            detail="Obligation not found"
        )

    update_data = obligation_data.model_dump(exclude_unset=True)

    if "assigned_to" in update_data:
        user = db.query(User).filter(
            User.id == update_data["assigned_to"]
        ).first()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="Assigned user not found"
            )

    for key, value in update_data.items():
        setattr(obligation, key, value)

    db.commit()
    db.refresh(obligation)

    ActivityLogger.log(
        db=db,
        action="UPDATE_OBLIGATION",
        description=f"Updated obligation '{obligation.title}'",
        user=current_user,
        entity_type="Obligation",
        entity_id=obligation.id,
        contract_id=obligation.contract_id,
        request=request,
    )

    return obligation


# ---------------- UPDATE STATUS ----------------

@router.patch(
    "/{obligation_id}/status",
    response_model=ObligationResponse
)
def update_status(
    obligation_id: int,
    status_data: ObligationStatusUpdate,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    obligation = db.query(Obligation).filter(
        Obligation.id == obligation_id
    ).first()

    if not obligation:
        raise HTTPException(
            status_code=404,
            detail="Obligation not found"
        )

    user_role = normalize_role(current_user.role)
    is_manager = user_role in ["Admin", "Legal Manager", "Contract Manager"]
    is_assignee = obligation.assigned_to == current_user.id
    if not (is_manager or is_assignee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this obligation status."
        )

    workflow = {
        "Pending": ["In Progress"],
        "In Progress": ["Completed"],
        "Completed": [],
        "Delayed": ["Completed"],
        "Overdue": ["Completed"]
    }

    current = obligation.status
    new = status_data.status

    if new not in workflow.get(current, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition from '{current}' to '{new}'"
        )

    obligation.status = new

    if new == "Completed":
        obligation.completion_date = date.today()

    db.commit()
    db.refresh(obligation)

    action_label = "COMPLETE_OBLIGATION" if new == "Completed" else "STATUS_CHANGE"
    ActivityLogger.log(
        db=db,
        action=action_label,
        description=f"Obligation '{obligation.title}' status updated from {current} to {new}",
        user=current_user,
        entity_type="Obligation",
        entity_id=obligation.id,
        contract_id=obligation.contract_id,
        request=request,
        metadata={"previous_status": current, "new_status": new},
    )

    return obligation


@router.delete("/{obligation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_obligation(
    obligation_id: int,
    request: Request,
    current_user=Depends(require_any_role("Admin", "Legal Manager")),
    db: Session = Depends(get_db),
):
    obligation = db.query(Obligation).filter(Obligation.id == obligation_id).first()
    if not obligation:
        raise HTTPException(status_code=404, detail="Obligation not found")

    title = obligation.title
    cid = obligation.contract_id

    db.delete(obligation)
    db.commit()

    ActivityLogger.log(
        db=db,
        action="DELETE_OBLIGATION",
        description=f"Deleted obligation '{title}' (ID #{obligation_id})",
        user=current_user,
        entity_type="Obligation",
        entity_id=obligation_id,
        contract_id=cid,
        request=request,
    )