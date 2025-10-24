// @ts-nocheck
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

beforeAll(async () => {
  try {
    // Get database connection details from environment variables
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'commercial-bank';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';
    
    const jdbcUrl = `jdbc:postgresql://${dbHost}:${dbPort}/${dbName}`;

    // Log environment and config info
    // console.log('--- Flyway Migration Debug Info ---');
    // console.log('Current working directory:', process.cwd());

    // List files in current directory
    try {
      const currentDirFiles = fs.readdirSync(process.cwd());
      // console.log('Files in current directory:', currentDirFiles);
    } catch (err) {
      // console.warn('Could not list files in current directory:', err);
    }

    // List sibling folders one level up
    try {
      const parentDir = path.resolve(process.cwd(), '..');
      const parentContents = fs.readdirSync(parentDir);
      // console.log('Parent directory:', parentDir);
      // console.log('Sibling folders/files in parent directory:', parentContents);
    } catch (err) {
      // console.warn('Could not list parent directory contents:', err);
    }

    // Check if Flyway directory exists (in container it's mounted at /flyway)
    const flywayPath = '/flyway';
    // console.log('Flyway path:', flywayPath);
    try {
      const flywayFiles = fs.readdirSync(flywayPath);
      // console.log('Flyway directory contents:', flywayFiles);
    } catch (err) {
      // console.warn('Could not read flyway directory:', err);
    }

    // Log final command configuration
    // console.log('Flyway configuration:');
    // console.log(`  JDBC URL: ${jdbcUrl}`);
    // console.log(`  User: ${dbUser}`);
    // console.log(`  Password: ${'*'.repeat(dbPassword.length)}`); // mask password
    // console.log('-----------------------------------');

    // Build the Flyway command with correct path
    const flywayCommand = `/usr/local/bin/flyway -url=${jdbcUrl} -user=${dbUser} -password=${dbPassword} -cleanDisabled=false -locations=filesystem:/flyway -target=6 clean migrate`;

    // Log command before execution
    // console.log('Executing Flyway command:', flywayCommand);

    // Execute Flyway migrations
    const output = execSync(flywayCommand, {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    // console.log('Flyway output:', output.toString());
  } catch (error) {
    // console.warn('Failed to run migrations:', error);
    if (error.stdout) console.warn('Flyway stdout:', error.stdout.toString());
    if (error.stderr) console.warn('Flyway stderr:', error.stderr.toString());
  }
});