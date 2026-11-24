import { googleDriveFromEnv } from '../src/media-storage.js';

// Create the folder with the SAME application and Google account as uploads.
// A folder created manually in Drive might not be accessible with drive.file.
if (process.env.GOOGLE_DRIVE_FOLDER_ID) throw new Error('GOOGLE_DRIVE_FOLDER_ID is already set. Do not create duplicate folders.');
const folderId = await googleDriveFromEnv().createFolder('CPSU Market Listing Photos');
console.log('Private Drive folder created. Add this to apps/api/.env:');
console.log(`GOOGLE_DRIVE_FOLDER_ID="${folderId}"`);
console.log('Do not enable MEDIA_STORAGE=google_drive until the backup and a test upload are successful.');
