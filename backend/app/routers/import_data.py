"""
Salesforce data import endpoint.
Supports CSV and XLSX files for: accounts, contacts, leads, opportunities (→ deals).
"""
import io
import csv
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.account import Account, AccountType, AccountStatus
from app.models.contact import Contact
from app.models.lead import Lead, LeadSource, LeadStatus
from app.models.deal import Deal
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/import", tags=["import"])

# Salesforce → CRM field mappings
ACCOUNT_MAP = {
    "Name": "name",
    "Industry": "industry",
    "Type": None,  # handled specially
    "Website": "website",
    "BillingStreet": None,
    "BillingCity": None,
    "BillingCountry": "country",
    "Description": "notes",
    "Segment__c": "segment",
    "Region__c": "region",
}

CONTACT_MAP = {
    "FirstName": "first_name",
    "LastName": "last_name",
    "Email": "email",
    "Phone": "phone",
    "Title": "title",
}

LEAD_MAP = {
    "Company": "company_name",
    "FirstName": None,
    "LastName": None,
    "Email": "contact_email",
    "Phone": None,
    "LeadSource": None,  # handled specially
    "Description": "qualification_notes",
    "Title": None,
    "AnnualRevenue": None,
    "NumberOfEmployees": "estimated_volume",
}

DEAL_MAP = {
    "Name": "title",
    "Amount": "value_eur",
    "CloseDate": "expected_close_date",
    "Probability": "probability",
    "Description": "branding_requirements",
    "StageName": None,  # map to string stage key
}

LEAD_SOURCE_MAP = {
    "Web": "website",
    "Email": "email",
    "Event": "event",
    "Referral": "referral",
    "Other": "manual",
    "Internal": "manual",
    "": "manual",
}


def _parse_rows(content: bytes, filename: str) -> list[dict]:
    """Parse CSV or XLSX file content into list of dicts."""
    fname = (filename or "").lower()

    if fname.endswith(".xlsx") or fname.endswith(".xls"):
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(status_code=400, detail="openpyxl not installed; use CSV format")
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h).strip() if h is not None else "" for h in rows[0]]
        return [
            {headers[i]: (str(v).strip() if v is not None else "") for i, v in enumerate(row)}
            for row in rows[1:]
        ]
    else:
        # CSV
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        return [dict(row) for row in reader]


async def _import_accounts(rows: list[dict], db: AsyncSession) -> tuple[int, int, list[str]]:
    imported, skipped, errors = 0, 0, []
    for i, row in enumerate(rows):
        name = row.get("Name", "").strip()
        if not name:
            skipped += 1
            continue
        existing = await db.execute(select(Account).where(Account.name == name))
        if existing.scalar_one_or_none():
            skipped += 1
            continue
        try:
            address_parts = [row.get("BillingStreet", ""), row.get("BillingCity", "")]
            address = ", ".join(p for p in address_parts if p) or None
            acc = Account(
                name=name,
                type=AccountType.b2b,
                industry=row.get("Industry") or None,
                website=row.get("Website") or None,
                address=address,
                country=row.get("BillingCountry") or None,
                region=row.get("Region__c") or None,
                segment=row.get("Segment__c") or None,
                notes=row.get("Description") or None,
                status=AccountStatus.active,
            )
            db.add(acc)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {e}")
    return imported, skipped, errors


async def _import_contacts(rows: list[dict], db: AsyncSession) -> tuple[int, int, list[str]]:
    imported, skipped, errors = 0, 0, []
    for i, row in enumerate(rows):
        last_name = row.get("LastName", "").strip()
        if not last_name:
            skipped += 1
            continue
        try:
            # Try to find matching account
            account_id = None
            acc_name = row.get("AccountName") or row.get("Account.Name", "")
            if acc_name:
                acc_res = await db.execute(select(Account).where(Account.name == acc_name))
                acc = acc_res.scalar_one_or_none()
                if acc:
                    account_id = acc.id

            if not account_id:
                skipped += 1
                errors.append(f"Row {i+2}: No matching account '{acc_name}' – skipped")
                continue

            contact = Contact(
                account_id=account_id,
                first_name=row.get("FirstName", "").strip() or "Unknown",
                last_name=last_name,
                email=row.get("Email") or None,
                phone=row.get("Phone") or None,
                title=row.get("Title") or None,
                is_primary=False,
            )
            db.add(contact)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {e}")
    return imported, skipped, errors


async def _import_leads(rows: list[dict], db: AsyncSession) -> tuple[int, int, list[str]]:
    imported, skipped, errors = 0, 0, []
    for i, row in enumerate(rows):
        company = (row.get("Company") or row.get("company_name", "")).strip()
        last = (row.get("LastName") or "").strip()
        first = (row.get("FirstName") or "").strip()
        if not company and not last:
            skipped += 1
            continue
        try:
            sf_source = (row.get("LeadSource") or "").strip()
            source_key = LEAD_SOURCE_MAP.get(sf_source, "manual")
            volume_raw = row.get("NumberOfEmployees") or row.get("EstimatedVolume", "")
            try:
                volume = int(float(volume_raw)) if volume_raw else None
            except (ValueError, TypeError):
                volume = None

            lead = Lead(
                source=LeadSource(source_key),
                status=LeadStatus.new,
                company_name=company or None,
                contact_name=f"{first} {last}".strip() or None,
                contact_email=row.get("Email") or None,
                qualification_notes=row.get("Description") or None,
                estimated_volume=volume,
                timeline=row.get("Timeline__c") or None,
            )
            db.add(lead)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {e}")
    return imported, skipped, errors


async def _import_deals(rows: list[dict], db: AsyncSession) -> tuple[int, int, list[str]]:
    imported, skipped, errors = 0, 0, []
    for i, row in enumerate(rows):
        title = (row.get("Name") or row.get("Opportunity Name", "")).strip()
        if not title:
            skipped += 1
            continue
        try:
            # Find account
            acc_name = row.get("AccountName") or row.get("Account Name", "")
            account_id = None
            if acc_name:
                acc_res = await db.execute(select(Account).where(Account.name == acc_name.strip()))
                acc = acc_res.scalar_one_or_none()
                if acc:
                    account_id = acc.id

            if not account_id:
                skipped += 1
                errors.append(f"Row {i+2}: No matching account '{acc_name}' – skipped")
                continue

            val_raw = row.get("Amount", "")
            try:
                value = float(str(val_raw).replace(",", ".")) if val_raw else None
            except (ValueError, TypeError):
                value = None

            prob_raw = row.get("Probability", "")
            try:
                prob = int(float(prob_raw)) if prob_raw else 0
            except (ValueError, TypeError):
                prob = 0

            close_date = None
            close_raw = row.get("CloseDate", "")
            if close_raw:
                for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d.%m.%Y"):
                    try:
                        close_date = datetime.strptime(close_raw.strip(), fmt).date()
                        break
                    except ValueError:
                        continue

            deal = Deal(
                title=title,
                account_id=account_id,
                stage="lead_received",
                value_eur=value,
                probability=prob,
                expected_close_date=close_date,
                branding_requirements=row.get("Description") or None,
            )
            db.add(deal)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {e}")
    return imported, skipped, errors


@router.post("/salesforce")
async def import_salesforce(
    object_type: str = Query(..., description="accounts | contacts | leads | deals"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if object_type not in ("accounts", "contacts", "leads", "deals"):
        raise HTTPException(status_code=400, detail="object_type must be one of: accounts, contacts, leads, deals")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    try:
        rows = _parse_rows(content, file.filename or "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

    if not rows:
        return {"imported": 0, "skipped": 0, "errors": [], "message": "File is empty"}

    handlers = {
        "accounts": _import_accounts,
        "contacts": _import_contacts,
        "leads": _import_leads,
        "deals": _import_deals,
    }

    imported, skipped, errors = await handlers[object_type](rows, db)
    await db.commit()

    return {
        "object_type": object_type,
        "total_rows": len(rows),
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:50],  # cap error list
        "message": f"Import complete: {imported} imported, {skipped} skipped, {len(errors)} errors",
    }


@router.get("/export/{object_type}")
async def export_csv(
    object_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export CRM data as CSV. object_type: accounts | contacts | leads | deals"""
    if object_type not in ("accounts", "contacts", "leads", "deals"):
        raise HTTPException(status_code=400, detail="object_type must be one of: accounts, contacts, leads, deals")

    output = io.StringIO()
    writer = csv.writer(output)

    if object_type == "accounts":
        writer.writerow(["id", "name", "type", "status", "industry", "country", "region", "segment", "website", "address", "notes", "created_at"])
        result = await db.execute(select(Account).order_by(Account.name))
        for acc in result.scalars().all():
            writer.writerow([acc.id, acc.name, acc.type, acc.status, acc.industry, acc.country, acc.region, acc.segment, acc.website, acc.address, acc.notes, acc.created_at])

    elif object_type == "contacts":
        writer.writerow(["id", "first_name", "last_name", "email", "phone", "title", "account_name", "is_primary", "created_at"])
        result = await db.execute(
            select(Contact).options(selectinload(Contact.account)).order_by(Contact.last_name)
        )
        for c in result.scalars().all():
            writer.writerow([c.id, c.first_name, c.last_name, c.email, c.phone, c.title, c.account.name if c.account else "", c.is_primary, c.created_at])

    elif object_type == "leads":
        writer.writerow(["id", "company_name", "contact_name", "contact_email", "source", "status", "estimated_volume", "timeline", "qualification_notes", "created_at"])
        result = await db.execute(select(Lead).order_by(Lead.created_at.desc()))
        for lead in result.scalars().all():
            writer.writerow([lead.id, lead.company_name, lead.contact_name, lead.contact_email, lead.source, lead.status, lead.estimated_volume, lead.timeline, lead.qualification_notes, lead.created_at])

    elif object_type == "deals":
        writer.writerow(["id", "title", "account_name", "stage", "value_eur", "probability", "expected_close_date", "created_at"])
        result = await db.execute(
            select(Deal).options(selectinload(Deal.account)).order_by(Deal.created_at.desc())
        )
        for deal in result.scalars().all():
            writer.writerow([deal.id, deal.title, deal.account.name if deal.account else "", deal.stage, deal.value_eur, deal.probability, deal.expected_close_date, deal.created_at])

    csv_content = output.getvalue()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={object_type}_export.csv"},
    )
