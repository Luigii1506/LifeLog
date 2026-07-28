import { seedEventSchemas } from "../src/lib/events/seed-schemas";
import { db } from "../src/lib/db";

async function main() {
  const { inserted, skipped } = await seedEventSchemas();
  console.log(`event_schemas: ${inserted.length} insertados, ${skipped.length} ya presentes`);
  for (const kind of inserted) console.log(`  + ${kind}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
