// The Folder ID for "My Stuff"
const FOLDER_ID = '1DwZwSjqcbsTgtJy9eesZV8RoT6xY9C2z'; 

/**
 * MAIN EXECUTION LOOP
 * Use this function for your 1-minute trigger.
 */
function ingestAndAnalyzeTakeout() {
  console.log("--- Starting Execution: ingestAndAnalyzeTakeout ---");
  
  try {
    // 1. Optional: Handle ZIP files first if you have the unpack script
    if (typeof unpackTakeoutZips === "function") {
      console.log("Checking for ZIP files...");
      unpackTakeoutZips(); 
    }
    
    // 2. Initialize Drive and Properties
    var mainFolder = DriveApp.getFolderById(FOLDER_ID);
    var scriptProperties = PropertiesService.getScriptProperties();
    
    // Retrieve the fingerprint vault to avoid re-processing files
    var fingerprintVault = scriptProperties.getProperty('FILE_FINGERPRINTS') || "";
    var initialVaultLength = fingerprintVault.length;
    console.log("Vault loaded. Current size: " + initialVaultLength + " characters.");

    // 3. Start the Recursive Crawl
    // This will visit "Case-260002", "Takeout", and every folder inside them.
    var updatedVault = digestFolderRecursive(mainFolder, fingerprintVault);

    // 4. Save updated vault back to Script Properties
    if (updatedVault.length > initialVaultLength) {
      scriptProperties.setProperty('FILE_FINGERPRINTS', updatedVault);
      console.log("Crawl complete. Vault updated with new files.");
    } else {
      console.log("Crawl complete. No new files detected.");
    }

  } catch (e) {
    console.error("ERROR: " + e.toString());
    console.error("Stack: " + e.stack);
  }
  
  console.log("--- Execution Finished ---");
}

/**
 * RECURSIVE CRAWLER
 * Digs into every subfolder level found within "My Stuff"
 */
function digestFolderRecursive(folder, fingerprintVault) {
  var folderName = folder.getName();
  console.log("Scanning Folder: [" + folderName + "]");
  
  // 1. Process all files in the current folder
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var fileName = file.getName();
    var fileFingerprint = file.getId() + "_" + fileName;

    if (fingerprintVault.indexOf(fileFingerprint) === -1) {
      console.log("  + New file found: " + fileName);
      
      // --- DATA EXTRACTION POINT ---
      // This is where you would call functions to read .json or .html content
      // ------------------------------
      
      fingerprintVault += fileFingerprint + ",";
    }
  }

  // 2. Find subfolders and repeat the process (Recursion)
  var subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    var subFolder = subfolders.next();
    fingerprintVault = digestFolderRecursive(subFolder, fingerprintVault);
  }
  
  return fingerprintVault;
}