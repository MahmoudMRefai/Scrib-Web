# Scribe Web

## Project Overview

Scribe Web is a premium, dark‑themed single‑page application built with **React 19**, **TypeScript**, and **Vite**. It provides three role‑based consoles that interact with the Scribe backend via a proxy (`/api/* → http://localhost:3000`). The UI follows a modern glass‑morphism style with smooth micro‑animations, Google Fonts (Inter), and a responsive layout.

## Features

- **Login** with email or phone, plus one‑click demo accounts for:
  - Admin (`admin@scribe.local` / `Admin@Scribe2026`)
  - Courier (`courier1@scribe.local` / `Courier@2026`)
  - Merchant (`merchant1@scribe.local` / `Merchant@2026`)
- **Admin Console**
  - Parcel statistics dashboard
  - Assign couriers to parcels
  - Update parcel status
  - Confirm settlements
  - Manage lists of couriers, merchants, and wallets
- **Merchant Console**
  - Create parcels (merchant ID fetched from `GET /api/merchants/me`)
  - View parcel list (paginated)
  - Check wallet balance
- **Courier Console**
  - Advance assigned parcels through status workflow
  - View wallet balance
  - Initiate settlement process
- All API responses follow a unified wrapper `{ success, data }`; list endpoints are paginated (`{ items, total, page, pageSize, totalPages }`).

---

*The repository is configured to push to* `https://github.com/MahmoudMRefai/Scrib-Web` *on the `master` branch. Commits are authored and committed as* `Mahmoud Refai <mahmoud.refaie22@gmail.com>`.
