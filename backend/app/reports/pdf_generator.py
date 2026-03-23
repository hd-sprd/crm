"""
Quote PDF generation using WeasyPrint.
Sections are rendered in the order stored in the quote_template system setting,
matching exactly what the visual editor shows.
"""
import os
import re
import json
import base64
from datetime import datetime, timezone, timedelta
from typing import TYPE_CHECKING
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

if TYPE_CHECKING:
    from app.models.quote import Quote

_DEFAULT_TPL = {
    "company_name": "Spreadshirt",
    "company_address": "Gießerstr. 27 · 04229 Leipzig · Germany",
    "company_email": "",
    "company_phone": "",
    "brand_color": "#e63329",
    "logo_url": None,
    "sections": [
        {"id": "header",    "enabled": True},
        {"id": "recipient", "enabled": True},
        {"id": "items",     "enabled": True},
        {"id": "totals",    "enabled": True},
        {"id": "terms",     "enabled": True},
        {"id": "notes",     "enabled": True},
        {"id": "signature", "enabled": True},
        {"id": "footer",    "enabled": True},
    ],
    "footer_text": "This quote is valid for {validity_days} days from date of issue.",
    "show_vat_note": True,
    "number_format": {"decimal_places": 2, "thousands_sep": ".", "decimal_sep": ","},
    "date_format": "DD.MM.YYYY",
}


async def _load_template(db: AsyncSession) -> dict:
    try:
        from app.models.settings import SystemSetting
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == "quote_template")
        )
        row = result.scalar_one_or_none()
        if row:
            return json.loads(row.value)
    except Exception:
        pass
    return dict(_DEFAULT_TPL)


async def _embed_logo(logo_url: str | None) -> tuple[str | None, str | None]:
    """Load logo and embed as base64 data URI."""
    if not logo_url:
        return None, None
    try:
        filename = os.path.basename(logo_url.split("?")[0])
        ext = os.path.splitext(filename)[-1].lower()
        mime = {".jpg": "image/jpeg", ".png": "image/png",
                ".svg": "image/svg+xml", ".webp": "image/webp"}.get(ext, "image/png")

        content: bytes | None = None
        if logo_url.startswith("https://") or logo_url.startswith("http://"):
            from app.services.storage import fetch_url
            content = await fetch_url(logo_url)
        else:
            upload_root = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "logos"
            )
            path = os.path.join(upload_root, filename)
            if os.path.exists(path):
                with open(path, "rb") as f:
                    content = f.read()

        if content:
            return base64.b64encode(content).decode(), mime
    except Exception:
        pass
    return None, None


# ── Format helpers ────────────────────────────────────────────────────────────

def _html_escape(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _format_number(value: float, tpl: dict, decimal_places: int | None = None) -> str:
    """Format a number using the template's number_format config."""
    fmt = tpl.get("number_format", {})
    dec = fmt.get("decimal_places", 2) if decimal_places is None else decimal_places
    dec_sep = fmt.get("decimal_sep", ",")
    thou_sep = fmt.get("thousands_sep", ".")

    # Format with standard US style first: "1,234.56"
    raw = f"{abs(value):,.{dec}f}"
    prefix = "-" if value < 0 else ""

    if dec_sep == "," and thou_sep == ".":
        result = raw.replace(",", "THOU").replace(".", ",").replace("THOU", ".")
    elif dec_sep == "." and thou_sep == ",":
        result = raw  # already US style
    elif dec_sep == "." and thou_sep == " ":
        result = raw.replace(",", "\u202f")
    elif dec_sep == "," and thou_sep == " ":
        result = raw.replace(",", "THOU").replace(".", ",").replace("THOU", "\u202f")
    elif dec_sep == "," and thou_sep == "":
        result = raw.replace(",", "").replace(".", ",")
    elif dec_sep == "." and thou_sep == "":
        result = raw.replace(",", "")
    else:
        result = raw

    return prefix + result


def _format_date(date_str: str, tpl: dict) -> str:
    """Format a date string (YYYY-MM-DD) using the template's date_format config."""
    if not date_str:
        return ""
    fmt = tpl.get("date_format", "DD.MM.YYYY")
    try:
        dt = datetime.strptime(str(date_str)[:10], "%Y-%m-%d")
        if fmt == "DD.MM.YYYY":
            return dt.strftime("%d.%m.%Y")
        elif fmt == "MM/DD/YYYY":
            return dt.strftime("%m/%d/%Y")
        elif fmt == "YYYY-MM-DD":
            return dt.strftime("%Y-%m-%d")
        elif fmt == "D. MMM YYYY":
            return f"{dt.day}. {dt.strftime('%b')} {dt.year}"
        return str(date_str)
    except Exception:
        return str(date_str)


def _substitute_vars(text: str, variables: dict) -> str:
    """Replace {key} placeholders in text with values from variables dict."""
    def replace(match):
        key = match.group(1)
        return _html_escape(str(variables.get(key, match.group(0))))
    return re.sub(r"\{([^}]+)\}", replace, _html_escape(text))


def _build_variables(tpl: dict, quote, deal, account, contact,
                     sales_rep: str, today: str, valid_until: str) -> dict:
    """Build the full variable substitution dict for a quote."""
    cur = getattr(quote, "currency", "EUR") or "EUR"

    def fnum(v):
        try:
            return _format_number(float(v or 0), tpl)
        except Exception:
            return str(v or "")

    def fdate(v):
        return _format_date(str(v), tpl) if v else ""

    return {
        # Quote
        "quote.id": str(quote.id),
        "quote.version": str(quote.version),
        "quote.date": _format_date(today, tpl),
        "quote.valid_until": _format_date(valid_until, tpl),
        "quote.validity_days": str(quote.validity_days),
        "quote.total_value": f"{cur} {fnum(quote.total_value)}",
        "quote.shipping_cost": fnum(quote.shipping_cost),
        "quote.production_cost": fnum(quote.production_cost),
        "quote.currency": cur,
        "quote.payment_terms": quote.payment_terms or "",
        "quote.notes": quote.notes or "",
        # Deal
        "deal.title": (deal.title if deal else "") or "",
        "deal.value_eur": fnum(deal.value_eur if deal else 0),
        "deal.product_type": (deal.product_type if deal else "") or "",
        "deal.quantity": str(deal.quantity or "") if deal else "",
        "deal.branding_requirements": (deal.branding_requirements if deal else "") or "",
        "deal.shipping_location": (deal.shipping_location if deal else "") or "",
        "deal.expected_close_date": fdate(deal.expected_close_date if deal else ""),
        "deal.type": (deal.type if deal else "") or "",
        "deal.stage": (deal.stage if deal else "") or "",
        "deal.order_reference": (deal.order_reference if deal else "") or "",
        "deal.invoice_reference": (deal.invoice_reference if deal else "") or "",
        "deal.jira_ticket_id": (deal.jira_ticket_id if deal else "") or "",
        # Account
        "account.name": (account.name if account else "") or "",
        "account.address": (account.address if account else "") or "",
        "account.country": (account.country if account else "") or "",
        "account.industry": (account.industry if account else "") or "",
        "account.website": (account.website if account else "") or "",
        # Contact
        "contact.full_name": f"{contact.first_name} {contact.last_name}".strip() if contact else "",
        "contact.first_name": (contact.first_name if contact else "") or "",
        "contact.last_name": (contact.last_name if contact else "") or "",
        "contact.email": (contact.email if contact else "") or "",
        "contact.phone": (contact.phone if contact else "") or "",
        "contact.title": (contact.title if contact else "") or "",
        # Sales rep
        "rep.name": sales_rep,
        # Backward compat
        "validity_days": str(quote.validity_days),
    }


# ── Section HTML renderers ────────────────────────────────────────────────────

def _section_header(tpl: dict, logo_data: str | None, logo_mime: str | None,
                    today: str, valid_until: str, quote) -> str:
    c = tpl.get("brand_color", "#e63329")
    phone = _html_escape(tpl.get("company_phone", ""))
    email = _html_escape(tpl.get("company_email", ""))
    company = _html_escape(tpl.get("company_name", ""))
    address = _html_escape(tpl.get("company_address", ""))
    today_fmt = _format_date(today, tpl)
    valid_fmt = _format_date(valid_until, tpl)

    if logo_data:
        logo_html = f'<img src="data:{logo_mime};base64,{logo_data}" style="max-height:56px;max-width:180px;object-fit:contain;display:block">'
    else:
        logo_html = f'<div style="color:{c};font-weight:800;font-size:26px;letter-spacing:-0.5px;line-height:1">{company}</div>'

    addr_line = f'<div style="font-size:10px;color:#999;margin-top:5px">{address}</div>' if address else ""
    phone_line = f"Tel: {phone}<br>" if phone else ""
    email_line = f"{email}<br>" if email else ""

    return f"""
<div style="display:flex;justify-content:space-between;align-items:flex-start;
            border-bottom:3px solid {c};padding-bottom:16px;margin-bottom:20px">
  <div>{logo_html}{addr_line}</div>
  <div style="text-align:right;font-size:11px;line-height:1.9;color:#666">
    <div style="font-weight:700;font-size:16px;color:#1a1a1a;margin-bottom:2px">
      QUOTE #{quote.id}&nbsp;·&nbsp;v{quote.version}
    </div>
    Date: {today_fmt}<br>
    Valid until: {valid_fmt}<br>
    {phone_line}{email_line}
  </div>
</div>"""


def _section_recipient(tpl: dict, account_name: str, contact_name: str,
                       account_address: str) -> str:
    c = tpl.get("brand_color", "#e63329")
    addr = f"<br>{_html_escape(account_address)}" if account_address else ""
    contact = f"{_html_escape(contact_name)}<br>" if contact_name else ""
    return f"""
<div style="margin-bottom:20px">
  <div style="color:{c};font-weight:700;font-size:16px;margin-bottom:6px">
    Quote for {_html_escape(account_name)}
  </div>
  <div style="font-size:11px;color:#555;line-height:1.9">{contact}{addr}</div>
</div>"""


async def _embed_line_image(
    image_url: str, db: AsyncSession | None = None
) -> tuple[str | None, str | None]:
    UPLOADS_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    url_clean = image_url.split("?")[0]
    parts = [p for p in url_clean.split("/") if p]

    try:
        if "quotes" in parts and "images" in parts:
            idx = parts.index("images")
            if idx + 2 < len(parts):
                deal_id, filename = parts[idx + 1], parts[idx + 2]
                path = os.path.join(UPLOADS_ROOT, "quotes", deal_id, filename)
                if os.path.isfile(path):
                    ext = os.path.splitext(filename)[-1].lower()
                    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                            ".png": "image/png", ".gif": "image/gif",
                            ".webp": "image/webp"}.get(ext, "image/jpeg")
                    with open(path, "rb") as f:
                        return base64.b64encode(f.read()).decode(), mime

        if "uploads" in parts and db is not None:
            idx = parts.index("uploads")
            if idx + 1 < len(parts):
                att_id = int(parts[idx + 1])
                from app.models.attachment import Attachment
                att = (await db.execute(
                    select(Attachment).where(Attachment.id == att_id)
                )).scalar_one_or_none()
                if att and att.stored_name:
                    path = os.path.join(UPLOADS_ROOT, "attachments", att.stored_name)
                    if os.path.isfile(path):
                        mime = att.mime_type or "image/jpeg"
                        with open(path, "rb") as f:
                            return base64.b64encode(f.read()).decode(), mime
    except Exception:
        pass
    return None, None


def _section_items(tpl: dict, quote, line_images: dict) -> str:
    c = tpl.get("brand_color", "#e63329")
    cur = getattr(quote, "currency", "EUR") or "EUR"
    rows = ""
    for i, item in enumerate(quote.line_items or []):
        bg = "#f7f7f7" if i % 2 else "#fff"
        product = _html_escape(str(item.get("product", "") if isinstance(item, dict) else item.product))
        qty = item.get("qty", 0) if isinstance(item, dict) else item.qty
        unit = item.get("unit_price", 0) if isinstance(item, dict) else item.unit_price
        total = item.get("total", 0) if isinstance(item, dict) else item.total

        def _get(key):
            v = item.get(key) if isinstance(item, dict) else getattr(item, key, None)
            return _html_escape(str(v)) if v else ""

        pt, pc, ps = _get("print_technique"), _get("print_colors"), _get("print_size")
        print_lines = []
        if pt:
            print_lines.append(f'<div><span style="color:#999">Technique:</span> {pt}</div>')
        if pc:
            print_lines.append(f'<div><span style="color:#999">Colors:</span> {pc}</div>')
        if ps:
            print_lines.append(f'<div><span style="color:#999">Size:</span> {ps}</div>')
        badges = f'<div style="margin-top:5px;font-size:10px;color:#555;line-height:1.7">{"".join(print_lines)}</div>' if print_lines else ""

        img_html = ""
        if i in line_images:
            img_data, img_mime = line_images[i]
            img_html = f'<div style="flex-shrink:0"><img src="data:{img_mime};base64,{img_data}" style="width:48px;height:48px;object-fit:contain;border:1px solid #ececec;border-radius:3px;background:#fff"></div>'

        product_cell = f'<div style="display:flex;align-items:flex-start;gap:8px">{img_html}<div><div style="font-weight:500">{product}</div>{badges}</div></div>'
        unit_fmt = _format_number(float(unit), tpl)
        total_fmt = _format_number(float(total), tpl)

        rows += f"""
    <tr style="background:{bg}">
      <td style="padding:7px 10px;border-bottom:1px solid #ececec;vertical-align:top">{product_cell}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #ececec;text-align:right;color:#666;vertical-align:top">{qty}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #ececec;text-align:right;color:#666;vertical-align:top">{unit_fmt}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #ececec;text-align:right;font-weight:500;vertical-align:top">{total_fmt}</td>
    </tr>"""

    return f"""
<div style="margin-bottom:16px">
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead>
      <tr style="background:{c}">
        <th style="color:#fff;padding:8px 10px;text-align:left;font-weight:600">Product / Description</th>
        <th style="color:#fff;padding:8px 10px;text-align:right;font-weight:600;width:44px">Qty</th>
        <th style="color:#fff;padding:8px 10px;text-align:right;font-weight:600;width:100px">Unit ({cur})</th>
        <th style="color:#fff;padding:8px 10px;text-align:right;font-weight:600;width:100px">Total ({cur})</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
</div>"""


def _section_totals(tpl: dict, quote) -> str:
    c = tpl.get("brand_color", "#e63329")
    cur = getattr(quote, "currency", "EUR") or "EUR"
    shipping = float(quote.shipping_cost or 0)
    production = float(quote.production_cost or 0)
    total = float(quote.total_value or 0)

    shipping_line = f'<div style="color:#777">Shipping: {cur} {_format_number(shipping, tpl)}</div>' if shipping else ""
    production_line = f'<div style="color:#777">Production: {cur} {_format_number(production, tpl)}</div>' if production else ""

    vat = ""
    if tpl.get("show_vat_note", True):
        vat = '<div style="font-size:10px;color:#aaa;margin-top:2px">All prices are net. VAT will be added where applicable.</div>'

    return f"""
<div style="text-align:right;font-size:11px;line-height:2.1;margin-bottom:12px">
  {shipping_line}{production_line}
  <div style="height:1px;background:#e0e0e0;margin:6px 0 6px auto;width:210px"></div>
  <div style="font-weight:700;font-size:16px;color:{c}">TOTAL: {cur} {_format_number(total, tpl)}</div>
  {vat}
</div>"""


def _section_terms(quote) -> str:
    if not quote.payment_terms:
        return ""
    return f"""
<div style="font-size:11px;color:#444;margin-bottom:12px;
            padding:8px 12px;background:#f8f8f8;border-radius:4px;border-left:3px solid #e0e0e0">
  <strong>Payment Terms:</strong> {_html_escape(quote.payment_terms)}
</div>"""


def _section_notes(quote) -> str:
    if not quote.notes:
        return ""
    return f"""
<div style="font-size:11px;color:#444;margin-bottom:12px">
  <strong>Notes:</strong> {_html_escape(quote.notes)}
</div>"""


def _section_signature(sales_rep: str) -> str:
    return f"""
<div style="margin-top:48px;font-size:11px;color:#444;padding-bottom:16px">
  <div style="margin-bottom:2px">Sales Representative: <strong>{_html_escape(sales_rep)}</strong></div>
  <div style="display:inline-block;border-top:1px solid #aaa;width:220px;
              margin-top:48px;padding-top:6px;font-size:10px;color:#999">
    Signature &amp; Date
  </div>
</div>"""


def _section_footer(tpl: dict, variables: dict) -> str:
    raw = tpl.get("footer_text") or "This quote is valid for {validity_days} days from date of issue."
    text = _substitute_vars(raw, variables)
    company = _html_escape(tpl.get("company_name", ""))
    address = _html_escape(tpl.get("company_address", ""))
    addr_part = f" · {address}" if address else ""
    return f"""
<div style="margin-top:32px;border-top:1px solid #e8e8e8;padding-top:12px;
            font-size:10px;color:#aaa;line-height:1.7">
  <strong style="color:#999">{company}</strong>{addr_part}<br>
  {text}
</div>"""


def _section_custom_text(section: dict, variables: dict) -> str:
    """Render a custom text block with variable substitution."""
    content = section.get("content", "")
    if not content:
        return ""
    content_html = _substitute_vars(content, variables).replace("\n", "<br>")
    label = _html_escape(section.get("label", ""))
    label_html = f'<div style="font-weight:600;font-size:12px;color:#333;margin-bottom:6px">{label}</div>' if label else ""
    return f"""
<div style="font-size:11px;color:#444;margin-bottom:12px">
  {label_html}
  <div style="line-height:1.7">{content_html}</div>
</div>"""


# ── Main function ─────────────────────────────────────────────────────────────

async def generate_quote_pdf(quote: "Quote", db: AsyncSession) -> bytes:
    try:
        from weasyprint import HTML as WP_HTML
        _has_weasyprint = True
    except ImportError:
        _has_weasyprint = False

    from app.models.deal import Deal
    from app.models.account import Account
    from app.models.contact import Contact
    from app.models.user import User

    tpl = await _load_template(db)

    # Resolve deal context
    deal_result = await db.execute(select(Deal).where(Deal.id == quote.deal_id))
    deal = deal_result.scalar_one_or_none()

    account, contact, sales_rep = None, None, "N/A"
    account_name, account_address, contact_name = "N/A", "", ""

    if deal:
        if deal.account_id:
            account = (await db.execute(select(Account).where(Account.id == deal.account_id))).scalar_one_or_none()
            if account:
                account_name = account.name
                account_address = account.address or ""
        if deal.contact_id:
            contact = (await db.execute(select(Contact).where(Contact.id == deal.contact_id))).scalar_one_or_none()
            if contact:
                contact_name = f"{contact.first_name} {contact.last_name}"
        if deal.assigned_to:
            usr = (await db.execute(select(User).where(User.id == deal.assigned_to))).scalar_one_or_none()
            if usr:
                sales_rep = usr.full_name

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    valid_until = (datetime.now(timezone.utc) + timedelta(days=quote.validity_days)).strftime("%Y-%m-%d")
    logo_data, logo_mime = await _embed_logo(tpl.get("logo_url"))

    # Build variable substitution dict
    variables = _build_variables(tpl, quote, deal, account, contact, sales_rep, today, valid_until)

    # Pre-load line item images
    line_images: dict[int, tuple[str, str]] = {}
    for idx, item in enumerate(quote.line_items or []):
        img_url = item.get("image_url") if isinstance(item, dict) else getattr(item, "image_url", None)
        if img_url:
            img_data, img_mime = await _embed_line_image(img_url, db)
            if img_data:
                line_images[idx] = (img_data, img_mime)

    # Built-in section renderers
    SECTION_RENDERERS = {
        "header":    lambda: _section_header(tpl, logo_data, logo_mime, today, valid_until, quote),
        "recipient": lambda: _section_recipient(tpl, account_name, contact_name, account_address),
        "items":     lambda: _section_items(tpl, quote, line_images),
        "totals":    lambda: _section_totals(tpl, quote),
        "terms":     lambda: _section_terms(quote),
        "notes":     lambda: _section_notes(quote),
        "signature": lambda: _section_signature(sales_rep),
        "footer":    lambda: _section_footer(tpl, variables),
    }

    body_html = ""
    for section in tpl.get("sections", _DEFAULT_TPL["sections"]):
        if not section.get("enabled", True):
            continue
        section_type = section.get("type", "builtin")
        if section_type == "custom_text":
            body_html += _section_custom_text(section, variables)
        else:
            renderer = SECTION_RENDERERS.get(section["id"])
            if renderer:
                body_html += renderer()

    c = tpl.get("brand_color", "#e63329")
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333;
          padding: 44px 52px; background: #fff; }}
  a {{ color: {c}; }}
</style>
</head>
<body>{body_html}</body>
</html>"""

    if _has_weasyprint:
        return WP_HTML(string=html).write_pdf()
    else:
        return html.encode("utf-8")


async def generate_quote_html(quote: "Quote", db: AsyncSession) -> str:
    """Return a print-ready HTML page for the quote (browser prints via window.print)."""
    html_bytes = await generate_quote_pdf(quote, db)
    html = html_bytes.decode("utf-8")
    return html.replace(
        "</body>",
        "<script>window.onload=window.print;window.onafterprint=window.close</script></body>",
    )
