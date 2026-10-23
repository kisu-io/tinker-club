import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import postgres from "postgres";
import "./helpers/testdb";
import { migrate } from "../src/lib/migrate";

// Simulates concurrent serverless cold starts migrating an empty database:
// each "instance" gets its own pool, all scoped to a fresh, empty schema so
// the shared test tables are untouched.
const INSTANCES = 8;
const ROUNDS = 3;

test("concurrent migrate() on an empty schema does not race", async () => {
  const url = process.env.DATABASE_URL!;
  const admin = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    for (let round = 0; round < ROUNDS; round++) {
      const schema = `mig_race_${crypto.randomBytes(6).toString("hex")}`;
      await admin.unsafe(`CREATE SCHEMA "${schema}"`);
      const pools = Array.from({ length: INSTANCES }, () =>
        postgres(url, {
          max: 1,
          prepare: false,
          onnotice: () => {},
          connection: { search_path: schema },
        }),
      );
      try {
        const results = await Promise.allSettled(pools.map((sql) => migrate(sql)));
        const failures = results.filter((r) => r.status === "rejected");
        assert.equal(
          failures.length,
          0,
          `round ${round}: ${failures.length}/${INSTANCES} migrations failed: ${
            (failures[0] as PromiseRejectedResult | undefined)?.reason
          }`,
        );
        const tables = await admin`
          SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = ${schema}`;
        assert.equal(tables[0].n, 11);
      } finally {
        await Promise.all(pools.map((sql) => sql.end({ timeout: 1 })));
        await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
      }
    }
  } finally {
    await admin.end({ timeout: 1 });
  }
});
