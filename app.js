// app.js - cPanel / Phusion Passenger Node.js entry point
// Next.js standalone produces server.js. This wrapper delegates to server.js
// ensuring compatibility with cPanel's default startup file (app.js).
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || 3000;

const serverPath = path.join(__dirname, "server.js");

if (fs.existsSync(serverPath)) {
  require(serverPath);
} else {
  console.error("[cPanel Startup] server.js not found in application directory.");
  console.error("[cPanel Startup] Please ensure the standalone build was deployed.");
  process.exit(1);
}
