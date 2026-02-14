#include <WiFi.h>
#include <WebSocketsServer.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASS";

WebSocketsServer webSocket = WebSocketsServer(81);

void setup() {
  Serial.begin(115200);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
  Serial.println(WiFi.localIP());

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();

  // fake sensor for now
  float bx = readMagX();
  float by = readMagY();
  float bz = readMagZ();

  // 1. ความเข้มข้นสนามแม่เหล็ก (µT)
  float fieldStrength = sqrt(bx*bx + by*by + bz*bz);

  // 2. ทิศทางสนามแม่เหล็ก (normalized)
  float mag = fieldStrength;
  float dx = bx / mag;
  float dy = by / mag;
  float dz = bz / mag;

  // 3. ทิศทางการไหลของกระแส (logic ตัวอย่าง)
  String currentDir = "West → East";

  String json = "{";
  json += "\"field_strength\":" + String(fieldStrength, 2) + ",";
  json += "\"current_direction\":\"" + currentDir + "\",";
  json += "\"field_direction\":[" +
            String(dx,2) + "," +
            String(dy,2) + "," +
            String(dz,2) + "]";
  json += "}";

  webSocket.broadcastTXT(json);
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.println("Client connected");
  }
}
