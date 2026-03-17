"""v10 workflows – replace pipeline_stages with multi-workflow system

Revision ID: h7i8j9k0l1m2
Revises: g6h7i8j9k0l1
Create Date: 2026-03-17

"""
from alembic import op
import sqlalchemy as sa

revision = 'h7i8j9k0l1m2'
down_revision = 'g6h7i8j9k0l1'
branch_labels = None
depends_on = None

# Stage keys that require a quote to be attached
REQUIRES_QUOTE = {
    'negotiation', 'order_confirmed', 'order_created_erp', 'artwork_approval',
    'production_planning', 'in_production', 'quality_check', 'shipped',
    'invoice_created', 'payment_received', 'deal_closed_won',
}
# Stage keys that require feasibility_checked
REQUIRES_FEASIBILITY = {
    'order_confirmed', 'order_created_erp', 'artwork_approval',
    'production_planning', 'in_production', 'quality_check', 'shipped',
    'invoice_created', 'payment_received', 'deal_closed_won',
}
# Stage keys that require artwork_approved
REQUIRES_ARTWORK = {
    'production_planning', 'in_production', 'quality_check', 'shipped',
    'invoice_created', 'payment_received', 'deal_closed_won',
}
# Stage keys that require invoice_reference
REQUIRES_INVOICE = {'payment_received', 'deal_closed_won'}


def upgrade():
    conn = op.get_bind()

    # 1. Create workflows table
    op.create_table(
        'workflows',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('quote_approval_target_stage', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    # 2. Insert default workflow
    conn.execute(sa.text(
        "INSERT INTO workflows (name, is_default, quote_approval_target_stage) "
        "VALUES ('Default', true, 'order_confirmed')"
    ))
    default_id_row = conn.execute(sa.text("SELECT id FROM workflows WHERE is_default = true LIMIT 1")).fetchone()
    default_id = default_id_row[0]

    # 3. Create workflow_stages table
    op.create_table(
        'workflow_stages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('workflow_id', sa.Integer(), sa.ForeignKey('workflows.id'), nullable=False),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('label_en', sa.String(200), nullable=False),
        sa.Column('label_de', sa.String(200), nullable=False),
        sa.Column('color', sa.String(50), nullable=False, server_default='blue'),
        sa.Column('stage_order', sa.Integer(), nullable=False),
        sa.Column('is_won', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_lost', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('requires_quote', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('requires_approved_quote', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('requires_feasibility', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('requires_artwork', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('requires_invoice', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('ix_workflow_stages_workflow_id', 'workflow_stages', ['workflow_id'])
    op.create_unique_constraint('uq_workflow_stage_key', 'workflow_stages', ['workflow_id', 'key'])

    # 4. Seed default workflow stages
    # Try to copy customised rows from pipeline_stages if they exist; otherwise use the spec defaults.
    existing = conn.execute(sa.text("SELECT COUNT(*) FROM pipeline_stages")).scalar()
    if existing:
        rows = conn.execute(sa.text(
            "SELECT key, label_en, label_de, color, stage_order, is_won, is_lost, is_active "
            "FROM pipeline_stages ORDER BY stage_order"
        )).fetchall()
        stage_data = [
            {
                'key': r[0], 'len': r[1], 'lde': r[2], 'col': r[3], 'ord': r[4],
                'won': r[5], 'lost': r[6], 'active': r[7],
            }
            for r in rows
        ]
    else:
        # Hardcoded spec defaults (mirrors v2 migration seed)
        stage_data = [
            {'key': 'lead_received',       'len': 'Lead Received',         'lde': 'Lead erhalten',            'col': 'gray',   'ord': 0,  'won': False, 'lost': False, 'active': True},
            {'key': 'lead_qualification',  'len': 'Lead Qualification',    'lde': 'Lead-Qualifizierung',      'col': 'slate',  'ord': 1,  'won': False, 'lost': False, 'active': True},
            {'key': 'account_created',     'len': 'Account Created',       'lde': 'Account angelegt',         'col': 'gray',   'ord': 2,  'won': False, 'lost': False, 'active': True},
            {'key': 'needs_assessment',    'len': 'Needs Assessment',      'lde': 'Bedarfsanalyse',           'col': 'gray',   'ord': 3,  'won': False, 'lost': False, 'active': True},
            {'key': 'feasibility_check',   'len': 'Feasibility Check',     'lde': 'Machbarkeitsprüfung',      'col': 'gray',   'ord': 4,  'won': False, 'lost': False, 'active': True},
            {'key': 'quote_preparation',   'len': 'Quote Preparation',     'lde': 'Angebotserstellung',       'col': 'yellow', 'ord': 5,  'won': False, 'lost': False, 'active': True},
            {'key': 'quote_sent',          'len': 'Quote Sent',            'lde': 'Angebot versendet',        'col': 'amber',  'ord': 6,  'won': False, 'lost': False, 'active': True},
            {'key': 'negotiation',         'len': 'Negotiation',           'lde': 'Verhandlung',              'col': 'orange', 'ord': 7,  'won': False, 'lost': False, 'active': True},
            {'key': 'order_confirmed',     'len': 'Order Confirmed',       'lde': 'Bestellung bestätigt',     'col': 'lime',   'ord': 8,  'won': False, 'lost': False, 'active': True},
            {'key': 'order_created_erp',   'len': 'Order Created (ERP)',   'lde': 'Auftrag im ERP angelegt',  'col': 'green',  'ord': 9,  'won': False, 'lost': False, 'active': True},
            {'key': 'artwork_approval',    'len': 'Artwork Approval',      'lde': 'Artwork-Freigabe',         'col': 'teal',   'ord': 10, 'won': False, 'lost': False, 'active': True},
            {'key': 'production_planning', 'len': 'Production Planning',   'lde': 'Produktionsplanung',       'col': 'cyan',   'ord': 11, 'won': False, 'lost': False, 'active': True},
            {'key': 'in_production',       'len': 'In Production',         'lde': 'In Produktion',            'col': 'sky',    'ord': 12, 'won': False, 'lost': False, 'active': True},
            {'key': 'quality_check',       'len': 'Quality Check',         'lde': 'Qualitätskontrolle',       'col': 'blue',   'ord': 13, 'won': False, 'lost': False, 'active': True},
            {'key': 'shipped',             'len': 'Shipped',               'lde': 'Versendet',                'col': 'indigo', 'ord': 14, 'won': False, 'lost': False, 'active': True},
            {'key': 'invoice_created',     'len': 'Invoice Created',       'lde': 'Rechnung erstellt',        'col': 'violet', 'ord': 15, 'won': False, 'lost': False, 'active': True},
            {'key': 'payment_received',    'len': 'Payment Received',      'lde': 'Zahlung erhalten',         'col': 'purple', 'ord': 16, 'won': False, 'lost': False, 'active': True},
            {'key': 'deal_closed_won',     'len': 'Deal Closed (Won)',     'lde': 'Deal gewonnen',            'col': 'green',  'ord': 17, 'won': True,  'lost': False, 'active': True},
            {'key': 'lost',                'len': 'Lost',                  'lde': 'Verloren',                 'col': 'red',    'ord': 18, 'won': False, 'lost': True,  'active': True},
            {'key': 'on_hold',             'len': 'On Hold',               'lde': 'Pausiert',                 'col': 'gray',   'ord': 19, 'won': False, 'lost': False, 'active': True},
        ]

    for s in stage_data:
        key = s['key']
        conn.execute(sa.text(
            "INSERT INTO workflow_stages "
            "(workflow_id, key, label_en, label_de, color, stage_order, is_won, is_lost, is_active, "
            "requires_quote, requires_approved_quote, requires_feasibility, requires_artwork, requires_invoice) "
            "VALUES (:wid, :key, :len, :lde, :col, :ord, :won, :lost, :active, "
            ":rq, :raq, :rf, :ra, :ri)"
        ), {
            'wid': default_id,
            'key': key,
            'len': s['len'],
            'lde': s['lde'],
            'col': s['col'],
            'ord': s['ord'],
            'won': s['won'],
            'lost': s['lost'],
            'active': s['active'],
            'rq': key in REQUIRES_QUOTE,
            'raq': False,
            'rf': key in REQUIRES_FEASIBILITY,
            'ra': key in REQUIRES_ARTWORK,
            'ri': key in REQUIRES_INVOICE,
        })

    # 5. Add workflow_id to deals
    op.add_column('deals', sa.Column('workflow_id', sa.Integer(), sa.ForeignKey('workflows.id'), nullable=True))
    op.create_index('ix_deals_workflow_id', 'deals', ['workflow_id'])

    # 6. Set workflow_id on all existing deals
    conn.execute(sa.text(f"UPDATE deals SET workflow_id = {default_id}"))

    # 7. Drop pipeline_stages
    op.drop_table('pipeline_stages')


def downgrade():
    conn = op.get_bind()

    # Recreate pipeline_stages
    op.create_table(
        'pipeline_stages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(100), nullable=False, unique=True),
        sa.Column('label_en', sa.String(200), nullable=False),
        sa.Column('label_de', sa.String(200), nullable=False),
        sa.Column('color', sa.String(50), nullable=False, server_default='blue'),
        sa.Column('stage_order', sa.Integer(), nullable=False),
        sa.Column('is_won', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_lost', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    )

    # Restore stages from default workflow_stages
    stages = conn.execute(sa.text(
        "SELECT ws.key, ws.label_en, ws.label_de, ws.color, ws.stage_order, ws.is_won, ws.is_lost, ws.is_active "
        "FROM workflow_stages ws JOIN workflows w ON ws.workflow_id = w.id WHERE w.is_default = true ORDER BY ws.stage_order"
    )).fetchall()

    for s in stages:
        conn.execute(sa.text(
            "INSERT INTO pipeline_stages (key, label_en, label_de, color, stage_order, is_won, is_lost, is_active) "
            "VALUES (:key, :len, :lde, :col, :ord, :won, :lost, :active)"
        ), {'key': s[0], 'len': s[1], 'lde': s[2], 'col': s[3], 'ord': s[4], 'won': s[5], 'lost': s[6], 'active': s[7]})

    # Remove workflow_id from deals
    op.drop_index('ix_deals_workflow_id', 'deals')
    op.drop_column('deals', 'workflow_id')

    # Drop new tables
    op.drop_table('workflow_stages')
    op.drop_table('workflows')
