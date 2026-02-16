#!/usr/bin/env node
import crypto from "node:crypto";

const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "";
const body = process.argv[2] || '{"meta":{"event_name":"order_created"},"data":{"attributes":{"email":"test@example.com","custom_data":{"install_id":"pqc_test"},"variant_id":"12345"}}}';

if (!secret) {
  console.error("Set LEMON_SQUEEZY_WEBHOOK_SECRET first.");
  process.exit(1);
}

const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
console.log("Body:", body);
console.log("x-signature:", sig);
