"""add backing_prompt to entities

Revision ID: u1a2b3c4d5e6
Revises: t1a2b3c4d5e6
Create Date: 2026-06-29 12:00:00.000000

Adds the ``backing_prompt`` column to ``entities`` — a hidden, run-time-only
prompt injected into the agent's system prompt when a flow step uses the entity,
never shown in the conversation. Defaults to an empty string for existing rows.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "u1a2b3c4d5e6"
down_revision: str | None = "t1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("entities") as batch_op:
        batch_op.add_column(
            sa.Column("backing_prompt", sa.Text(), nullable=False, server_default="")
        )


def downgrade() -> None:
    with op.batch_alter_table("entities") as batch_op:
        batch_op.drop_column("backing_prompt")
