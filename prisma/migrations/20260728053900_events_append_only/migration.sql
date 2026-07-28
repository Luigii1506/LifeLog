-- I-02 — `events` es append-only.
-- La invariante se hace cumplir en la base de datos, no solo en el código:
-- un bug en la capa de aplicación no debe poder reescribir la historia.
--
-- Corregir un dato = insertar un evento nuevo con revokesId apuntando al anterior.
-- Las proyecciones ignoran todo evento revocado; el histórico conserva ambos.

CREATE TRIGGER events_no_update
BEFORE UPDATE ON events
BEGIN
    SELECT RAISE(ABORT, 'I-02: events es append-only. Para corregir, inserta un evento nuevo con revokesId.');
END;

CREATE TRIGGER events_no_delete
BEFORE DELETE ON events
BEGIN
    SELECT RAISE(ABORT, 'I-02: events es append-only. Los eventos no se borran.');
END;
