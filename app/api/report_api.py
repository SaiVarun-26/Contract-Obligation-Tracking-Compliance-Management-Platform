from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.role_checker import normalize_role, require_role
from app.database.database import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report_schema import ReportCreate, ReportGenerateRequest, ReportResponse
from app.services.activity_logger import ActivityLogger
from app.services.report_generator import generate_report_file

router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)

ALLOWED_REPORT_TYPES = {
    "Compliance Report",
    "Contract Report",
    "Renewal Report",
    "Obligation Report",
    "Audit Report",
}


def verify_report_generation_permission(user_role: str, report_type: str):
    """
    Enforces RBAC rules for generating specific report types:
    - Admin, Legal Manager: Can generate all 5 reports.
    - Compliance Officer: Compliance Report, Obligation Report.
    - Contract Manager: Contract Report, Renewal Report.
    - Viewer: Cannot generate any reports.
    """
    canonical_role = normalize_role(user_role)

    if canonical_role == "Viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers are not permitted to generate reports. Read and download only.",
        )

    if canonical_role in ["Admin", "Legal Manager"]:
        return

    if canonical_role == "Compliance Officer":
        if report_type in ["Compliance Report", "Obligation Report"]:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Compliance Officers can only generate Compliance and Obligation reports, not '{report_type}'.",
        )

    if canonical_role == "Contract Manager":
        if report_type in ["Contract Report", "Renewal Report"]:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Contract Managers can only generate Contract and Renewal reports, not '{report_type}'.",
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Your role '{canonical_role}' is not authorized to generate '{report_type}'.",
    )


def map_report_to_response(report: Report) -> ReportResponse:
    user_name = None
    if report.user:
        user_name = f"{report.user.full_name} ({report.user.role})"
    elif report.generated_by:
        user_name = f"User #{report.generated_by}"

    return ReportResponse(
        id=report.id,
        generated_by=report.generated_by,
        generated_by_name=user_name,
        report_name=report.report_name,
        report_type=report.report_type,
        file_path=report.file_path,
        file_format=report.file_format or "pdf",
        status=report.status or "Completed",
        download_count=report.download_count or 0,
        generated_at=report.generated_at,
    )


@router.get(
    "",
    response_model=List[ReportResponse],
)
@router.get(
    "/",
    response_model=List[ReportResponse],
)
def get_reports(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve history of all generated reports. Accessible by all authenticated roles.
    """
    reports = db.query(Report).order_by(Report.generated_at.desc(), Report.id.desc()).all()
    return [map_report_to_response(r) for r in reports]


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
)
def get_report(
    report_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get metadata for a single report. Accessible by all authenticated roles.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return map_report_to_response(report)


@router.post(
    "/generate",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_report(
    request_data: ReportGenerateRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a new report in PDF or Excel format from active database records.
    Enforces role-based permissions per report type.
    """
    report_type = request_data.report_type.strip()
    if report_type not in ALLOWED_REPORT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid report type '{report_type}'. Allowed types: {sorted(list(ALLOWED_REPORT_TYPES))}",
        )

    # 1. Enforce RBAC per role and report type
    verify_report_generation_permission(current_user.role, report_type)

    format_clean = (request_data.file_format or "pdf").lower().strip()
    if format_clean not in ["pdf", "excel", "xlsx"]:
        format_clean = "pdf"
    if format_clean == "xlsx":
        format_clean = "excel"

    default_name = f"{report_type.replace(' Report', '')} Analysis"
    report_name = (request_data.report_name or "").strip() or default_name

    # 2. Generate actual file on disk via Report Generator engine
    try:
        rel_path, abs_path = generate_report_file(
            report_type=report_type,
            report_name=report_name,
            file_format=format_clean,
            generated_by_user=current_user,
            db=db,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report file generation failed: {str(e)}",
        )

    # 3. Store report record in database
    report = Report(
        generated_by=current_user.id,
        report_name=report_name,
        report_type=report_type,
        file_path=rel_path,
        file_format=format_clean,
        status="Completed",
        download_count=0,
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    # Log report generation
    ActivityLogger.log(
        db=db,
        action="GENERATE_REPORT",
        description=f"Generated {report.report_type} '{report.report_name}' ({report.file_format.upper()})",
        user=current_user,
        entity_type="Report",
        entity_id=report.id,
        request=request,
        metadata={"report_type": report.report_type, "format": report.file_format},
    )

    return map_report_to_response(report)


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download the generated report file (PDF or Excel).
    Increments the report's download count on each successful request.
    Accessible by all authenticated roles.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report record not found",
        )

    file_path = Path(report.file_path).resolve()
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file is missing from the server storage",
        )

    # Increment download count
    report.download_count = (report.download_count or 0) + 1
    db.commit()
    db.refresh(report)

    # Log report download
    ActivityLogger.log(
        db=db,
        action="DOWNLOAD_REPORT",
        description=f"Downloaded report '{report.report_name}' ({report.file_format.upper()})",
        user=current_user,
        entity_type="Report",
        entity_id=report.id,
        request=request,
        metadata={"download_count": report.download_count},
    )

    # Set appropriate media type and download extension
    is_excel = (report.file_format or "").lower() in ["excel", "xlsx"]
    media_type = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if is_excel
        else "application/pdf"
    )
    ext = "xlsx" if is_excel else "pdf"

    clean_name = "".join(
        c for c in report.report_name if c.isalnum() or c in ("-", "_", " ")
    ).strip().replace(" ", "_")
    download_filename = f"{clean_name}.{ext}"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=download_filename,
        headers={
            "Content-Disposition": f'attachment; filename="{download_filename}"'
        },
    )


@router.delete(
    "/{report_id}",
    status_code=status.HTTP_200_OK,
)
def delete_report(
    report_id: int,
    request: Request,
    current_user=Depends(require_role("Admin")),
    db: Session = Depends(get_db),
):
    """
    Delete a generated report and its file from server storage.
    Restricted to Administrator role only.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    report_name = report.report_name

    # Attempt to delete file from disk
    try:
        file_path = Path(report.file_path).resolve()
        if file_path.is_file():
            file_path.unlink()
    except Exception:
        pass

    db.delete(report)
    db.commit()

    ActivityLogger.log(
        db=db,
        action="DELETE_REPORT",
        description=f"Deleted report '{report_name}' (ID #{report_id})",
        user=current_user,
        entity_type="Report",
        entity_id=report_id,
        request=request,
    )

    return {
        "detail": f"Report '{report_name}' deleted successfully",
        "id": report_id,
    }
