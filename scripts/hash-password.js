// Usage: npm run hash-password -- 'your-strong-password'
// Prints a value for ADMIN_PASSWORD_HASH.
import { hashPassword } from "../src/lib/auth/session.js";

const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error("Give a password of at least 12 characters: npm run hash-password -- 'your password'");
  process.exit(1);
}
console.log(hashPassword(pw));
