# Metabooki Word import worker

This private worker validates the single confirmed upload, assembles resumable
chunks, verifies the SHA-256 checksum, stores the canonical DOCX, and creates a
reference PDF with LibreOffice when possible.

Required runtime secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POLL_INTERVAL_MS` (optional)

The service-role key belongs only in the container secret manager. Never expose
it in the web application or commit it to the repository.
