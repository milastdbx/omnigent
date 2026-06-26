"""add entities table

Revision ID: p1a2b3c4d5e6
Revises: o1a2b3c4d5e6
Create Date: 2026-06-26 18:00:00.000000

Adds the ``entities`` table. An entity is a reusable named instruction (e.g. the
Jira actions) authored in the web UI and wired into flows (jobs) as a step; the
instruction text is folded into the flow's rendered narrative when used.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p1a2b3c4d5e6"
down_revision: str | None = "o1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "entities",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_entities_created_by_updated_at",
        "entities",
        ["created_by", "updated_at"],
        unique=False,
    )
    op.create_index("ix_entities_updated_at", "entities", ["updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_entities_updated_at", table_name="entities")
    op.drop_index("ix_entities_created_by_updated_at", table_name="entities")
    op.drop_table("entities")
