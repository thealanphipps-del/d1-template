/**
 * FORENSIC HUB MASTER ENGINE v3.0
 * Everything in one file to prevent "Not Defined" errors.
 */

// --- GLOBAL CONFIGURATION ---
var FOLDER_ID = "1DwZwSjqcbsTgtJy9eesZV8RoT6xY9C2z";
var MODEL_NAME = "gemini-2.0-flash";

/**
 * 1. MAIN EXECUTION LOOP
 * This is the function you set the 1-minute trigger for.
 */
function ingestAndAnalyzeTakeout() {
  try {
    unpackTakeoutZips(); // Clean up any new ZIPs first
    
    var mainFolder = DriveApp.getFolderById(FOLDER_ID);
    var caseFolders = mainFolder.getFolders();
    var scriptProperties = PropertiesService.getScriptProperties();
    var fingerprintVault = scriptProperties.getProperty('FILE_FINGERPRINTS') || "";

    while (caseFolders.hasNext()) {
      var folder = caseFolders.next();
      var caseNumber = folder.getName();
      var files = folder.getFiles();
      var caseData = "";
      var newFilesCount = 0;

      while (files.hasNext()) {
        var file = files.next();
        var fingerprint = caseNumber + "_" + file.getName() + "_" + file.getSize();
        
        // Skip if we've already analyzed this exact file
        if (fingerprintVault.indexOf(fingerprint) !== -1) continue;

        var mime = file.getMimeType();
        if (mime.includes('text') || mime.includes('json') || file.getName().endsWith('.log')) {
          caseData += "\n[SOURCE: " + file.getName() + "]\n" + file.getBlob().getDataAsString() + "\n";
          fingerprintVault += (fingerprintVault ? "|" : "") + fingerprint;
          newFilesCount++;
        }
      }

      if (newFilesCount > 0) {
        var prompt = "Perform a forensic anomaly detection on this data for Case: " + caseNumber + ". Look for location spoofing, timestamp gaps, or unusual activity.";
        var analysis = callGeminiAI(caseData, prompt);
        sendPushoverNotification("Forensic Hub: " + caseNumber, analysis);
      }
    }
    
    // Save state (limit vault size to 500 entries)
    var vaultArray = fingerprintVault.split('|').slice(-500); 
    scriptProperties.setProperty('FILE_FINGERPRINTS', vaultArray.join('|'));
    
  } catch (e) {
    console.error("Ingest Failed: " + e.toString());
  }
}

/**
 * 2. GEMINI AI CONNECTION
 */
function callGeminiAI(content, prompt) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL_NAME + ":generateContent?key=" + apiKey;
  
  var payload = {
    "contents": [{
      "parts": [{
        "text": prompt + "\n\nDATA TO ANALYZE:\n" + content
      }]
    }]
  };
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());
  
  if (json.candidates && json.candidates[0]) {
    return json.candidates[0].content.parts[0].text;
  } else {
    return "AI Analysis failed: " + response.getContentText();
  }
}

/**
 * 3. PUSHOVER NOTIFICATIONS
 */
function sendPushoverNotification(title, message) {
  var userKey = PropertiesService.getScriptProperties().getProperty('PUSHOVER_USER_KEY');
  var token = PropertiesService.getScriptProperties().getProperty('PUSHOVER_APP_TOKEN');
  
  UrlFetchApp.fetch("https://api.pushover.net/1/messages.json", {
    "method": "post",
    "payload": {
      "token": token,
      "user": userKey,
      "title": title,
      "message": message.substring(0, 1000) // Pushover limit is ~1000 chars
    }
  });
}

/**
 * 4. ZIP EXTRACTION UTILITY
 */
function unpackTakeoutZips() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var zips = folder.getFilesByType(MimeType.ZIP);
  
  while (zips.hasNext()) {
    var zipFile = zips.next();
    try {
      var unzippedFiles = Utilities.unzip(zipFile.getBlob());
      unzippedFiles.forEach(function(fileBlob) {
        folder.createFile(fileBlob);
      });
      // Move ZIP to a 'Processed' folder so we don't unzip it forever
      var processedFolder;
      var sub = folder.getFoldersByName("Processed_Zips");
      processedFolder = sub.hasNext() ? sub.next() : folder.createFolder("Processed_Zips");
      zipFile.moveTo(processedFolder);
    } catch (e) {
      console.error("Unzip failed for " + zipFile.getName() + ": " + e.toString());
    }
  }
}

/**
 * 5. INITIAL SETUP (RUN THIS ONCE)
 */
function INITIAL_SETUP() {
  PropertiesService.getScriptProperties().setProperties({
    'GEMINI_API_KEY': 'YOUR_GEMINI_KEY_HERE',
    'PUSHOVER_USER_KEY': 'YOUR_USER_KEY_HERE',
    'PUSHOVER_APP_TOKEN': 'YOUR_APP_TOKEN_HERE'
  });
  console.log("Setup Complete. Keys stored.");
}

/**
 * 6. RESET (USE IF NOTIFICATIONS STOP)
 */
function RESET_INGESTION_HISTORY() {
  PropertiesService.getScriptProperties().deleteProperty('FILE_FINGERPRINTS');
  console.log("Memory cleared. Ready for full re-scan.");
}