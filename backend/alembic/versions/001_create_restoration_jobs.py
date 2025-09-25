"""Create restoration jobs table

Revision ID: 001
Revises:
Create Date: 2025-01-24 14:42:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type
    job_status_enum = postgresql.ENUM(
        "pending", "processing", "completed", "failed", name="jobstatus"
    )
    job_status_enum.create(op.get_bind())

    # Create restoration_jobs table
    op.create_table(
        "restoration_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("status", job_status_enum, nullable=False),
        sa.Column("original_image_url", sa.String(), nullable=False),
        sa.Column("processed_image_url", sa.String(), nullable=True),
        sa.Column("denoise", sa.Float(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_restoration_jobs_user_id"),
        "restoration_jobs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_restoration_jobs_status"), "restoration_jobs", ["status"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_restoration_jobs_status"), table_name="restoration_jobs")
    op.drop_index(op.f("ix_restoration_jobs_user_id"), table_name="restoration_jobs")
    op.drop_table("restoration_jobs")

    # Drop enum type
    job_status_enum = postgresql.ENUM(
        "pending", "processing", "completed", "failed", name="jobstatus"
    )
    job_status_enum.drop(op.get_bind())
