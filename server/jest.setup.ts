import { execSync } from 'child_process';

beforeAll(async () => {
  try {
    // Rerun migrations before each test
    execSync('flyway -configFiles=../flyway/flyway.conf -locations=filesystem:../flyway -target=6 clean migrate', {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
  } catch (error) {
    console.warn('Failed to run migrations:', error);
  }
});