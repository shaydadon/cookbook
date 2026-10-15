// Side-effect module: imported first in main.tsx so it runs before the Supabase client and the router read the URL.
import { captureAuthError } from "./lib/auth-error";

captureAuthError();
