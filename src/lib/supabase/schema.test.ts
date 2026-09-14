import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function migrationSql(): string {
  const migration = readdirSync(migrationsDir).find((file) => file.endsWith("_initial_expense_schema.sql"));
  if (!migration) throw new Error("Initial expense migration does not exist");
  return readFileSync(join(migrationsDir, migration), "utf8").toLowerCase();
}

function localOwnerMigrationSql(): string {
  const migration = readdirSync(migrationsDir).find((file) => file.endsWith("_replace_telegram_owner.sql"));
  if (!migration) throw new Error("Local owner migration does not exist");
  return readFileSync(join(migrationsDir, migration), "utf8").toLowerCase();
}

function archiveMigrationSql(): string {
  const migration = readdirSync(migrationsDir).find((file) => file.endsWith("_archive_expenses.sql"));
  if (!migration) throw new Error("Expense archive migration does not exist");
  return readFileSync(join(migrationsDir, migration), "utf8").toLowerCase();
}

describe("Supabase expense schema", () => {
  it("enables RLS on every user-owned table", () => {
    const sql = migrationSql();
    const tables = ["profiles", "accounts", "categories", "people", "groups", "group_members", "transactions", "transaction_items", "allocations", "merchant_rules", "telegram_updates"];
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps anonymous clients away from financial tables", () => {
    const sql = migrationSql();
    expect(sql).toContain("revoke all on all tables in schema public from anon");
    expect(sql).not.toMatch(/create policy[\s\S]+to anon/);
  });

  it("creates a security-invoker monthly summary", () => {
    expect(migrationSql()).toContain("with (security_invoker = true)");
  });

  it("preserves one owner while removing Telegram identity", () => {
    const sql = localOwnerMigrationSql();
    expect(sql).toContain("count(*)");
    expect(sql).toContain("raise exception");
    expect(sql).toContain("profile_key");
    expect(sql).toContain("local-owner");
    expect(sql).toContain("drop column telegram_user_id");
    expect(sql).toContain("drop table public.telegram_updates");
    expect(sql).toContain("update public.transactions set source = 'manual' where source = 'telegram'");
    expect(sql.indexOf("update public.transactions set source")).toBeLessThan(sql.indexOf("add constraint transactions_source_check"));
  });

  it("adds indexed soft deletion to transactions", () => {
    const sql = archiveMigrationSql();
    expect(sql).toContain("add column deleted_at timestamptz");
    expect(sql).toContain("where deleted_at is null");
    expect(sql).toContain("where deleted_at is not null");
  });
});
