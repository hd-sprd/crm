"""v9 quote portal access token

Revision ID: g6h7i8j9k0l1
Revises: a6b7c8d9e0f1
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa

revision = 'g6h7i8j9k0l1'
down_revision = 'a6b7c8d9e0f1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('quotes', sa.Column('access_token', sa.String(64), nullable=True))
    op.create_unique_constraint('uq_quotes_access_token', 'quotes', ['access_token'])
    op.create_index('ix_quotes_access_token', 'quotes', ['access_token'])


def downgrade():
    op.drop_index('ix_quotes_access_token', 'quotes')
    op.drop_constraint('uq_quotes_access_token', 'quotes', type_='unique')
    op.drop_column('quotes', 'access_token')
