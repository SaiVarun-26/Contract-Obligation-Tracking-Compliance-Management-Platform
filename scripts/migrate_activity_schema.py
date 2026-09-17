import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database.database import engine


def migrate():
    print("Migrating activities table...")
    with engine.connect() as conn:
        # Add timestamp column with default now
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        """))

        # Backfill timestamp from created_at if created_at exists and timestamp was null
        conn.execute(text("""
            UPDATE activities 
            SET timestamp = created_at 
            WHERE timestamp IS NULL AND created_at IS NOT NULL;
        """))

        # Add user_name column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS user_name VARCHAR(100);
        """))

        # Add user_role column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS user_role VARCHAR(50);
        """))

        # Add action column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS action VARCHAR(100) DEFAULT 'GENERAL_ACTIVITY';
        """))

        # Add entity_type column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
        """))

        # Add entity_id column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS entity_id INTEGER;
        """))

        # Add description column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
        """))

        # Backfill description from activity if description is empty
        conn.execute(text("""
            UPDATE activities 
            SET description = activity 
            WHERE (description IS NULL OR description = '') AND activity IS NOT NULL;
        """))

        # Add ip_address column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
        """))

        # Add status column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Success';
        """))

        # Add metadata JSON column
        conn.execute(text("""
            ALTER TABLE activities 
            ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}'::json;
        """))

        # Backfill user_name and user_role from users table if available
        conn.execute(text("""
            UPDATE activities a
            SET user_name = u.full_name,
                user_role = u.role
            FROM users u
            WHERE a.user_id = u.id AND (a.user_name IS NULL OR a.user_role IS NULL);
        """))

        # Create indexes
        print("Creating indexes on activities table...")
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_activities_timestamp_desc ON activities (timestamp DESC);
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_activities_user_id ON activities (user_id);
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_activities_action ON activities (action);
        """))

        conn.commit()
    print("Activities table migration completed successfully!")


if __name__ == "__main__":
    migrate()
