import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import mysql from 'mysql2/promise';
import AdmZip from 'adm-zip';
import { uploadBackupToGoogleDrive } from '../lib/services/googleDriveService';
import { sendNotificationEmail } from '../lib/services/emailService';

export async function runDatabaseBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlFilename = `db-backup-${timestamp}.sql`;
  const zipFilename = `db-backup-${timestamp}.zip`;
  const tempSqlPath = path.join(os.tmpdir(), sqlFilename);
  const tempZipPath = path.join(os.tmpdir(), zipFilename);

  const backupPassword = process.env.BACKUP_FILE_PW;
  if (!backupPassword) {
    throw new Error('BACKUP_FILE_PW is not defined in environment variables.');
  }

  console.log(`[Backup] Starting database dump...`);

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
        return next();
      }
    });

    const writeStream = fs.createWriteStream(tempSqlPath);
    writeStream.write(`-- Database Backup generated at ${new Date().toISOString()}\n\n`);
    writeStream.write(`SET NAMES utf8mb4;\n\n`);

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
            
            if (Buffer.isBuffer(val)) {
              return `0x${val.toString('hex')}`;
            }
            
            if (typeof val === 'object') {
              try {
                const jsonStr = JSON.stringify(val);
                return `'${jsonStr.replace(/'/g, "''")}'`;
              } catch (e) {
                // Fallback string conversion
              }
            }

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

    console.log(`[Backup] Compressing SQL dump...`);
    const zip = new AdmZip();
    const sqlFileBuffer = fs.readFileSync(tempSqlPath);
    
    zip.addFile(sqlFilename, sqlFileBuffer, 'Database SQL Backup', 0o644 << 16);
    
    const zipEntries = zip.getEntries();
    zipEntries.forEach(entry => {
      if (typeof (entry as any).setPassword === 'function') {
        (entry as any).setPassword(backupPassword);
      }
    });

    zip.writeZip(tempZipPath);

    const stats = fs.statSync(tempZipPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`[Backup] Compression successful (${fileSizeMB} MB). Uploading...`);

    const driveUrl = await uploadBackupToGoogleDrive(tempZipPath, zipFilename);
    console.log(`[Backup] Process completed! Backup uploaded`);

    const successMessage = `
      <h3>✅ Database Backup Successful</h3>
      <p><strong>File:</strong> ${zipFilename}</p>
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
    if (fs.existsSync(tempSqlPath)) {
      fs.unlinkSync(tempSqlPath);
    }
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
  }
}