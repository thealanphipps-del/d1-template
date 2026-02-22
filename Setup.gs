function CHECK_KEYS() {
  console.log("Gemini Key exists: " + !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'));
  console.log("Pushover Key exists: " + !!PropertiesService.getScriptProperties().getProperty('PUSHOVER_APP_TOKEN'));
}