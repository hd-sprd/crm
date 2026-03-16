"""v7: custom_fields on accounts and contacts

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-03-13 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('custom_fields', sa.JSON(), nullable=True))
    op.add_column('contacts', sa.Column('custom_fields', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'custom_fields')
    op.drop_column('contacts', 'custom_fields')
