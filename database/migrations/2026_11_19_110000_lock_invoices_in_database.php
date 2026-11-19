<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION invoices_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Une facture emise ne peut pas etre supprimee.';
    END IF;
    IF (to_jsonb(NEW) - 'status' - 'cancelled_at' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'cancelled_at' - 'updated_at') THEN
        RAISE EXCEPTION 'Une facture emise ne peut pas etre modifiee : emettez un avoir.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION credit_notes_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Un avoir emis ne peut etre ni modifie ni supprime.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_guard_trg ON invoices;
CREATE TRIGGER invoices_guard_trg BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_guard();

DROP TRIGGER IF EXISTS credit_notes_guard_trg ON credit_notes;
CREATE TRIGGER credit_notes_guard_trg BEFORE UPDATE OR DELETE ON credit_notes FOR EACH ROW EXECUTE FUNCTION credit_notes_guard();
SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared('DROP TRIGGER IF EXISTS invoices_guard_trg ON invoices; DROP TRIGGER IF EXISTS credit_notes_guard_trg ON credit_notes; DROP FUNCTION IF EXISTS invoices_guard(); DROP FUNCTION IF EXISTS credit_notes_guard();');
    }
};