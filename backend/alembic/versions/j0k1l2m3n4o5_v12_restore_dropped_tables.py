"""v12 restore attachments system_settings custom_field_defs

Revision ID: j0k1l2m3n4o5
Revises: 5fe5dd45c07f
Create Date: 2026-03-27 12:00:00.000000

Migration 5fe5dd45c07f accidentally dropped three tables still used by the
application. This migration restores them. Uses checkfirst=True so it is
idempotent — safe to run even if the tables were already re-created manually
via SQL in Supabase.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'j0k1l2m3n4o5'
down_revision: Union[str, None] = '5fe5dd45c07f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'attachments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('original_name', sa.String(500), nullable=False),
        sa.Column('stored_name', sa.String(500), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('file_size', sa.BigInteger(), server_default='0', nullable=False),
        sa.Column('has_thumbnail', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'],
                                name=op.f('attachments_uploaded_by_fkey')),
        sa.PrimaryKeyConstraint('id', name=op.f('attachments_pkey')),
        sa.UniqueConstraint('stored_name', name=op.f('attachments_stored_name_key'),
                            postgresql_nulls_not_distinct=False),
        if_not_exists=True,
    )
    op.create_index(op.f('ix_attachments_entity'), 'attachments',
                    ['entity_type', 'entity_id'], unique=False,
                    if_not_exists=True)

    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('key', sa.String(200), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('system_settings_pkey')),
        sa.UniqueConstraint('key', name=op.f('system_settings_key_key'),
                            postgresql_nulls_not_distinct=False),
        if_not_exists=True,
    )

    op.create_table(
        'custom_field_defs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('label_en', sa.String(200), nullable=False),
        sa.Column('label_de', sa.String(200), nullable=False),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('applies_to', sa.String(50), nullable=False),
        sa.Column('options', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_required', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('field_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('custom_field_defs_pkey')),
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_attachments_entity'), table_name='attachments')
    op.drop_table('attachments')
    op.drop_table('system_settings')
    op.drop_table('custom_field_defs')
