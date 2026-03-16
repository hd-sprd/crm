"""v5: multi-currency support on deals and quotes

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-03-13 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # deals: add currency + exchange_rate_eur
    op.add_column('deals', sa.Column(
        'currency', sa.String(3), nullable=False, server_default='EUR'
    ))
    op.add_column('deals', sa.Column(
        'exchange_rate_eur', sa.Numeric(10, 6), nullable=False, server_default='1.000000'
    ))

    # quotes: add currency + exchange_rate_eur
    op.add_column('quotes', sa.Column(
        'currency', sa.String(3), nullable=False, server_default='EUR'
    ))
    op.add_column('quotes', sa.Column(
        'exchange_rate_eur', sa.Numeric(10, 6), nullable=False, server_default='1.000000'
    ))


def downgrade() -> None:
    op.drop_column('quotes', 'exchange_rate_eur')
    op.drop_column('quotes', 'currency')
    op.drop_column('deals', 'exchange_rate_eur')
    op.drop_column('deals', 'currency')
