"""initial

Revision ID: fec0196f8dc1
Revises:
Create Date: 2026-03-12 10:37:03.317318

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'fec0196f8dc1'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users (no deps)
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('sales_rep', 'account_manager', 'sales_manager', 'admin', name='userrole'), nullable=False),
        sa.Column('region', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('ms_graph_token', sa.String(length=4096), nullable=True),
        sa.Column('ms_graph_refresh_token', sa.String(length=4096), nullable=True),
        sa.Column('ms_graph_token_expiry', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. accounts (depends on users)
    op.create_table('accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.Enum('b2b', 'b2b2c', name='accounttype'), nullable=False),
        sa.Column('segment', sa.String(length=100), nullable=True),
        sa.Column('industry', sa.String(length=100), nullable=True),
        sa.Column('website', sa.String(length=500), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('region', sa.String(length=100), nullable=True),
        sa.Column('status', sa.Enum('active', 'inactive', 'prospect', name='accountstatus'), nullable=False),
        sa.Column('account_manager_id', sa.Integer(), nullable=True),
        sa.Column('jira_ticket_id', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_manager_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_accounts_id'), 'accounts', ['id'], unique=False)
    op.create_index(op.f('ix_accounts_name'), 'accounts', ['name'], unique=False)
    op.create_index(op.f('ix_accounts_account_manager_id'), 'accounts', ['account_manager_id'], unique=False)

    # 3. contacts (depends on accounts)
    op.create_table('contacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('title', sa.String(length=150), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_contacts_id'), 'contacts', ['id'], unique=False)
    op.create_index(op.f('ix_contacts_account_id'), 'contacts', ['account_id'], unique=False)
    op.create_index(op.f('ix_contacts_email'), 'contacts', ['email'], unique=False)

    # 4. deals – WITHOUT quote_id FK yet (circular dep with quotes)
    op.create_table('deals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=True),
        sa.Column('assigned_to', sa.Integer(), nullable=True),
        sa.Column('type', sa.Enum('standard', 'barter', 'custom', name='dealtype'), nullable=False),
        sa.Column('stage', sa.Enum(
            'lead_received', 'lead_qualification', 'account_created', 'needs_assessment',
            'feasibility_check', 'quote_preparation', 'quote_sent', 'negotiation',
            'order_confirmed', 'order_created_erp', 'artwork_approval', 'production_planning',
            'in_production', 'quality_check', 'shipped', 'invoice_created',
            'payment_received', 'deal_closed_won', 'lost', 'on_hold', name='dealstage'), nullable=False),
        sa.Column('product_type', sa.String(length=200), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.Column('branding_requirements', sa.Text(), nullable=True),
        sa.Column('shipping_location', sa.String(length=255), nullable=True),
        sa.Column('feasibility_checked', sa.Boolean(), nullable=False),
        sa.Column('feasibility_notes', sa.Text(), nullable=True),
        sa.Column('quote_id', sa.Integer(), nullable=True),  # FK added below after quotes
        sa.Column('order_reference', sa.String(length=200), nullable=True),
        sa.Column('artwork_approved', sa.Boolean(), nullable=False),
        sa.Column('invoice_reference', sa.String(length=200), nullable=True),
        sa.Column('payment_received', sa.Boolean(), nullable=False),
        sa.Column('value_eur', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('probability', sa.Integer(), nullable=False),
        sa.Column('expected_close_date', sa.Date(), nullable=True),
        sa.Column('lost_reason', sa.Text(), nullable=True),
        sa.Column('jira_ticket_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id']),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.ForeignKeyConstraint(['contact_id'], ['contacts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_deals_id'), 'deals', ['id'], unique=False)
    op.create_index(op.f('ix_deals_account_id'), 'deals', ['account_id'], unique=False)
    op.create_index(op.f('ix_deals_assigned_to'), 'deals', ['assigned_to'], unique=False)
    op.create_index(op.f('ix_deals_contact_id'), 'deals', ['contact_id'], unique=False)
    op.create_index(op.f('ix_deals_quote_id'), 'deals', ['quote_id'], unique=False)

    # 5. quotes (depends on deals)
    op.create_table('quotes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deal_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('line_items', sa.JSON(), nullable=False),
        sa.Column('shipping_cost', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('production_cost', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_value', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.Enum('draft', 'sent', 'negotiating', 'accepted', 'rejected', name='quotestatus'), nullable=False),
        sa.Column('payment_terms', sa.String(length=500), nullable=True),
        sa.Column('validity_days', sa.Integer(), nullable=False),
        sa.Column('notes', sa.String(length=2000), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['deal_id'], ['deals.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_quotes_id'), 'quotes', ['id'], unique=False)
    op.create_index(op.f('ix_quotes_deal_id'), 'quotes', ['deal_id'], unique=False)

    # 6. Add quote_id FK to deals now that quotes table exists
    op.create_foreign_key('fk_deals_quote_id', 'deals', 'quotes', ['quote_id'], ['id'])

    # 7. leads (depends on accounts, contacts, users)
    op.create_table('leads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('source', sa.Enum('email', 'website', 'event', 'referral', 'manual', name='leadsource'), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=True),
        sa.Column('contact_id', sa.Integer(), nullable=True),
        sa.Column('assigned_to', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('new', 'contacted', 'qualified', 'converted', 'lost', name='leadstatus'), nullable=False),
        sa.Column('qualification_notes', sa.Text(), nullable=True),
        sa.Column('use_case', sa.Text(), nullable=True),
        sa.Column('estimated_volume', sa.Integer(), nullable=True),
        sa.Column('timeline', sa.String(length=200), nullable=True),
        sa.Column('company_name', sa.String(length=255), nullable=True),
        sa.Column('contact_email', sa.String(length=255), nullable=True),
        sa.Column('contact_name', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id']),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.ForeignKeyConstraint(['contact_id'], ['contacts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_leads_id'), 'leads', ['id'], unique=False)
    op.create_index(op.f('ix_leads_account_id'), 'leads', ['account_id'], unique=False)
    op.create_index(op.f('ix_leads_assigned_to'), 'leads', ['assigned_to'], unique=False)
    op.create_index(op.f('ix_leads_contact_id'), 'leads', ['contact_id'], unique=False)

    # 8. activities (depends on users)
    op.create_table('activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('email', 'call', 'meeting', 'note', 'task', 'whatsapp', name='activitytype'), nullable=False),
        sa.Column('related_to_type', sa.Enum('lead', 'deal', 'contact', 'account', name='relatedtotype'), nullable=False),
        sa.Column('related_to_id', sa.Integer(), nullable=False),
        sa.Column('assigned_to', sa.Integer(), nullable=True),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ms_message_id', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_activities_id'), 'activities', ['id'], unique=False)
    op.create_index(op.f('ix_activities_assigned_to'), 'activities', ['assigned_to'], unique=False)
    op.create_index(op.f('ix_activities_related_to_id'), 'activities', ['related_to_id'], unique=False)

    # 9. tasks (depends on users)
    op.create_table('tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('related_to_type', sa.Enum('lead', 'deal', 'contact', 'account', name='relatedtotype'), nullable=True),
        sa.Column('related_to_id', sa.Integer(), nullable=True),
        sa.Column('assigned_to', sa.Integer(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('priority', sa.Enum('low', 'medium', 'high', name='taskpriority'), nullable=False),
        sa.Column('status', sa.Enum('open', 'completed', name='taskstatus'), nullable=False),
        sa.Column('is_auto_generated', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tasks_id'), 'tasks', ['id'], unique=False)
    op.create_index(op.f('ix_tasks_assigned_to'), 'tasks', ['assigned_to'], unique=False)
    op.create_index(op.f('ix_tasks_related_to_id'), 'tasks', ['related_to_id'], unique=False)


def downgrade() -> None:
    op.drop_table('tasks')
    op.drop_table('activities')
    op.drop_table('leads')
    op.drop_constraint('fk_deals_quote_id', 'deals', type_='foreignkey')
    op.drop_table('quotes')
    op.drop_table('deals')
    op.drop_table('contacts')
    op.drop_table('accounts')
    op.drop_table('users')
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS accounttype")
    op.execute("DROP TYPE IF EXISTS accountstatus")
    op.execute("DROP TYPE IF EXISTS dealtype")
    op.execute("DROP TYPE IF EXISTS dealstage")
    op.execute("DROP TYPE IF EXISTS quotestatus")
    op.execute("DROP TYPE IF EXISTS leadsource")
    op.execute("DROP TYPE IF EXISTS leadstatus")
    op.execute("DROP TYPE IF EXISTS activitytype")
    op.execute("DROP TYPE IF EXISTS relatedtotype")
    op.execute("DROP TYPE IF EXISTS taskpriority")
    op.execute("DROP TYPE IF EXISTS taskstatus")
