-- I-02 — `events` es append-only.
-- La invariante se hace cumplir en la base, no solo en el código: un bug en la
-- capa de aplicación no debe poder reescribir la historia.
--
-- Corregir un dato = insertar un evento nuevo con revokesId apuntando al
-- anterior. Las proyecciones ignoran los revocados; el histórico conserva
-- ambos, y con ellos la evidencia del error.

CREATE OR REPLACE FUNCTION events_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'I-02: events es append-only. Para corregir, inserta un evento nuevo con revokesId.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_no_update
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION events_append_only();

CREATE TRIGGER events_no_delete
    BEFORE DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION events_append_only();
