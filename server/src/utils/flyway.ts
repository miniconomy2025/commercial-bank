import { Flyway } from "node-flyway";
import appConfig from "../config/app.config";

const parts = appConfig.dbUrl.split('://').flatMap(p => p.split('@'));
const [db, auth, host] = parts;
const [user, password] = auth.split(':');
const url = `jdbc:${db}://${host}`;


const flyway = new Flyway({
  migrationLocations: ["filesystem:../flyway"],
  url, user, password
});

export const resetDBFlyway = async (): Promise<void> => {
    await flyway.clean();
    await flyway.migrate();
};