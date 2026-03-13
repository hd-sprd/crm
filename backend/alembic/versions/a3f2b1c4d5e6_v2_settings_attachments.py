"""v2: settings, custom fields, attachments, stage->varchar

Revision ID: a3f2b1c4d5e6
Revises: fec0196f8dc1
Create Date: 2026-03-12 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f2b1c4d5e6'
down_revision: Union[str, None] = 'fec0196f8dc1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Convert deals.stage from PostgreSQL enum → VARCHAR(100)
    op.execute("ALTER TABLE deals ALTER COLUMN stage TYPE VARCHAR(100) USING stage::text")
    op.execute("DROP TYPE IF EXISTS dealstage")

    # 2. Add custom_fields JSON columns to deals and leads
    op.add_column('deals', sa.Column('custom_fields', sa.JSON(), nullable=True))
    op.add_column('leads', sa.Column('custom_fields', sa.JSON(), nullable=True))

    # 3. pipeline_stages table
    op.create_table('pipeline_stages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('label_en', sa.String(length=200), nullable=False),
        sa.Column('label_de', sa.String(length=200), nullable=False),
        sa.Column('color', sa.String(length=50), nullable=False, server_default='blue'),
        sa.Column('stage_order', sa.Integer(), nullable=False),
        sa.Column('is_won', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_lost', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )

    # 4. Insert default pipeline stages
    op.execute("""
        INSERT INTO pipeline_stages (key, label_en, label_de, color, stage_order, is_won, is_lost, is_active)
        VALUES
            ('lead_received',       'Lead Received',          'Lead erhalten',           'gray',   0,  false, false, true),
            ('lead_qualification',  'Lead Qualification',     'Lead-Qualifizierung',     'slate',  1,  false, false, true),
            ('account_created',     'Account Created',        'Account angelegt',        'zinc',   2,  false, false, true),
            ('needs_assessment',    'Needs Assessment',       'Bedarfsanalyse',          'neutral',3,  false, false, true),
            ('feasibility_check',   'Feasibility Check',      'Machbarkeitsprüfung',     'stone',  4,  false, false, true),
            ('quote_preparation',   'Quote Preparation',      'Angebotserstellung',      'yellow', 5,  false, false, true),
            ('quote_sent',          'Quote Sent',             'Angebot versendet',       'amber',  6,  false, false, true),
            ('negotiation',         'Negotiation',            'Verhandlung',             'orange', 7,  false, false, true),
            ('order_confirmed',     'Order Confirmed',        'Bestellung bestätigt',    'lime',   8,  false, false, true),
            ('order_created_erp',   'Order Created (ERP)',    'Auftrag im ERP angelegt', 'green',  9,  false, false, true),
            ('artwork_approval',    'Artwork Approval',       'Artwork-Freigabe',        'teal',   10, false, false, true),
            ('production_planning', 'Production Planning',    'Produktionsplanung',      'cyan',   11, false, false, true),
            ('in_production',       'In Production',          'In Produktion',           'sky',    12, false, false, true),
            ('quality_check',       'Quality Check',          'Qualitätskontrolle',      'blue',   13, false, false, true),
            ('shipped',             'Shipped',                'Versendet',               'indigo', 14, false, false, true),
            ('invoice_created',     'Invoice Created',        'Rechnung erstellt',       'violet', 15, false, false, true),
            ('payment_received',    'Payment Received',       'Zahlung erhalten',        'purple', 16, false, false, true),
            ('deal_closed_won',     'Deal Closed (Won)',      'Deal gewonnen',           'green',  17, true,  false, true),
            ('lost',                'Lost',                   'Verloren',                'red',    18, false, true,  true),
            ('on_hold',             'On Hold',                'Pausiert',                'gray',   19, false, false, true)
    """)

    # 5. system_settings table
    op.create_table('system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=200), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )

    # 6. custom_field_defs table
    op.create_table('custom_field_defs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('label_en', sa.String(length=200), nullable=False),
        sa.Column('label_de', sa.String(length=200), nullable=False),
        sa.Column('field_type', sa.String(length=50), nullable=False),
        sa.Column('applies_to', sa.String(length=50), nullable=False),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('field_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )

    # 7. attachments table
    op.create_table('attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('original_name', sa.String(length=500), nullable=False),
        sa.Column('stored_name', sa.String(length=500), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('has_thumbnail', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stored_name'),
    )
    op.create_index('ix_attachments_entity', 'attachments', ['entity_type', 'entity_id'])


def downgrade() -> None:
    op.drop_index('ix_attachments_entity', table_name='attachments')
    op.drop_table('attachments')
    op.drop_table('custom_field_defs')
    op.drop_table('system_settings')
    op.drop_table('pipeline_stages')
    op.drop_column('leads', 'custom_fields')
    op.drop_column('deals', 'custom_fields')
    # Restore enum (approximate – won't match exact data)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE dealstage AS ENUM (
                'lead_received','lead_qualification','account_created','needs_assessment',
                'feasibility_check','quote_preparation','quote_sent','negotiation',
                'order_confirmed','order_created_erp','artwork_approval','production_planning',
                'in_production','quality_check','shipped','invoice_created',
                'payment_received','deal_closed_won','lost','on_hold'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
    """)
    op.execute("""
        ALTER TABLE deals ALTER COLUMN stage
        TYPE dealstage USING stage::dealstage
    """)
