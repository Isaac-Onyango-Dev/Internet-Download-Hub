import { db } from "../server/db";
import { downloads } from "../shared/schema";

async function clearDatabase() {
    console.log("Clearing downloads table...");
    try {
        await db.delete(downloads);
        console.log("Successfully cleared downloads table.");
    } catch (error) {
        console.error("Error clearing database:", error);
        process.exit(1);
    }
    process.exit(0);
}

clearDatabase();
