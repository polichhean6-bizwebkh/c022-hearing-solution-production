# Hearing Solution Cambodia — GitHub Production Upload

This folder is the final, tested, upload-ready copy of the C022 site,
connected to the live Supabase database. Browser-tested successfully:
booking submission, admin login, booking list, status update, and logout
all work end to end.

## Structure

```
c022-hearing-solution-github-production/
├── index.html          Main public website
├── booking/
│   └── index.html      Customer appointment booking flow
├── admin/
│   ├── index.html      Admin login + dashboard
│   └── app.js           Admin dashboard application logic
├── css/                 All stylesheets
├── js/                  All JavaScript, including the Supabase
│   │                     frontend connection:
│   ├── supabase-config.js   Supabase URL + public/publishable key
│   ├── supabase-data.js     Booking data layer + Auth (sign in/out)
│   └── supabase-notes.js    Shared note-field encode/decode helper
├── assets/               Images, logos, icons (only files actually
│                          referenced by the pages above)
└── README.md            This file
```

## Routes

- `/` — main website
- `/booking/` — customer booking flow
- `/admin/` — admin login + dashboard

All internal links/asset references use relative paths (`css/…`,
`js/…`, `assets/…`, `booking/`, `../` from subfolders), so the site works
correctly whether hosted at a domain root or under a subfolder, e.g.:

```
https://www.bizwebkh.com/c022-hearing-solution-github-production/
https://www.bizwebkh.com/c022-hearing-solution-github-production/booking/
https://www.bizwebkh.com/c022-hearing-solution-github-production/admin/
```

## Current scope (client-confirmed)

Booking without OTP for now. No OTP/SMS verification, no customer login
or accounts, and no payment anywhere in this package. Customers submit
appointment requests directly; staff sign in with the one Supabase Auth
admin account already created to review and update bookings.

## Supabase connection

`js/supabase-config.js` contains only the Supabase project URL and the
public/publishable API key — safe to ship in frontend code. No
service_role key, database password, or admin secret is present
anywhere in this folder (verified before upload).

Row Level Security remains exactly as configured on the `bookings`
table: anonymous visitors can only INSERT a new booking; only signed-in
admin accounts can SELECT or UPDATE; nobody can DELETE.

## Not included in this package

- `booking-system/` (the separate Next.js + Prisma system) — not part
  of this static deployment.
- Local development/testing instructions — this copy is for upload,
  not local preview. (See the `c022-hearing-solution-production-final`
  folder if you need to test locally again before your next change.)
