import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database.database import engine

def migrate():
    print("Migrating reports table...")
    with engine.connect() as conn:
        # Check and add file_format
        conn.execute(text("""
            ALTER TABLE reports 
            ADD COLUMN IF NOT EXISTS file_format VARCHAR(20) DEFAULT 'pdf';
        """))
        
        # Check and add status
        conn.execute(text("""
            ALTER TABLE reports 
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Completed';
        """))
        
        # Check and add download_count
        conn.execute(text("""
            ALTER TABLE reports 
            ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
        """))
        
        # Check and add generated_at
        conn.execute(text("""
            ALTER TABLE reports 
            ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        """))
        
        # Ensure file_path length is sufficient
        conn.execute(text("""
            ALTER TABLE reports 
            ALTER COLUMN file_path TYPE VARCHAR(500);
        """))
        
        conn.commit()
    print("Reports table migration completed successfully!")

if __name__ == "__main__":
    migrate()
