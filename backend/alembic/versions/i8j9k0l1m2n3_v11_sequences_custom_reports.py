"""v11 sequences and custom reports

Revision ID: i8j9k0l1m2n3
Revises: h7i8j9k0l1m2
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

revision = 'i8j9k0l1m2n3'
down_revision = 'h7i8j9k0l1m2'
branch_labels = None
depends_on = None


def upgrade():
    # sequences
    op.create_table(
        'sequences',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('applies_to', sa.String(20), nullable=False),  # deal | lead
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # sequence_steps
    op.create_table(
        'sequence_steps',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('sequence_id', sa.Integer, sa.ForeignKey('sequences.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('delay_days', sa.Integer, nullable=False, server_default='1'),
        sa.Column('action_type', sa.String(20), nullable=False, server_default='task'),  # task | note
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('body', sa.Text, nullable=True),
    )
    op.create_index('ix_sequence_steps_sequence_id', 'sequence_steps', ['sequence_id'])

    # sequence_enrollments
    op.create_table(
        'sequence_enrollments',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('sequence_id', sa.Integer, sa.ForeignKey('sequences.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entity_type', sa.String(20), nullable=False),  # deal | lead
        sa.Column('entity_id', sa.Integer, nullable=False),
        sa.Column('enrolled_by', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('current_step', sa.Integer, nullable=False, server_default='0'),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paused', sa.Boolean, nullable=False, server_default='false'),
    )
    op.create_index('ix_sequence_enrollments_sequence_id', 'sequence_enrollments', ['sequence_id'])
    op.create_index('ix_sequence_enrollments_entity', 'sequence_enrollments', ['entity_type', 'entity_id'])

    # custom_reports
    op.create_table(
        'custom_reports',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('config', sa.JSON, nullable=False),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table('custom_reports')
    op.drop_index('ix_sequence_enrollments_entity', 'sequence_enrollments')
    op.drop_index('ix_sequence_enrollments_sequence_id', 'sequence_enrollments')
    op.drop_table('sequence_enrollments')
    op.drop_index('ix_sequence_steps_sequence_id', 'sequence_steps')
    op.drop_table('sequence_steps')
    op.drop_table('sequences')
