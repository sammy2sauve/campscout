"""
Create all staging tables in the database.

Run once after setting up a fresh database:
    python scripts/init_db.py
"""
import sys
from pathlib import Path

# Allow running from the repo root without installing the package.
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.storage.database import Base, engine
import src.storage.raw_models  # noqa: F401 — registers models with Base
import src.storage.models      # noqa: F401 — registers unified models with Base


def main() -> None:
    print("Creating tables...")
    Base.metadata.create_all(engine)
    print("Done. Tables created:")
    for name in sorted(Base.metadata.tables):
        print(f"  {name}")


if __name__ == "__main__":
    main()
