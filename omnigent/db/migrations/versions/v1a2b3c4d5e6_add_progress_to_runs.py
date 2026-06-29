"""add progress to runs

Revision ID: v1a2b3c4d5e6
Revises: u1a2b3c4d5e6
Create Date: 2026-06-29 13:00:00.000000

Adds the ``progress`` column to ``runs`` — the latest step/progress text
captured from the run's agent stream for the jobs "Status" affordance. Updated
live during the run and retained afterward. Defaults to an empty string.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "v1a2b3c4d5e6"
down_revision: str | None = "u1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("runs") as batch_op:
        batch_op.add_column(
            sa.Column("progress", sa.Text(), nullable=False, server_default="")
        )


def downgrade() -> None:
    with op.batch_alter_table("runs") as batch_op:
        batch_op.drop_column("progress")
