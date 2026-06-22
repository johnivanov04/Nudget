# Nudget — iOS app (SwiftUI)

The native app for the Nudget backend. **Phase 1 (this slice):** launches, calls the
backend's demo runway endpoint (no auth/Plaid needed), and renders the dashboard —
the three core numbers, a non-shaming risk badge, privacy mode, and a last-updated /
stale signal.

The Xcode project is generated from `project.yml` with [XcodeGen](https://github.com/yonsm/XcodeGen)
(so it's reproducible from plain text — the `.xcodeproj` is gitignored).

## Run it

1. **Start the backend** (from the repo root, in another terminal):
   ```bash
   cd ..        # repo root
   npm run dev  # serves http://localhost:3000 — the demo endpoint needs no env
   ```
2. **Generate the Xcode project:**
   ```bash
   brew install xcodegen      # if not installed
   cd ios
   xcodegen generate
   open Nudget.xcodeproj
   ```
3. In Xcode, pick an **iPhone Simulator** and press **⌘R**.

You should see the runway dashboard render from the backend's seed data: **Safe to
spend $417.56**, spent today, bills before payday, payday in N days, and a freshness
line. Tap the eye toggle (top-right) for **privacy mode** (amounts hidden, risk kept).
Pull to refresh.

> **Physical device?** Change `AppConfig.baseURL` from `localhost` to your Mac's LAN
> IP (e.g. `http://192.168.1.x:3000`) and keep the device on the same Wi-Fi.

## Structure

```
ios/
  project.yml                 # XcodeGen spec (source of truth for the project)
  Nudget/
    NudgetApp.swift           # @main entry
    AppConfig.swift           # backend base URL
    Models/WidgetSnapshot.swift
    Services/NudgetAPI.swift  # backend client (demo snapshot for now)
    ViewModels/DashboardViewModel.swift
    Views/DashboardView.swift
    Views/RiskBadge.swift
    Support/Formatters.swift  # currency / date / "updated Xh ago"
```

## Next slices (see ../NEXT_STEPS.md)

- Supabase Auth sign-in → send the JWT on requests; switch the dashboard from the
  demo endpoint to `GET /api/runway/current`.
- Onboarding: privacy consent → Plaid Link → payday setup → bill review.
- Settings: notification preferences, account deletion.
- Then WidgetKit + APNs.
