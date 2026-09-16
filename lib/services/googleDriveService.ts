import { google } from 'googleapis';
import * as fs from 'fs';

export async function uploadBackupToGoogleDrive(
  filePath: string,
  fileName: string
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error('Google Drive OAuth credentials are not configured.');
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: 'v3', auth });

  const fileMetaData = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: 'application/x-sql',
    body: fs.createReadStream(filePath),
  };

  console.log(`[Google Drive] Uploading ${fileName}...`);

  const response = await drive.files.create({
    requestBody: fileMetaData,
    media: media,
    fields: 'id, webViewLink',
  });

  const fileId = response.data.id;
  const webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  console.log(`[Google Drive] Upload successful. File ID: ${fileId}`);
  return webViewLink;
}