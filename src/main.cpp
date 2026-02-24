#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_HMC5883_U.h>

// ── Config ────────────────────────────────────────────────────────
const char* WIFI_SSID     = "Gun";
const char* WIFI_PASSWORD = "GunGunGun321";
const char* SERVER_HOST   = "192.168.1.100";  // your laptop's local IP
const int   SERVER_PORT   = 3000;

// ── Sensor ────────────────────────────────────────────────────────
Adafruit_HMC5883_Unified mag = Adafruit_HMC5883_Unified(12345);

WebSocketsClient webSocket;
unsigned long lastSend = 0;

// ── Get human-readable direction from vector ──────────────────────
String getDirection(float x, float y) {
  float heading = atan2(y, x) * 180.0 / PI;
  if (heading < 0) heading += 360;

  if (heading < 22.5  || heading >= 337.5) return "North";
  if (heading < 67.5)  return "Northeast";
  if (heading < 112.5) return "East";
  if (heading < 157.5) return "Southeast";
  if (heading < 202.5) return "South";
  if (heading < 247.5) return "Southwest";
  if (heading < 292.5) return "West";
  return "Northwest";
}

// ── Handle commands from website ──────────────────────────────────
void handleCommand(const char* cmd) {
  Serial.printf("[CMD] %s\n", cmd);

  if (strcmp(cmd, "LED_ON") == 0) {
    digitalWrite(2, HIGH);

  } else if (strcmp(cmd, "LED_OFF") == 0) {
    digitalWrite(2, LOW);

  } else if (strcmp(cmd, "RESET") == 0) {
    delay(300);
    ESP.restart();

  } else if (strcmp(cmd, "CALIBRATE") == 0) {
    // Add your calibration logic here
    Serial.println("Calibrating sensor...");
  }
}

void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("[WS] Connected");
      break;

    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      break;

    case WStype_TEXT: {
      StaticJsonDocument<200> doc;
      if (!deserializeJson(doc, payload)) {
        handleCommand(doc["command"] | "");
      }
      break;
    }
    default: break;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);

  // Init sensor
  if (!mag.begin()) {
    Serial.println("HMC5883L not found! Check wiring.");
    while (1);
  }

  // Connect WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi: " + WiFi.localIP().toString());

  // Connect WebSocket
  webSocket.begin(SERVER_HOST, SERVER_PORT, "/ws");
  webSocket.onEvent(onWebSocketEvent);
  webSocket.setReconnectInterval(3000);
}

void loop() {
  webSocket.loop();

  if (millis() - lastSend >= 500) {
    lastSend = millis();

    // Read sensor
    sensors_event_t event;
    mag.getEvent(&event);

    float x = event.magnetic.x;  // µT
    float y = event.magnetic.y;
    float z = event.magnetic.z;
    float strength = sqrt(x*x + y*y + z*z);

    // Normalize direction vector
    float nx = x / strength;
    float ny = y / strength;
    float nz = z / strength;

    // Build JSON — field names match your website exactly
    StaticJsonDocument<256> doc;
    doc["type"]              = "sensor_data";
    doc["field_strength"]    = strength;          // µT → b_strength
    doc["current_direction"] = getDirection(x,y); // text → current_dir
    JsonArray dir = doc.createNestedArray("field_direction");
    dir.add(nx); dir.add(ny); dir.add(nz);        // [x,y,z] → b_dir

    String output;
    serializeJson(doc, output);
    webSocket.sendTXT(output);

    Serial.printf("B=%.2f µT dir=%s\n", strength, getDirection(x,y).c_str());
  }
}
// ```

// ---

// ## Wiring (HMC5883L → ESP32)
// ```
// HMC5883L    ESP32
// ─────────────────
// VCC    →    3.3V
// GND    →    GND
// SDA    →    GPIO 21
// SCL    →    GPIO 22
// ```

// ---

// ## The JSON Flow
// ```
// ESP32 sends:                        Your website reads:
// {                                   b_strength  ← field_strength
//   "type": "sensor_data",            current_dir ← current_direction
//   "field_strength": 42.3,           b_dir       ← field_direction[0,1,2]
//   "current_direction": "Northeast", aurora      ← driven by field_strength
//   "field_direction": [0.2, 0.9, 0.3]  solar storm auto-triggers if > 55µT
// }