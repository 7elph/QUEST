import { seedCoreData, resetDemoData } from "../src/lib/seed";

async function main() {
  await seedCoreData();

  if (process.env.DEMO_SEED === "true") {
    await resetDemoData();
  }

  console.log("Seed concluido.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
