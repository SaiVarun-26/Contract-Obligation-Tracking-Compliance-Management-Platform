from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.role_checker import normalize_role, require_any_role, require_role
from app.database.database import get_db
from app.models.activity import Activity
from app.models.contract import Contract
from app.models.notification import Notification
from app.models.obligation import Obligation
from app.models.renewal import Renewal
from app.schemas.contract_schema import (
    ContractAssignment,
    ContractCreate,
    ContractResponse,
    ContractStatusUpdate,
    ContractUpdate,
)
from app.services.activity_logger import ActivityLogger

router = APIRouter(
    prefix="/contracts",
    tags=["Contracts"]
)


@router.post(
    "",
    response_model=ContractResponse,
    status_code=status.HTTP_201_CREATED
)
def create_contract(
    contract_data: ContractCreate,
    request: Request,
    current_user=Depends(require_any_role("Admin", "Legal Manager", "Contract Manager")),
    db: Session = Depends(get_db)
):
    # Check duplicate contract number
    existing = db.query(Contract).filter(
        Contract.contract_number == contract_data.contract_number
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Contract number already exists"
        )

    contract = Contract(
        title=contract_data.title,
        contract_number=contract_data.contract_number,
        category=contract_data.category,
        description=contract_data.description,
        start_date=contract_data.start_date,
        end_date=contract_data.end_date,
        department=contract_data.department,
        assigned_to=contract_data.assigned_to,
        status="Draft",
        created_by=current_user.id
    )

    db.add(contract)
    db.commit()
    db.refresh(contract)

    # Automatically record activity
    ActivityLogger.log(
        db=db,
        action="CREATE_CONTRACT",
        description=f"Created contract '{contract.title}' ({contract.contract_number})",
        user=current_user,
        entity_type="Contract",
        entity_id=contract.id,
        contract_id=contract.id,
        request=request,
        metadata={
            "contract_number": contract.contract_number,
            "category": contract.category,
            "department": contract.department,
            "status": contract.status,
        },
    )

    return contract


@router.get(
    "/",
    response_model=list[ContractResponse],
    status_code=status.HTTP_200_OK
)
def get_contracts(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contracts = db.query(Contract).all()
    return contracts


@router.get(
    "/{contract_id}",
    response_model=ContractResponse,
    status_code=status.HTTP_200_OK
)
def get_contract(
    contract_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    return contract


@router.put(
    "/{contract_id}",
    response_model=ContractResponse
)
def update_contract(
    contract_id: int,
    contract_data: ContractUpdate,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    user_role = normalize_role(current_user.role)
    is_privileged = user_role in ["Admin", "Legal Manager"]
    is_owner_or_assignee = (user_role == "Contract Manager") and (
        contract.created_by == current_user.id or contract.assigned_to == current_user.id
    )

    if not (is_privileged or is_owner_or_assignee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to perform this action."
        )

    if "contract_number" in contract_data.model_fields_set:
        existing = db.query(Contract).filter(
            Contract.contract_number == contract_data.contract_number,
            Contract.id != contract_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Contract number already exists")

    update_data = contract_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(contract, key, value)

    db.commit()
    db.refresh(contract)

    # Automatically record activity
    ActivityLogger.log(
        db=db,
        action="UPDATE_CONTRACT",
        description=f"Updated contract '{contract.title}' ({contract.contract_number})",
        user=current_user,
        entity_type="Contract",
        entity_id=contract.id,
        contract_id=contract.id,
        request=request,
        metadata={"updated_fields": list(update_data.keys())},
    )

    return contract


@router.delete("/{contract_id}", status_code=status.HTTP_200_OK)
def delete_contract(
    contract_id: int,
    request: Request,
    current_user=Depends(require_role("Admin")),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    contract_title = contract.title
    contract_num = contract.contract_number

    # Unlink activity records so historical audit remains intact
    db.query(Activity).filter(Activity.contract_id == contract_id).update(
        {Activity.contract_id: None}, synchronize_session=False
    )
    db.query(Notification).filter(Notification.contract_id == contract_id).delete(synchronize_session=False)
    db.query(Obligation).filter(Obligation.contract_id == contract_id).delete(synchronize_session=False)
    db.query(Renewal).filter(Renewal.contract_id == contract_id).delete(synchronize_session=False)
    db.delete(contract)
    db.commit()

    # Automatically record activity
    ActivityLogger.log(
        db=db,
        action="DELETE_CONTRACT",
        description=f"Deleted contract '{contract_title}' ({contract_num})",
        user=current_user,
        entity_type="Contract",
        entity_id=contract_id,
        contract_id=None,
        request=request,
        metadata={"title": contract_title, "contract_number": contract_num},
    )

    return {"message": "Contract deleted successfully"}


@router.patch(
    "/{contract_id}/status",
    response_model=ContractResponse
)
def change_status(
    contract_id: int,
    status_data: ContractStatusUpdate,
    request: Request,
    current_user=Depends(require_any_role("Admin", "Legal Manager")),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    workflow = {
        "Draft": ["Under Review"],
        "Under Review": ["Approved"],
        "Approved": ["Active"],
        "Active": ["Expired", "Terminated"],
        "Expired": [],
        "Terminated": ["Archived"],
        "Archived": []
    }

    if status_data.status not in workflow.get(contract.status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status transition"
        )

    prev_status = contract.status
    contract.status = status_data.status

    if status_data.status == "Under Review":
        contract.reviewed_at = datetime.utcnow()
    elif status_data.status == "Approved":
        contract.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(contract)

    ActivityLogger.log(
        db=db,
        action="STATUS_CHANGE",
        description=f"Transitioned contract '{contract.title}' status from {prev_status} to {contract.status}",
        user=current_user,
        entity_type="Contract",
        entity_id=contract.id,
        contract_id=contract.id,
        request=request,
        metadata={"from_status": prev_status, "to_status": contract.status},
    )

    return contract


@router.post(
    "/{contract_id}/submit-review",
    response_model=ContractResponse
)
def submit_review(
    contract_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(404, "Contract not found")

    user_role = normalize_role(current_user.role)
    if user_role not in ["Admin", "Legal Manager", "Contract Manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to perform this action."
        )

    if contract.status != "Draft":
        raise HTTPException(400, "Only Draft contracts can be submitted")

    is_privileged = user_role in ["Admin", "Legal Manager"]
    is_owner_or_assignee = contract.created_by == current_user.id or contract.assigned_to == current_user.id
    if not (is_privileged or is_owner_or_assignee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the contract owner or assignee can submit it for review"
        )

    contract.status = "Under Review"
    contract.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(contract)

    ActivityLogger.log(
        db=db,
        action="SUBMIT_REVIEW",
        description=f"Submitted contract '{contract.title}' for review",
        user=current_user,
        entity_type="Contract",
        entity_id=contract.id,
        contract_id=contract.id,
        request=request,
    )

    return contract


@router.post(
    "/{contract_id}/approve",
    response_model=ContractResponse
)
def approve_contract(
    contract_id: int,
    request: Request,
    current_user=Depends(require_any_role("Admin", "Legal Manager")),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(404, "Contract not found")

    if contract.status != "Under Review":
        raise HTTPException(400, "Contract must be Under Review")

    contract.status = "Approved"
    contract.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(contract)

    ActivityLogger.log(
        db=db,
        action="APPROVE_CONTRACT",
        description=f"Approved contract '{contract.title}' ({contract.contract_number})",
        user=current_user,
        entity_type="Contract",
        entity_id=contract.id,
        contract_id=contract.id,
        request=request,
    )

    return contract


@router.post(
    "/{contract_id}/activate",
    response_model=ContractResponse
)
def activate_contract(
    contract_id: int,
    request: Request,
    current_user=Depends(require_any_role("Admin", "Legal Manager")),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(404, "Contract not found")

    if contract.status != "Approved":
        raise HTTPException(400, "Only Approved contracts can be activated")

    contract.status = "Active"

    db.commit()
    db.refresh(contract)

    ActivityLogger.log(
        db=db,
        action="ACTIVATE_CONTRACT",
        description=f"Activated contract '{contract.title}' ({contract.contract_number})",
        user=current_user,
        entity_type="Contract",
        entity_id=contract.id,
        contract_id=contract.id,
        request=request,
    )

    return contract


@router.patch(
    "/{contract_id}/assign",
    response_model=ContractResponse
)
def assign_contract(
    contract_id: int,
    assignment: ContractAssignment,
    request: Request,
    current_user=Depends(require_any_role("Admin", "Legal Manager")),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(404, "Contract not found")

    contract.assigned_to = assignment.assigned_to

    db.commit()
    db.refresh(contract)

    ActivityLogger.log(
        db=db,
        action="ASSIGN_CONTRACT",
        description=f"Assigned contract '{contract.title}' to user #{assignment.assigned_to}",
        user=current_user,
        entity_type="Contract",
        entity_id=contract.id,
        contract_id=contract.id,
        request=request,
        metadata={"assigned_to": assignment.assigned_to},
    )

    return contract
