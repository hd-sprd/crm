#!/usr/bin/env python3
"""
Salesforce → CRM Migration Script
===================================
Liest die rohen Salesforce-Export-CSVs, filtert sinnvolle B2B-Datensätze
und erzeugt bereinigte CSVs für den CRM-Import-Endpoint
(/api/v1/import/salesforce?object_type=...).

Verarbeitungs-Strategie
-----------------------
Account.csv hat nur 2 Zeilen (SF-Export war limitiert). Die echten Account-Daten
stecken in den Leads (ConvertedAccountId + Company). Daher:

  1. Leads   → B2B-Leads extrahieren + Account-Map aufbauen
  2. Accounts → Account.csv + einzigartige Firmennamen aus B2B-Leads
  3. Contacts → nur Contacts, deren AccountId einem B2B-Converted-Lead entspricht
  4. Deals   → Opportunities mappen

Verwendung:
    python sf_migrate.py [--sf-dir PATH] [--out-dir PATH] [--dry-run]
                         [--min-date YYYY-MM-DD] [--lead-record-types TYPE1,TYPE2]
"""

import csv
import os
import re
import sys
import argparse
from datetime import date, datetime, timedelta

# Default: letzte 3 Jahre
DEFAULT_MIN_DATE: date = (datetime.now() - timedelta(days=3 * 365)).date()

# ---------------------------------------------------------------------------
# Pfade
# ---------------------------------------------------------------------------
DEFAULT_SF_DIR = "/Volumes/root/departments/bulk/Salesforce Data Migration 2026"
DEFAULT_OUT_DIR = os.path.join(os.path.dirname(__file__), "sf_output")

SF_FILES = {
    "accounts":    "WE_00D20000000BoABEA0_3/Account.csv",
    "contacts":    "WE_00D20000000BoABEA0_4/Contact.csv",
    "leads":       "WE_00D20000000BoABEA0_5/Lead.csv",
    "opps":        "WE_00D20000000BoABEA0_3/Opportunity.csv",
    "opp_items":   "WE_00D20000000BoABEA0_3/OpportunityLineItem.csv",
    "revenue_eu":  "WE_00D20000000BoABEA0_1/net_item_revenue_incl_comission__c.csv",
    "revenue_na":  "WE_00D20000000BoABEA0_1/net_item_revenue_incl_comission_NA__c.csv",
}

ENCODING = "latin-1"

# ---------------------------------------------------------------------------
# Lead-Filter: B2B-relevante Record-Typen (lowercase)
# ---------------------------------------------------------------------------
B2B_LEAD_RECORD_TYPES = {
    "bulk_lead_record_type",
    "bulk_eu_leads",
    "eu_sales_record_type",
    "license_lead_record_type",
    "strategic_alliances_lead",
    "sales_dach_tas_record_typ",
}

SKIP_LEAD_STATUSES = {
    "closed/lost", "unqualified", "shop opened*", "shop opened", "closed/has shop",
}

# ---------------------------------------------------------------------------
# Firmenname-Bereinigung
# ---------------------------------------------------------------------------
JUNK_COMPANIES = {
    "", "-", ".", "1", "2", "3", "n/a", "na", "none", "null",
    "unknown", "unkown", "privat", "private", "personal", "keine",
    "missing", "not provided", "[not provided]", "google", "schule",
    "herr", "spreadshirt", "test",
}


def is_valid_company(name: str) -> bool:
    n = name.strip()
    if not n or len(n) < 3:
        return False
    if n.lower() in JUNK_COMPANIES:
        return False
    if re.fullmatch(r"[\d\s\-\.]+", n):   # nur Ziffern/Leerzeichen
        return False
    return True


# ---------------------------------------------------------------------------
# Lead-Source und Stage-Mapping
# ---------------------------------------------------------------------------
LEAD_SOURCE_MAP = {
    "web": "website", "website": "website",
    "email": "email",
    "event": "event",
    "referral": "referral",
    "inquiry form": "website",
    "sprd website": "website",
    "": "manual",
}

STAGE_MAP = {
    "Prospecting": "lead_received", "Qualification": "lead_qualification",
    "Qualified": "lead_qualification", "Needs Analysis": "needs_assessment",
    "Value Proposition": "needs_assessment",
    "Proposal/Price Quote": "quote_preparation", "Quote Sent": "quote_sent",
    "Negotiation/Review": "negotiation", "Negotiation": "negotiation",
    "Closed Won": "deal_closed_won", "Closed Lost": "lost", "On Hold": "on_hold",
    "Contacted": "lead_qualification", "Meeting": "needs_assessment",
    "Sample Sent": "feasibility_check", "Order Confirmed": "order_confirmed",
    "In Production": "in_production",
}


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

def read_csv(path: str):
    with open(path, encoding=ENCODING, errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        yield from reader


def v(row: dict, *keys: str) -> str:
    for k in keys:
        val = (row.get(k) or "").strip()
        if val:
            return val
    return ""


def is_deleted(row: dict) -> bool:
    return row.get("IsDeleted", "0") == "1"


def parse_sf_date(value: str) -> date | None:
    """Parst SF-Datumswerte: '2024-03-16 22:44:13' oder '2024-03-16'."""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip()[:19], fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


def after_cutoff(row: dict, min_date: date, *date_fields: str) -> bool:
    """True wenn mindestens ein Datumsfeld >= min_date (oder kein Datum vorhanden)."""
    for field in date_fields:
        val = (row.get(field) or "").strip()
        if val:
            d = parse_sf_date(val)
            if d is not None:
                return d >= min_date
    return True  # kein Datum → nicht ausschließen


def build_address(row: dict, prefix: str = "Billing") -> str:
    parts = [
        v(row, f"{prefix}Street"),
        v(row, f"{prefix}City"),
        v(row, f"{prefix}PostalCode"),
        v(row, f"{prefix}State"),
    ]
    return ", ".join(p for p in parts if p)


def map_lead_source(sf_val: str) -> str:
    return LEAD_SOURCE_MAP.get(sf_val.lower(), "manual")


def map_stage(sf_stage: str) -> str:
    return STAGE_MAP.get(sf_stage, "lead_received")


def write_csv(path: str, rows: list[dict], fieldnames: list[str]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


# ---------------------------------------------------------------------------
# PASS 1: Leads verarbeiten + Account-Map aufbauen
# ---------------------------------------------------------------------------

def process_leads_and_build_account_map(
    sf_dir: str,
    extra_record_types: set[str] | None = None,
    min_date: date = DEFAULT_MIN_DATE,
) -> tuple[list[dict], list[str], dict[str, str], set[str], dict[str, str], dict[str, str], dict[str, str]]:
    """
    Gibt zurück:
      lead_rows        – CRM-Zeilen für leads_import.csv
      log              – Report-Meldungen
      sf_acc_id_map    – {SF-AccountId: company_name}  (aus ConvertedAccountId)
      b2b_companies    – einzigartige, bereinigte Firmennamen aus B2B-Leads
      opp_to_company   – {SF-OppId: company_name}  (aus ConvertedOpportunityId)
      eu_pid_to_company – {EU-Partner-ID: company_name}  (aus shop_partner_id_lead__c)
      na_pid_to_company – {NA-Partner-ID: company_name}  (aus sprd_partner_id_NA__c)
    """
    path = os.path.join(sf_dir, SF_FILES["leads"])
    lead_rows, log = [], []
    total = skipped = converted_skip = status_skip = filtered_out = 0

    # Account-Map: SF-AccountId → Firmenname (aus konvertierten Leads)
    sf_acc_id_map: dict[str, str] = {}
    b2b_companies: set[str] = set()
    # Deal-Match-Maps: für Revenue-Deals
    opp_to_company: dict[str, str] = {}     # SF-OppId → Firmenname
    eu_pid_to_company: dict[str, str] = {}  # EU-Partner-ID → Firmenname
    na_pid_to_company: dict[str, str] = {}  # NA-Partner-ID → Firmenname

    allowed_types = B2B_LEAD_RECORD_TYPES | (extra_record_types or set())
    NULL_ID = "000000000000000AAA"

    for row in read_csv(path):
        total += 1
        if is_deleted(row):
            skipped += 1
            continue

        company = v(row, "Company")
        caid = (row.get("ConvertedAccountId") or "").strip()

        # Alle konvertierten Leads → Account-Map + Opp-Map aufbauen
        if row.get("IsConverted", "0") == "1" and caid and caid != NULL_ID and company:
            if is_valid_company(company):
                if after_cutoff(row, min_date, "ConvertedDate", "CreatedDate"):
                    sf_acc_id_map[caid] = company
                # ConvertedOpportunityId → company (für Revenue-Deal-Matching, alle Jahre)
                opp_id = (row.get("ConvertedOpportunityId") or "").strip()
                if opp_id and opp_id != NULL_ID:
                    opp_to_company[opp_id] = company
            converted_skip += 1
            continue  # Konvertierte nicht als Lead importieren

        # Partner-IDs aus allen (inkl. nicht-konvertierten) Leads sammeln
        if company and is_valid_company(company):
            eu_pid = (row.get("shop_partner_id_lead__c") or "").strip()
            na_pid = (row.get("sprd_partner_id_NA__c") or "").strip()
            if eu_pid and eu_pid.isdigit():
                eu_pid_to_company[eu_pid] = company
            if na_pid and na_pid.isdigit():
                na_pid_to_company[na_pid] = company

        # Datumsfilter für nicht-konvertierte Leads
        if not after_cutoff(row, min_date, "CreatedDate"):
            skipped += 1
            continue

        status = v(row, "Status").lower()
        if status in SKIP_LEAD_STATUSES:
            status_skip += 1
            continue

        first = v(row, "FirstName")
        last  = v(row, "LastName")
        email = v(row, "Email")

        if not company and not last:
            skipped += 1
            continue

        # B2B-Filter
        record_type  = v(row, "Record_Type_hidden__c").lower()
        channel_bulk = v(row, "Channel_bulk__c")
        anzahl_bulk  = v(row, "Anzahl_bulk__c")
        deal_desc    = v(row, "Deal_Description__c")
        shipping_loc = v(row, "Shipping_Location__c")

        is_b2b = (
            record_type in allowed_types
            or bool(channel_bulk)
            or bool(anzahl_bulk)
            or bool(deal_desc)
            or bool(shipping_loc)
        )

        if not is_b2b:
            filtered_out += 1
            continue

        # B2B-Firma für Account-Erstellung vormerken
        if company and is_valid_company(company):
            b2b_companies.add(company)

        sf_source = v(row, "LeadSource", "Lead_Source_spreadshop__c")
        crm_source = map_lead_source(sf_source)

        volume_raw = v(row, "Anzahl_bulk__c", "NumberOfEmployees")
        try:
            vol_int = int(float(volume_raw)) if volume_raw else None
            # Kap auf PostgreSQL INTEGER-Range; Telefonnummern im NumberOfEmployees-Feld filtern
            volume = str(vol_int) if vol_int is not None and 0 <= vol_int <= 2_147_483_647 else ""
        except (ValueError, TypeError):
            volume = ""

        notes_parts = []
        for field, label in [
            ("Deal_Description__c",            "Beschreibung"),
            ("Art_und_Farbe_des_Produkts__c",   "Produkt"),
            ("Beschreibung_Motiv__c",            "Motiv"),
            ("preisvorstellung__c",              "Preisvorstellung"),
            ("Shipping_Location__c",             "Lieferort"),
            ("gewuenschter_Liefertermin__c",     "Liefertermin"),
            ("Channel_bulk__c",                  "Kanal"),
            ("Notes__c",                         "Notizen"),
            ("Bemerkungen__c",                   "Bemerkungen"),
        ]:
            val = v(row, field)
            if val:
                notes_parts.append(f"{label}: {val}")

        lead_rows.append({
            "Company":          company,
            "FirstName":        first,
            "LastName":         last,
            "Email":            email,
            "Phone":            v(row, "Phone", "MobilePhone"),
            "LeadSource":       crm_source,
            "NumberOfEmployees": volume,
            "Description":      " | ".join(notes_parts),
            "Timeline__c":      v(row, "gewuenschter_Liefertermin__c", "campaign_duration__c"),
        })

        if len(lead_rows) <= 100:
            log.append(f"  ✓ Lead: {first} {last} / {company} <{email}> [{crm_source}]")

    if len(lead_rows) > 100:
        log.append(f"  ... (weitere {len(lead_rows) - 100} Leads nicht einzeln gelistet)")

    log.insert(0, (
        f"[Leads] {total} gelesen, {converted_skip} konvertierte in Account-Map, "
        f"{status_skip} Status-Skip, {skipped} ohne Inhalt, "
        f"{filtered_out} nicht-B2B, {len(lead_rows)} exportiert | "
        f"Account-Map: {len(sf_acc_id_map)} SF-IDs, {len(b2b_companies)} Firmen-Namen | "
        f"Opp-Map: {len(opp_to_company)} Opp-IDs, "
        f"EU-PID-Map: {len(eu_pid_to_company)}, NA-PID-Map: {len(na_pid_to_company)}"
    ))
    return lead_rows, log, sf_acc_id_map, b2b_companies, opp_to_company, eu_pid_to_company, na_pid_to_company


# ---------------------------------------------------------------------------
# PASS 2: Accounts
# ---------------------------------------------------------------------------

def process_accounts(
    sf_dir: str,
    sf_acc_id_map: dict[str, str],
    b2b_companies: set[str],
    min_date: date = DEFAULT_MIN_DATE,
) -> tuple[list[dict], list[str], dict[str, str]]:
    """
    Quellen:
      1. Account.csv  (direkt)
      2. Firmennamen aus B2B-Leads  (b2b_companies)
      3. Firmennamen aus konvertierten Leads  (sf_acc_id_map)

    Gibt zurück:
      rows          – CRM-Zeilen für accounts_import.csv
      log
      name_to_id_map – {account_name: sf_account_id}  (für Contact-Verknüpfung)
    """
    path = os.path.join(sf_dir, SF_FILES["accounts"])
    log = []

    # Alle einzigartigen Firmennamen sammeln
    seen_names: dict[str, dict] = {}  # name (lower) → CRM-row

    # --- 1. Account.csv ---
    csv_count = 0
    for row in read_csv(path):
        if is_deleted(row):
            continue
        if not after_cutoff(row, min_date, "CreatedDate", "LastModifiedDate"):
            continue
        name = v(row, "Name")
        if not name:
            continue

        industry = v(row, "Industry", "Industry_sector__c")
        address  = build_address(row, "Billing") or build_address(row, "Shipping")
        country  = v(row, "BillingCountry", "ShippingCountry")
        segment  = v(row, "Customer_type__c", "Type", "channel_account__c")
        website  = v(row, "Website", "EU_shop_link__c", "NA_shop_link__c", "Shop_Link__c")

        notes_parts = []
        for field, label in [
            ("ABAS_Customer_Number__c",  "ABAS#"),
            ("VAT_ID__c",                "VAT-ID"),
            ("sprd_Partner_ID_EU__c",    "Partner-ID EU"),
            ("sprd_Partner_ID_NA__c",    "Partner-ID NA"),
            ("spod_Merchant_ID__c",      "SPOD Merchant-ID"),
            ("Tribe2__c",                "Tribe"),
            ("Sub_Tribe__c",             "Sub-Tribe"),
            ("Notes__c",                 "Notes"),
            ("Description",              "Description"),
        ]:
            val = v(row, field)
            if val:
                notes_parts.append(f"{label}: {val}")

        crm_row = {
            "Name": name,
            "Industry": industry,
            "Website": website,
            "BillingCountry": country,
            "BillingStreet": address,
            "Segment__c": segment,
            "Description": " | ".join(notes_parts),
        }
        seen_names[name.lower()] = crm_row
        csv_count += 1

    log.append(f"  Aus Account.csv: {csv_count} Accounts")

    # --- 2. Firmennamen aus konvertierten Leads (sf_acc_id_map) ---
    conv_count = 0
    for sf_id, company in sf_acc_id_map.items():
        key = company.lower()
        if key not in seen_names:
            seen_names[key] = {
                "Name": company,
                "Industry": "", "Website": "", "BillingCountry": "",
                "BillingStreet": "", "Segment__c": "bulk",
                "Description": f"SF-Account-ID: {sf_id}",
            }
            conv_count += 1

    log.append(f"  Aus konvertierten Leads: {conv_count} neue Accounts")

    # --- 3. Firmennamen aus nicht-konvertierten B2B-Leads ---
    b2b_count = 0
    for company in b2b_companies:
        key = company.lower()
        if key not in seen_names:
            seen_names[key] = {
                "Name": company,
                "Industry": "", "Website": "", "BillingCountry": "",
                "BillingStreet": "", "Segment__c": "bulk",
                "Description": "",
            }
            b2b_count += 1

    log.append(f"  Aus B2B-Leads (Firma-Feld): {b2b_count} neue Accounts")

    rows = list(seen_names.values())

    # name_to_id_map: Firmennamen → SF-AccountId (umgekehrte sf_acc_id_map)
    # Wird für Contact-Verknüpfung gebraucht (Contact.AccountId → Firmenname)
    sf_id_to_name = sf_acc_id_map  # {sf_id: name}

    log.insert(0, f"[Accounts] {len(rows)} Accounts total exportiert")
    return rows, log, sf_id_to_name


# ---------------------------------------------------------------------------
# PASS 3: Contacts
# ---------------------------------------------------------------------------

def process_contacts(
    sf_dir: str,
    sf_id_to_name: dict[str, str],   # {SF-AccountId: Firmenname}
    account_csv_ids: set[str],        # SF-IDs aus Account.csv
) -> tuple[list[dict], list[str]]:
    """
    Filtert Contacts auf:
      - Nicht gelöscht
      - AccountId muss in sf_id_to_name ODER account_csv_ids sein
      - Mindestens Nachname vorhanden
    """
    path = os.path.join(sf_dir, SF_FILES["contacts"])
    rows, log = [], []
    total = skipped = no_account = 0

    NULL_ID = "000000000000000AAA"
    all_relevant_sf_ids = set(sf_id_to_name.keys()) | account_csv_ids

    print(f"        (Filtere nach {len(all_relevant_sf_ids):,} SF-Account-IDs …)")

    for row in read_csv(path):
        total += 1
        if total % 200_000 == 0:
            print(f"        … {total:,} Zeilen gelesen, {len(rows):,} Contacts bisher …")

        if is_deleted(row):
            skipped += 1
            continue

        last_name = v(row, "LastName")
        if not last_name:
            skipped += 1
            continue

        sf_acc_id = (row.get("AccountId") or "").strip()
        if not sf_acc_id or sf_acc_id == NULL_ID:
            no_account += 1
            continue

        if sf_acc_id not in all_relevant_sf_ids:
            no_account += 1
            continue

        acc_name = sf_id_to_name.get(sf_acc_id, f"SF_Account_{sf_acc_id}")

        rows.append({
            "FirstName":    v(row, "FirstName"),
            "LastName":     last_name,
            "Email":        v(row, "Email"),
            "Phone":        v(row, "Phone", "MobilePhone"),
            "Title":        v(row, "Title"),
            "Account Name": acc_name,
        })

        if len(rows) <= 100:
            log.append(f"  ✓ Contact: {v(row,'FirstName')} {last_name} → {acc_name}")

    if len(rows) > 100:
        log.append(f"  … (weitere {len(rows) - 100} Contacts nicht einzeln gelistet)")

    log.insert(0, (
        f"[Contacts] {total:,} gelesen, {skipped:,} ohne Nachname, "
        f"{no_account:,} kein B2B-Account, {len(rows):,} exportiert"
    ))
    return rows, log


# ---------------------------------------------------------------------------
# PASS 4: Deals aus Revenue-Custom-Objects + Opportunity.csv
# ---------------------------------------------------------------------------

def _extract_partner_id(external_id: str) -> str | None:
    """Extrahiert Partner-ID aus SF external_id__c (Format: YYYY+Q-digit+partner_id)."""
    if not external_id or 'E' in external_id or 'e' in external_id:
        return None
    if len(external_id) < 6:
        return None
    pid = external_id[5:]  # Strip YYYY (4) + quarter digit (1)
    return pid if pid.isdigit() else None


def process_deals(
    sf_dir: str,
    sf_id_to_name: dict[str, str],
    account_csv_ids_map: dict[str, str],
    opp_to_company: dict[str, str],
    eu_pid_to_company: dict[str, str],
    na_pid_to_company: dict[str, str],
    min_date: date = DEFAULT_MIN_DATE,
) -> tuple[list[dict], list[str], list[dict]]:
    """
    Verarbeitet Deals aus:
      1. Revenue Custom Objects (EU + NA) – historische Quartalsumsätze per Partner
      2. Opportunity.csv – neueste SF Opportunities

    Matching-Reihenfolge für Firmenname:
      a) opp_to_company[deal_id]  (ConvertedOpportunityId aus Leads)
      b) eu_pid_to_company[partner_id]  (shop_partner_id_lead__c aus Leads)
      c) na_pid_to_company[partner_id]  (sprd_partner_id_NA__c aus Leads)
      d) Fallback: "Partner EU {pid}" / "Partner NA {pid}"

    Gibt zurück:
      rows             – CRM-Zeilen für deals_import.csv
      log
      partner_accounts – Placeholder-Accounts für unmatched Partners
    """
    from collections import defaultdict

    rows, log = [], []
    partner_accounts: list[dict] = []  # Zusätzliche Accounts für ungematchte Partner
    seen_partner_accounts: set[str] = set()

    all_acc_map = {**sf_id_to_name, **account_csv_ids_map}

    # ── 1. Revenue Custom Objects ─────────────────────────────────────────
    # Aggregiere Quartalsumsätze pro Deal__c
    # Each entry: {revenue: float, last_quarter: date|None, pid_eu: str|None, pid_na: str|None}
    deal_data: dict[str, dict] = defaultdict(
        lambda: {"revenue": 0.0, "last_quarter": None, "pid_eu": None, "pid_na": None}
    )

    for key, region in [("revenue_eu", "EU"), ("revenue_na", "NA")]:
        path = os.path.join(sf_dir, SF_FILES[key])
        if not os.path.exists(path):
            log.append(f"  ⚠ Revenue-Datei nicht gefunden: {path}")
            continue
        pid_field = "pid_eu" if region == "EU" else "pid_na"
        for row in read_csv(path):
            if row.get("IsDeleted", "0") == "1":
                continue
            deal_id = (row.get("Deal__c") or "").strip()
            if not deal_id:
                continue
            ext_id = (row.get("external_id__c") or "").strip()
            rev_raw = (row.get("net_item_revenue_incl_comission__c") or "").strip()
            quarter_raw = (row.get("Financial_Quarter__c") or "").strip()
            try:
                rev = float(rev_raw)
            except (ValueError, TypeError):
                rev = 0.0
            qd = parse_sf_date(quarter_raw)
            deal_data[deal_id]["revenue"] += rev
            if qd and (deal_data[deal_id]["last_quarter"] is None or qd > deal_data[deal_id]["last_quarter"]):
                deal_data[deal_id]["last_quarter"] = qd
            pid = _extract_partner_id(ext_id)
            if pid and not deal_data[deal_id][pid_field]:
                deal_data[deal_id][pid_field] = pid

    rev_total = len(deal_data)
    rev_recent = 0
    rev_matched = 0
    rev_placeholder = 0

    for deal_id, info in deal_data.items():
        # Datumsfilter: letzter Quartalsumsatz muss >= min_date
        last_q = info["last_quarter"]
        if last_q is None or last_q < min_date:
            continue
        rev_recent += 1

        # Firmenname bestimmen
        acc_name: str = ""
        matched_via: str = ""
        pid_eu = info["pid_eu"]
        pid_na = info["pid_na"]

        if deal_id in opp_to_company:
            acc_name = opp_to_company[deal_id]
            matched_via = "opp"
        elif pid_eu and pid_eu in eu_pid_to_company:
            acc_name = eu_pid_to_company[pid_eu]
            matched_via = "eu_pid"
        elif pid_na and pid_na in na_pid_to_company:
            acc_name = na_pid_to_company[pid_na]
            matched_via = "na_pid"
        else:
            # Fallback: Placeholder-Account
            pid = pid_eu or pid_na or deal_id[:8]
            region_label = "EU" if pid_eu else ("NA" if pid_na else "SF")
            acc_name = f"Partner {region_label} {pid}"
            matched_via = "placeholder"
            rev_placeholder += 1
            if acc_name not in seen_partner_accounts:
                seen_partner_accounts.add(acc_name)
                partner_accounts.append({
                    "Name": acc_name,
                    "Industry": "", "Website": "", "BillingCountry": "",
                    "BillingStreet": "", "Segment__c": "bulk",
                    "Description": f"SF-Deal-ID: {deal_id} | Partner-ID: {pid}",
                })
        if matched_via != "placeholder":
            rev_matched += 1

        title = acc_name  # Deal-Titel = Firmenname (historischer Revenue-Deal)
        rev_str = f"{info['revenue']:.2f}" if info["revenue"] else ""
        desc_parts = [f"SF-Opp: {deal_id}"]
        if pid_eu:
            desc_parts.append(f"Partner-EU: {pid_eu}")
        if pid_na:
            desc_parts.append(f"Partner-NA: {pid_na}")
        desc_parts.append(f"Region: {'EU+NA' if pid_eu and pid_na else ('EU' if pid_eu else 'NA')}")

        rows.append({
            "Name":         title,
            "Account Name": acc_name,
            "Amount":       rev_str,
            "Probability":  "100",
            "CloseDate":    last_q.strftime("%Y-%m-%d") if last_q else "",
            "Description":  " | ".join(desc_parts),
        })

    log.append(
        f"  Revenue-Deals: {rev_total} gesamt, {rev_recent} in den letzten 3 Jahren, "
        f"{rev_matched} mit Firmenname, {rev_placeholder} mit Placeholder-Account"
    )

    # ── 2. Opportunity.csv ────────────────────────────────────────────────
    opp_path = os.path.join(sf_dir, SF_FILES["opps"])
    opp_total = opp_skipped = opp_no_acc = 0
    for row in read_csv(opp_path):
        opp_total += 1
        if is_deleted(row):
            opp_skipped += 1
            continue
        title = v(row, "Name")
        if not title:
            opp_skipped += 1
            continue

        sf_acc_id = (row.get("AccountId") or "").strip()
        acc_name = all_acc_map.get(sf_acc_id, "")
        if not acc_name:
            opp_no_acc += 1
            # Ohne Account kann der Deal nicht importiert werden
            continue

        sf_stage = v(row, "StageName")
        amount = v(row, "Amount", "Amount_USD__c")
        try:
            amount = str(float(amount.replace(",", "."))) if amount else ""
        except (ValueError, TypeError):
            amount = ""

        notes_parts = []
        for field, label in [
            ("Description",                "Beschreibung"),
            ("Deal_Description__c",        "Deal-Info"),
            ("Jira_Ticket__c",             "Jira"),
            ("Order_number_ABAS__c",       "ABAS-Order"),
            ("Reasons_for_Closed_Lost__c", "Verlustgrund"),
            ("Closed_lost_reason_bulk__c", "Verlustgrund Bulk"),
        ]:
            val = v(row, field)
            if val:
                notes_parts.append(f"{label}: {val}")

        rows.append({
            "Name":         title,
            "Account Name": acc_name,
            "Amount":       amount,
            "Probability":  v(row, "Probability"),
            "CloseDate":    v(row, "CloseDate", "Date_Closed_Won__c"),
            "Description":  " | ".join(notes_parts),
        })
        log.append(f"  ✓ Opp: {title} → {acc_name} [{sf_stage}→{map_stage(sf_stage)}]")

    log.append(
        f"  Opportunity.csv: {opp_total} gelesen, {opp_skipped} übersprungen, "
        f"{opp_no_acc} ohne Account-Match"
    )

    log.insert(0, f"[Deals] {len(rows)} exportiert ({rev_recent} Revenue + {opp_total - opp_skipped - opp_no_acc} Opps)")
    return rows, log, partner_accounts


# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Salesforce → CRM Migrations-Script")
    parser.add_argument("--sf-dir",  default=DEFAULT_SF_DIR,  help="Pfad zum SF-Export-Ordner")
    parser.add_argument("--out-dir", default=DEFAULT_OUT_DIR, help="Ausgabe-Ordner für die CSVs")
    parser.add_argument("--dry-run", action="store_true",     help="Nur Report, keine Dateien schreiben")
    parser.add_argument("--skip-contacts", action="store_true",
                        help="Contact.csv (2M Zeilen) überspringen – spart ~5 min")
    parser.add_argument("--lead-record-types", default="",
                        help="Zusätzliche Lead Record-Typen (komma-getrennt, lowercase)")
    parser.add_argument("--min-date", default="",
                        help="Nur Datensätze ab diesem Datum importieren (YYYY-MM-DD). "
                             f"Standard: letzte 3 Jahre ({DEFAULT_MIN_DATE})")
    args = parser.parse_args()

    sf_dir  = args.sf_dir
    out_dir = args.out_dir
    extra_types = {t.strip().lower() for t in args.lead_record_types.split(",") if t.strip()}

    if args.min_date:
        try:
            min_date = datetime.strptime(args.min_date, "%Y-%m-%d").date()
        except ValueError:
            print(f"⚠  Ungültiges Datum '{args.min_date}', verwende Standard {DEFAULT_MIN_DATE}", file=sys.stderr)
            min_date = DEFAULT_MIN_DATE
    else:
        min_date = DEFAULT_MIN_DATE

    for rel_path in SF_FILES.values():
        full_path = os.path.join(sf_dir, rel_path)
        if not os.path.exists(full_path):
            print(f"⚠  Datei nicht gefunden: {full_path}", file=sys.stderr)

    print("=" * 65)
    print("  Salesforce → CRM Migration")
    print(f"  Quelle:  {sf_dir}")
    print(f"  Ausgabe: {out_dir}")
    print(f"  Datum:   {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Ab:      {min_date} (--min-date)")
    print("=" * 65)

    report_lines: list[str] = []

    # --- Schritt 1: Leads + Account-Map + Deal-Matching-Maps ---
    print("\n[1/4] Leads verarbeiten + Account-Map aufbauen …")
    lead_rows, lead_log, sf_acc_id_map, b2b_companies, opp_to_company, eu_pid_to_company, na_pid_to_company = \
        process_leads_and_build_account_map(sf_dir, extra_types, min_date)
    report_lines += lead_log
    print(lead_log[0])

    # --- Schritt 2: Accounts ---
    print("\n[2/4] Accounts aufbauen …")
    acc_rows, acc_log, sf_id_to_name = process_accounts(sf_dir, sf_acc_id_map, b2b_companies, min_date)
    report_lines += acc_log
    for line in acc_log:
        print(line)

    # Für Deal-Verknüpfung: Account.csv SF-IDs → Name
    account_csv_extra: dict[str, str] = {}
    acc_path = os.path.join(sf_dir, SF_FILES["accounts"])
    for row in read_csv(acc_path):
        sf_id = row.get("Id", "").strip()
        name  = v(row, "Name")
        if sf_id and name:
            account_csv_extra[sf_id] = name

    # --- Schritt 3: Contacts ---
    if args.skip_contacts:
        print("\n[3/4] Contacts übersprungen (--skip-contacts).")
        con_rows: list[dict] = []
        report_lines.append("[Contacts] übersprungen")
    else:
        print(f"\n[3/4] Contacts filtern (läuft durch ~2M Zeilen, bitte warten) …")
        con_rows, con_log = process_contacts(sf_dir, sf_id_to_name, set(account_csv_extra.keys()))
        report_lines += con_log
        print(con_log[0])

    # --- Schritt 4: Deals (Revenue Custom Objects + Opportunity.csv) ---
    print("\n[4/4] Deals verarbeiten (Revenue-Objekte + Opportunities) …")
    deal_rows, deal_log, partner_accounts = process_deals(
        sf_dir, sf_id_to_name, account_csv_extra,
        opp_to_company, eu_pid_to_company, na_pid_to_company,
        min_date,
    )
    report_lines += deal_log
    print(deal_log[0])

    # Alle Account-Namen aus deal_rows sicherstellen (Partner-Placeholder + gematchte Namen)
    existing_names = {r["Name"].lower() for r in acc_rows}
    new_accounts: list[dict] = []

    # a) Placeholder-Accounts für ungematchte Partner
    for pa in partner_accounts:
        if pa["Name"].lower() not in existing_names:
            existing_names.add(pa["Name"].lower())
            new_accounts.append(pa)

    # b) Gematchte Firmennamen die noch nicht in acc_rows sind
    for deal in deal_rows:
        name = deal.get("Account Name", "").strip()
        if name and name.lower() not in existing_names:
            existing_names.add(name.lower())
            new_accounts.append({
                "Name": name,
                "Industry": "", "Website": "", "BillingCountry": "",
                "BillingStreet": "", "Segment__c": "bulk",
                "Description": deal.get("Description", ""),
            })

    if new_accounts:
        acc_rows.extend(new_accounts)
        n_placeholder = sum(1 for a in new_accounts if a["Name"].startswith("Partner "))
        n_matched = len(new_accounts) - n_placeholder
        print(f"  + {n_placeholder} Partner-Placeholder-Accounts, {n_matched} gematchte Firmennamen")
        report_lines.append(
            f"  [Accounts+] {n_placeholder} Partner-Placeholder + {n_matched} gematchte Firmennamen hinzugefügt"
        )

    # Zusammenfassung
    summary = [
        "",
        "=" * 65,
        "  ZUSAMMENFASSUNG",
        "=" * 65,
        f"  Accounts : {len(acc_rows):>8,}",
        f"  Contacts : {len(con_rows):>8,}",
        f"  Leads    : {len(lead_rows):>8,}",
        f"  Deals    : {len(deal_rows):>8,}",
        "",
        "  Import-Reihenfolge im CRM:",
        "  1. accounts_import.csv  →  object_type=accounts",
        "  2. contacts_import.csv  →  object_type=contacts",
        "  3. leads_import.csv     →  object_type=leads",
        "  4. deals_import.csv     →  object_type=deals",
        "=" * 65,
    ]
    report_lines += summary
    for line in summary:
        print(line)

    if args.dry_run:
        print("\n[dry-run] Keine Dateien geschrieben.")
        return

    os.makedirs(out_dir, exist_ok=True)

    if acc_rows:
        p = os.path.join(out_dir, "accounts_import.csv")
        write_csv(p, acc_rows, ["Name", "Industry", "Website", "BillingCountry", "BillingStreet", "Segment__c", "Description"])
        print(f"\n✓ {p}  ({len(acc_rows):,} Zeilen)")

    if con_rows:
        p = os.path.join(out_dir, "contacts_import.csv")
        write_csv(p, con_rows, ["FirstName", "LastName", "Email", "Phone", "Title", "Account Name"])
        print(f"✓ {p}  ({len(con_rows):,} Zeilen)")

    if lead_rows:
        p = os.path.join(out_dir, "leads_import.csv")
        write_csv(p, lead_rows, ["Company", "FirstName", "LastName", "Email", "Phone", "LeadSource", "NumberOfEmployees", "Description", "Timeline__c"])
        print(f"✓ {p}  ({len(lead_rows):,} Zeilen)")

    if deal_rows:
        p = os.path.join(out_dir, "deals_import.csv")
        write_csv(p, deal_rows, ["Name", "Account Name", "Amount", "Probability", "CloseDate", "Description"])
        print(f"✓ {p}  ({len(deal_rows):,} Zeilen)")

    rp = os.path.join(out_dir, "migration_report.txt")
    with open(rp, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"✓ {rp}")


if __name__ == "__main__":
    main()
