Membership Portal — Offline Desktop Install
==========================================

This app runs without cloud hosting and WITHOUT installing PostgreSQL.

It uses:
  - Embedded database (PGlite) stored in the app data folder
  - Local disk folder for member documents

1) Install Membership Portal (Setup EXE on Windows, or run the desktop app on Mac).

2) First launch:
   - Creates config.env under the app user-data folder
   - Creates an embedded database automatically
   - Creates tables and the admin user

3) Default login:
   Username: admin
   Password: value of ADMIN_INITIAL_PASSWORD in config.env
            (default in example: Admin@12345)

4) Seed your existing data (optional):
   Settings → Data import → upload db-backup-*.sql (once)
   Then copy the documents/ folder from your blob backup into uploads/

5) Where data is stored
   macOS:
     ~/Library/Application Support/membership-portal-desktop/db/       (database)
     ~/Library/Application Support/membership-portal-desktop/uploads/  (files)
   Windows:
     %APPDATA%\membership-portal-desktop\db\
     %APPDATA%\membership-portal-desktop\uploads\
