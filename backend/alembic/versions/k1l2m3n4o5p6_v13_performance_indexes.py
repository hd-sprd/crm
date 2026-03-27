"""v13 performance indexes

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-03-27 13:00:00.000000

Adds indexes on columns used in WHERE clauses of every list endpoint.
Without these, each filtered list query does a full table scan.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'k1l2m3n4o5p6'
down_revision: Union[str, None] = 'j0k1l2m3n4o5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # deals — stage and workflow_id filtered on every pipeline/board view
    op.create_index('ix_deals_stage', 'deals', ['stage'], if_not_exists=True)
    op.create_index('ix_deals_workflow_id', 'deals', ['workflow_id'], if_not_exists=True)

    # leads — status and source filtered on list view
    op.create_index('ix_leads_status', 'leads', ['status'], if_not_exists=True)
    op.create_index('ix_leads_source', 'leads', ['source'], if_not_exists=True)

    # activities — composite replaces the partial related_to_id-only index;
    # queries always filter on both type and id together
    op.create_index(
        'ix_activities_related_to_type_id',
        'activities',
        ['related_to_type', 'related_to_id'],
        if_not_exists=True,
    )

    # accounts — status filtered on list view
    op.create_index('ix_accounts_status', 'accounts', ['status'], if_not_exists=True)


def downgrade() -> None:
    op.drop_index('ix_deals_stage', table_name='deals')
    op.drop_index('ix_deals_workflow_id', table_name='deals')
    op.drop_index('ix_leads_status', table_name='leads')
    op.drop_index('ix_leads_source', table_name='leads')
    op.drop_index('ix_activities_related_to_type_id', table_name='activities')
    op.drop_index('ix_accounts_status', table_name='accounts')
