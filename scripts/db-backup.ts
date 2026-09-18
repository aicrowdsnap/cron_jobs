import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import mysql from 'mysql2/promise';
import { uploadBackupToGoogleDrive } from '../lib/services/googleDriveService';
import { sendNotificationEmail } from '../lib/services/emailService';

export async function runDatabaseBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `db-backup-${timestamp}.sql`;
  const tempFilePath = path.join(os.tmpdir(), filename);

  console.log(`[Backup] Starting custom database dump...`);

  let connection;
  try {
    connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || '4000'),
        ssl: { rejectUnauthorized: true },
        typeCast: function (field, next) {
            return field.string("utf8");
        }
    });

    const writeStream = fs.createWriteStream(tempFilePath);
    writeStream.write(`-- Database Backup generated at ${new Date().toISOString()}\n\n`);

    const [tablesRows]: any[] = await connection.query('SHOW TABLES');
    const dbName = process.env.DB_NAME as string;
    const tables = tablesRows.map((row: any) => row[`Tables_in_${dbName}`] || Object.values(row)[0]);

    for (const table of tables) {
        if (table === 'code_list') continue;

        const [createTableRows]: any[] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
        writeStream.write(`DROP TABLE IF EXISTS \`${table}\`;\n`);
        writeStream.write(`${createTableRows[0]['Create Table']};\n\n`);

        const [rows]: any[] = await connection.query(`SELECT * FROM \`${table}\``);
        
        if (rows.length > 0) {
            for (const row of rows) {
                const values = Object.values(row).map(val => {
                    if (val === null) return 'NULL';
                    const escapedVal = String(val).replace(/'/g, "''");
                    return `'${escapedVal}'`;
                });
                writeStream.write(`INSERT INTO \`${table}\` VALUES (${values.join(', ')});\n`);
            }
        }
        writeStream.write('\n');
    }

    writeStream.end();
    await new Promise<void>(resolve => writeStream.on('finish', () => resolve()));

    const stats = fs.statSync(tempFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`[Backup] Dump successful (${fileSizeMB} MB). Uploading...`);

    const driveUrl = await uploadBackupToGoogleDrive(tempFilePath, filename);
    console.log(`[Backup] Process completed! Backup uploaded to Google Drive`);

    const successMessage = `
      <h3>✅ Database Backup Successful</h3>
      <p><strong>File:</strong> ${filename}</p>
      <p><strong>Size:</strong> ${fileSizeMB} MB</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}</p>
      <br>
      <a href="${driveUrl}">Download Backup from Google Drive</a>
    `;
    await sendNotificationEmail(`✅ Database Backup: ${process.env.DB_NAME}`, successMessage);

    return { success: true, url: driveUrl, sizeMB: fileSizeMB };

  } catch (error: any) {
    console.error(`[Backup] Failed during backup process:`, error);
    
    const errorMessage = `
      <h3>❌ Database Backup Failed</h3>
      <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}</p>
      <p><strong>Error Details:</strong></p>
      <pre>${error?.message || 'Unknown execution error'}</pre>
    `;
    await sendNotificationEmail(`❌ Backup Failed: ${process.env.DB_NAME}`, errorMessage);

    throw error;
  } finally {
    if (connection) {
        await connection.end();
    }
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}