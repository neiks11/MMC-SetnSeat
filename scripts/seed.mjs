import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dbFile = path.join(dataDir, 'mmc-database.json');

if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
  console.log('Removed existing database file. Fresh seed data will be generated automatically on next API request.');
} else {
  console.log('Database is already clean and will initialize with default seed data.');
}

