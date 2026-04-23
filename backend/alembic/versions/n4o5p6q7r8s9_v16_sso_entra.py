"""v16 SSO – Azure Entra ID fields

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-04-23 10:00:00.000000

Adds entra_object_id (Azure AD Object-ID / oid claim) to users table and
makes hashed_password nullable so SSO-only accounts work without a password.
"""

from alembic import op
import sqlalchemy as sa

revision = "n4o5p6q7r8s9"
down_revision = "m3n4o5p6q7r8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("entra_object_id", sa.String(36), nullable=True),
    )
    op.create_unique_constraint("uq_users_entra_object_id", "users", ["entra_object_id"])
    op.create_index("ix_users_entra_object_id", "users", ["entra_object_id"], unique=True)
    op.alter_column("users", "hashed_password", nullable=True)


def downgrade() -> None:
    op.alter_column("users", "hashed_password", nullable=False)
    op.drop_index("ix_users_entra_object_id", table_name="users")
    op.drop_constraint("uq_users_entra_object_id", "users", type_="unique")
    op.drop_column("users", "entra_object_id")
