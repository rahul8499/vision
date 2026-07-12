import psycopg2
from django.conf import settings

def create_spatial_sync_trigger():
    db_settings = settings.DATABASES['default']
    
    conn = psycopg2.connect(
        dbname=db_settings['NAME'],
        user=db_settings['USER'],
        password=db_settings['PASSWORD'],
        host=db_settings['HOST'] or 'localhost',
        port=db_settings['PORT'] or '5432'
    )
    cur = conn.cursor()

    # 🔧 Function to sync both location and geohash
    cur.execute("""
    CREATE OR REPLACE FUNCTION sync_spatial_data_full()
    RETURNS TRIGGER AS $$
    BEGIN
        IF (NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL) THEN
            -- 1. Sync PointField (Geography)
            NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
            
            -- 2. Sync GeoHash 🔑
            NEW.geohash := ST_GeoHash(ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326), 12);
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # ⚓ Attach Triggers
    tables = ['prescription_store', 'prescription_prescription']
    for table in tables:
        cur.execute(f"DROP TRIGGER IF EXISTS trg_sync_spatial_full ON {table};")
        cur.execute(f"""
        CREATE TRIGGER trg_sync_spatial_full
        BEFORE INSERT OR UPDATE OF latitude, longitude ON {table}
        FOR EACH ROW
        EXECUTE FUNCTION sync_spatial_data_full();
        """)

    conn.commit()
    cur.close()
    conn.close()
    print("✅ DATABASE LEVEL SYNC: Triggers for Location & GeoHash created successfully!")

if __name__ == "__main__":
    import os
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
    django.setup()
    create_spatial_sync_trigger()
