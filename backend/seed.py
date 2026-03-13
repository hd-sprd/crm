"""
Seed script – creates admin + demo users and sample data.

Usage:
    cd crm/backend
    python seed.py
"""
import asyncio
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import Base
from app.models.user import User, UserRole
from app.models.account import Account, AccountType, AccountStatus
from app.models.contact import Contact
from app.models.lead import Lead, LeadSource, LeadStatus
from app.models.deal import Deal, DealStage, DealType
from app.models.activity import Activity, ActivityType, RelatedToType as ActivityRelated
from app.models.task import Task, TaskPriority, TaskStatus, RelatedToType as TaskRelated
from app.models.quote import Quote, QuoteStatus
from app.services.auth_service import hash_password

engine = create_async_engine(settings.DATABASE_URL, echo=False)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed():
    async with Session() as db:
        # ── Check if already seeded ──────────────────────────────────────
        existing = await db.execute(select(User).where(User.email == "admin@spreadshirt.com"))
        if existing.scalar_one_or_none():
            print("✓ Already seeded – skipping.")
            return

        print("Seeding database...")

        # ── Users ────────────────────────────────────────────────────────
        admin = User(
            email="admin@spreadshirt.com",
            full_name="Admin User",
            hashed_password=hash_password("admin123"),
            role=UserRole.admin,
            is_active=True,
        )
        manager = User(
            email="manager@spreadshirt.com",
            full_name="Sarah Manager",
            hashed_password=hash_password("manager123"),
            role=UserRole.sales_manager,
            region="DACH",
            is_active=True,
        )
        rep1 = User(
            email="rep1@spreadshirt.com",
            full_name="Max Mustermann",
            hashed_password=hash_password("rep123"),
            role=UserRole.sales_rep,
            region="DACH",
            is_active=True,
        )
        rep2 = User(
            email="rep2@spreadshirt.com",
            full_name="Julia Schmidt",
            hashed_password=hash_password("rep123"),
            role=UserRole.sales_rep,
            region="UK",
            is_active=True,
        )
        am = User(
            email="am@spreadshirt.com",
            full_name="Tom Account",
            hashed_password=hash_password("am123"),
            role=UserRole.account_manager,
            region="DACH",
            is_active=True,
        )
        db.add_all([admin, manager, rep1, rep2, am])
        await db.flush()

        # ── Accounts ─────────────────────────────────────────────────────
        acc1 = Account(
            name="Acme Sports GmbH",
            type=AccountType.b2b,
            segment="Sports",
            industry="Retail",
            website="https://acme-sports.de",
            address="Musterstraße 1, 10115 Berlin",
            country="Germany",
            region="DACH",
            status=AccountStatus.active,
            account_manager_id=rep1.id,
        )
        acc2 = Account(
            name="TechWear UK Ltd",
            type=AccountType.b2b,
            segment="Tech",
            industry="E-Commerce",
            website="https://techwear.co.uk",
            address="123 Oxford Street, London",
            country="United Kingdom",
            region="UK",
            status=AccountStatus.active,
            account_manager_id=rep2.id,
        )
        acc3 = Account(
            name="Stadtfest München Shop",
            type=AccountType.b2b2c,
            segment="Events",
            industry="Entertainment",
            country="Germany",
            region="DACH",
            status=AccountStatus.prospect,
            account_manager_id=am.id,
        )
        acc4 = Account(
            name="FitLife Franchise",
            type=AccountType.b2b,
            segment="Fitness",
            industry="Wellness",
            country="Germany",
            region="DACH",
            status=AccountStatus.prospect,
            account_manager_id=rep1.id,
        )
        db.add_all([acc1, acc2, acc3, acc4])
        await db.flush()

        # ── Contacts ─────────────────────────────────────────────────────
        c1 = Contact(account_id=acc1.id, first_name="Klaus", last_name="Weber",
                     email="k.weber@acme-sports.de", phone="+49 30 12345678",
                     title="Einkaufsleiter", is_primary=True)
        c2 = Contact(account_id=acc1.id, first_name="Anna", last_name="Becker",
                     email="a.becker@acme-sports.de", title="Marketing Manager")
        c3 = Contact(account_id=acc2.id, first_name="James", last_name="Smith",
                     email="j.smith@techwear.co.uk", phone="+44 20 98765432",
                     title="CEO", is_primary=True)
        c4 = Contact(account_id=acc3.id, first_name="Brigitte", last_name="Müller",
                     email="b.mueller@stadtfest.de", title="Organisatorin", is_primary=True)
        db.add_all([c1, c2, c3, c4])
        await db.flush()

        # ── Leads ────────────────────────────────────────────────────────
        l1 = Lead(source=LeadSource.event, company_name="RunnersPro GmbH",
                  contact_name="Peter Lauf", contact_email="p.lauf@runnerspro.de",
                  status=LeadStatus.new, assigned_to=rep1.id,
                  estimated_volume=500, timeline="Q3 2026",
                  use_case="Vereinstrikots für Marathonläufer")
        l2 = Lead(source=LeadSource.website, company_name="Cool Shirts Ltd",
                  contact_name="Emma Brown", contact_email="emma@coolshirts.co.uk",
                  status=LeadStatus.contacted, assigned_to=rep2.id,
                  estimated_volume=1000, timeline="Q2 2026")
        l3 = Lead(source=LeadSource.referral, company_name="Bäckerei Sonnenschein",
                  contact_name="Hans Brot", contact_email="h.brot@baeckerei.de",
                  status=LeadStatus.qualified, assigned_to=rep1.id,
                  estimated_volume=200, use_case="Mitarbeiter-T-Shirts")
        l4 = Lead(source=LeadSource.email, account_id=acc4.id,
                  contact_name="Lisa Fit", contact_email="lisa@fitlife.de",
                  status=LeadStatus.new, assigned_to=rep1.id,
                  estimated_volume=2000)
        db.add_all([l1, l2, l3, l4])
        await db.flush()

        # ── Deals ────────────────────────────────────────────────────────
        d1 = Deal(
            title="Acme Sports – Trikot-Kollektion 2026",
            account_id=acc1.id, contact_id=c1.id, assigned_to=rep1.id,
            type=DealType.standard, stage=DealStage.quote_preparation,
            product_type="T-Shirts, Hoodies", quantity=300,
            branding_requirements="Full-color logo front + back",
            shipping_location="Berlin",
            feasibility_checked=True,
            value_eur=18500, probability=70,
            expected_close_date=date.today() + timedelta(days=30),
        )
        d2 = Deal(
            title="TechWear UK – Conference Merch",
            account_id=acc2.id, contact_id=c3.id, assigned_to=rep2.id,
            type=DealType.standard, stage=DealStage.negotiation,
            product_type="Polo Shirts, Caps", quantity=500,
            branding_requirements="Embroidered logo",
            shipping_location="London",
            feasibility_checked=True,
            value_eur=32000, probability=80,
            expected_close_date=date.today() + timedelta(days=14),
        )
        d3 = Deal(
            title="Stadtfest München – Event-Shirts",
            account_id=acc3.id, contact_id=c4.id, assigned_to=am.id,
            type=DealType.barter, stage=DealStage.needs_assessment,
            product_type="T-Shirts", quantity=150,
            value_eur=5200, probability=40,
            expected_close_date=date.today() + timedelta(days=60),
        )
        d4 = Deal(
            title="FitLife Franchise – Gym Wear Linie",
            account_id=acc4.id, assigned_to=rep1.id,
            type=DealType.custom, stage=DealStage.lead_qualification,
            product_type="Sportswear", quantity=1000,
            value_eur=65000, probability=25,
            expected_close_date=date.today() + timedelta(days=90),
        )
        d5 = Deal(
            title="Acme Sports – Repeat Order Hoodies",
            account_id=acc1.id, contact_id=c1.id, assigned_to=rep1.id,
            type=DealType.standard, stage=DealStage.deal_closed_won,
            product_type="Hoodies", quantity=200,
            feasibility_checked=True, artwork_approved=True,
            invoice_reference="INV-2025-0042", payment_received=True,
            value_eur=12400, probability=100,
        )
        db.add_all([d1, d2, d3, d4, d5])
        await db.flush()

        # ── Quote for d2 ─────────────────────────────────────────────────
        q1 = Quote(
            deal_id=d2.id, version=1,
            line_items=[
                {"product": "Polo Shirt (S-XL)", "qty": 350, "unit_price": 42.0, "total": 14700.0},
                {"product": "Polo Shirt (2XL+)", "qty": 150, "unit_price": 46.0, "total": 6900.0},
                {"product": "Cap", "qty": 500, "unit_price": 18.0, "total": 9000.0},
            ],
            shipping_cost=400.0,
            production_cost=1000.0,
            total_value=32000.0,
            status=QuoteStatus.sent,
            payment_terms="Net 30",
            validity_days=30,
        )
        db.add(q1)
        await db.flush()
        d2.quote_id = q1.id

        # ── Activities ───────────────────────────────────────────────────
        acts = [
            Activity(type=ActivityType.call, related_to_type=ActivityRelated.deal,
                     related_to_id=d1.id, assigned_to=rep1.id,
                     subject="Erstgespräch – Anforderungen besprochen",
                     body="Klaus Weber möchte bis Ende Mai ein Angebot."),
            Activity(type=ActivityType.email, related_to_type=ActivityRelated.deal,
                     related_to_id=d2.id, assigned_to=rep2.id,
                     subject="Quote v1 sent to James Smith",
                     body="Angebot per E-Mail versendet."),
            Activity(type=ActivityType.meeting, related_to_type=ActivityRelated.account,
                     related_to_id=acc1.id, assigned_to=rep1.id,
                     subject="Vor-Ort-Termin bei Acme Sports",
                     body="Muster-T-Shirts präsentiert. Positive Resonanz."),
            Activity(type=ActivityType.note, related_to_type=ActivityRelated.lead,
                     related_to_id=l3.id, assigned_to=rep1.id,
                     subject="Qualifizierung abgeschlossen",
                     body="Budget vorhanden, Entscheidung im Mai."),
        ]
        db.add_all(acts)

        # ── Tasks ────────────────────────────────────────────────────────
        tasks = [
            Task(title="Angebot für Acme Sports fertigstellen",
                 related_to_type=TaskRelated.deal, related_to_id=d1.id,
                 assigned_to=rep1.id, priority=TaskPriority.high,
                 due_date=date.today() + timedelta(days=3), status=TaskStatus.open),
            Task(title="Nachfassen TechWear UK – Angebot akzeptiert?",
                 related_to_type=TaskRelated.deal, related_to_id=d2.id,
                 assigned_to=rep2.id, priority=TaskPriority.high,
                 due_date=date.today() + timedelta(days=1), status=TaskStatus.open),
            Task(title="Stadtfest – Bedarfsanalyse durchführen",
                 related_to_type=TaskRelated.deal, related_to_id=d3.id,
                 assigned_to=am.id, priority=TaskPriority.medium,
                 due_date=date.today() + timedelta(days=7), status=TaskStatus.open),
            Task(title="FitLife – Erstgespräch vereinbaren",
                 related_to_type=TaskRelated.lead, related_to_id=l4.id,
                 assigned_to=rep1.id, priority=TaskPriority.medium,
                 due_date=date.today() + timedelta(days=5), status=TaskStatus.open),
            Task(title="RunnersPro Lead qualifizieren",
                 related_to_type=TaskRelated.lead, related_to_id=l1.id,
                 assigned_to=rep1.id, priority=TaskPriority.low,
                 due_date=date.today() - timedelta(days=1), status=TaskStatus.open),  # overdue
        ]
        db.add_all(tasks)

        await db.commit()

    print("")
    print("✅ Seed completed!")
    print("")
    print("  Login credentials:")
    print("  ┌──────────────────────────────────────┬──────────────┬──────────────────┐")
    print("  │ E-Mail                               │ Passwort     │ Rolle            │")
    print("  ├──────────────────────────────────────┼──────────────┼──────────────────┤")
    print("  │ admin@spreadshirt.com                │ admin123     │ Admin            │")
    print("  │ manager@spreadshirt.com              │ manager123   │ Sales Manager    │")
    print("  │ rep1@spreadshirt.com                 │ rep123       │ Sales Rep        │")
    print("  │ rep2@spreadshirt.com                 │ rep123       │ Sales Rep        │")
    print("  │ am@spreadshirt.com                   │ am123        │ Account Manager  │")
    print("  └──────────────────────────────────────┴──────────────┴──────────────────┘")
    print("")
    print("  Demo data: 4 accounts, 4 contacts, 4 leads, 5 deals, 1 quote, 4 activities, 5 tasks")


if __name__ == "__main__":
    asyncio.run(seed())
