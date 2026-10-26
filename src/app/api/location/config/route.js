// GET /api/location/config — tells the client which location features are available.

import { googleEnabled } from "@/lib/location/google";

export function GET() {
  return Response.json({ google: googleEnabled() }, { headers: { "Cache-Control": "public, max-age=300" } });
}
